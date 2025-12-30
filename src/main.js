import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { createSettingsStore } from './main/settingsStore';
import { createTwitchChat } from './main/twitchChat';
import { startLocalUiServer } from './main/localUiServer';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow;
let tray;
let settingsStore;
let twitchChat;
let uiServer;

function getIconPath(iconName) {
  const isDev = !!MAIN_WINDOW_VITE_DEV_SERVER_URL;
  
  if (isDev) {
    // En développement: utiliser le chemin depuis la racine du projet
    // __dirname pointe vers .vite/build/, donc on remonte de 2 niveaux pour atteindre la racine
    const rootPath = path.resolve(__dirname, '../..');
    const iconPath = path.join(rootPath, 'public/icons/logo', iconName);
    
    return iconPath;
  } else {
    // En production: Electron Forge copie les fichiers via extraResource dans resources/
    // Avec extraResource configuré pour copier des fichiers individuels, ils sont directement dans resources/
    if (process.resourcesPath) {
      // Les fichiers sont directement dans resources/ (pas dans un sous-dossier)
      const resourcesPath = path.join(process.resourcesPath, iconName);
      if (fs.existsSync(resourcesPath)) {
        return resourcesPath;
      }
      
      // Fallback: essayer dans un sous-dossier logo/ (si le dossier était copié)
      const logoPath = path.join(process.resourcesPath, 'logo', iconName);
      if (fs.existsSync(logoPath)) {
        return logoPath;
      }
    }
    
    // Fallback: essayer depuis app.asar/public/ (si Vite a copié les fichiers)
    const appPath = app.getAppPath();
    const appIconPath = path.join(appPath, 'public/icons/logo', iconName);
    if (fs.existsSync(appIconPath)) {
      return appIconPath;
    }
    
    // Dernier recours: depuis __dirname
    const buildPath = path.resolve(__dirname, '../public/icons/logo', iconName);
    return buildPath;
  }
}

function getTrayIcon() {
  // Utilise app.ico pour le tray (ou DucVoice.png en fallback)
  const iconPath = getIconPath('app.ico');
  const icon = nativeImage.createFromPath(iconPath);
  
  // Vérifier si l'icône a été chargée (isEmpty() retourne true si le fichier n'existe pas)
  if (!icon.isEmpty()) {
    return icon;
  }
  
  // Fallback vers PNG si ICO ne fonctionne pas
  const pngPath = getIconPath('DucVoice.png');
  const pngIcon = nativeImage.createFromPath(pngPath);
  if (!pngIcon.isEmpty()) {
    return pngIcon;
  }
  
  // Fallback ultime: 1x1 PNG
  const dataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2kQAAAAASUVORK5CYII=';
  return nativeImage.createFromDataURL(dataUrl);
}

function ensureTray() {
  if (tray) return tray;

  tray = new Tray(getTrayIcon());
  tray.setToolTip('DucChat');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Ouvrir DucChat',
      click: () => {
        if (!mainWindow) return;
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Quitter',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.focus();
  });

  return tray;
}

const createWindow = () => {
  const isDev = !!MAIN_WINDOW_VITE_DEV_SERVER_URL;

  // Charger l'icône de la fenêtre
  const iconPath = getIconPath('app.ico');
  let windowIcon = nativeImage.createFromPath(iconPath);
  
  // Vérifier si l'icône a été chargée
  if (windowIcon.isEmpty()) {
    // Fallback vers PNG si ICO ne fonctionne pas
    const pngPath = getIconPath('DucVoice.png');
    windowIcon = nativeImage.createFromPath(pngPath);
    // Si le PNG n'existe pas non plus, windowIcon sera vide mais Electron gérera ça
  }

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 500,
    height: 500,
    minWidth: 500,
    minHeight: 500,
    autoHideMenuBar: true,
    frame: false,
    icon: windowIcon, // Icône de la fenêtre (barre des tâches Windows)
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Hide the application menu bar (Windows/Linux)
  mainWindow.setMenuBarVisibility(false);

  // and load the index.html of the app.
  // We always load from the local UI server (dev = proxy to Vite, prod = serve built files)
  if (isDev) mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  else mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));

  // Dev-only niceties
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Définir l'icône de l'application (utilisée dans la barre des tâches et autres endroits)
  const appIconPath = getIconPath('app.ico');
  const appIcon = nativeImage.createFromPath(appIconPath);
  if (!appIcon.isEmpty()) {
    app.dock?.setIcon?.(appIcon); // macOS dock
  }
  // L'icône de la fenêtre est déjà définie dans createWindow

  // Remove the application menu entirely (Windows/Linux)
  Menu.setApplicationMenu(null);

  settingsStore = createSettingsStore({ userDataDir: app.getPath('userData') });

  twitchChat = createTwitchChat({
    onMessage: (msg) => {
      // Send to Electron UI (if present)
      if (mainWindow) mainWindow.webContents.send('twitch:message', msg);
      // Always broadcast to HTTP interfaces (OBS/browser)
      uiServer?.broadcastMessage?.(msg);
    },
    onStatus: (status) => {
      if (mainWindow) mainWindow.webContents.send('twitch:status', status);
      uiServer?.broadcastStatus?.(status);
    },
  });

  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('window:close', () => {
    mainWindow?.close();
  });

  ipcMain.handle('app:minimizeToTray', () => {
    if (!mainWindow) return;
    ensureTray();
    mainWindow.hide();
  });

  ipcMain.handle('app:restoreFromTray', () => {
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.focus();
  });

  ipcMain.handle('twitch:getChannel', async () => {
    const stored = await settingsStore.getChannel();
    return stored || twitchChat.getChannel() || '';
  });

  ipcMain.handle('twitch:setChannel', async (_e, channelInput) => {
    const normalized = twitchChat.normalizeChannel(channelInput);
    if (normalized === null) {
      return { ok: false, error: 'Nom de chaîne invalide (a-z, 0-9, underscore).' };
    }
    await settingsStore.setChannel(normalized);
    try {
      await twitchChat.connect(normalized);
      return { ok: true, channel: normalized };
    } catch (err) {
      return { ok: false, error: String(err?.message || err) };
    }
  });

  ipcMain.handle('twitch:disconnect', async () => {
    await settingsStore.setChannel('');
    await twitchChat.disconnect();
    return { ok: true };
  });

  ipcMain.handle('pseudos:getConfig', async () => {
    const cfg = await settingsStore.getPseudosConfig();
    return { ok: true, config: cfg };
  });

  ipcMain.handle('pseudos:setConfig', async (_e, nextConfig) => {
    const cfg = await settingsStore.setPseudosConfig(nextConfig);
    // Push updates to Electron UI + HTTP overlays
    try {
      mainWindow?.webContents?.send?.('pseudos:config', cfg);
    } catch {
      // ignore
    }
    try {
      uiServer?.setConfig?.(cfg);
      uiServer?.broadcastConfig?.(cfg);
    } catch {
      // ignore
    }
    return { ok: true, config: cfg };
  });

  createWindow();

  // Start local HTTP server in BOTH dev and prod:
  // - dev: proxy UI from Vite so /api/stream is same-origin
  // - prod: serve built UI
  const rendererDir = MAIN_WINDOW_VITE_DEV_SERVER_URL
    ? null
    : path.join(app.getAppPath(), `.vite/renderer/${MAIN_WINDOW_VITE_NAME}`);

  startLocalUiServer({ rootDir: rendererDir })
    .then((srv) => {
      uiServer = srv;
      if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        uiServer.setProxyTarget?.(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      }

      ipcMain.handle('ui:getUrls', () => ({
        ok: true,
        url: srv.url,
        interfaceUrl: srv.interfaceUrl || srv.obsUrl,
        obsUrl: srv.obsUrl,
      }));

      // Seed initial status for new SSE clients
      const ch = twitchChat?.getChannel?.() || '';
      uiServer.broadcastStatus?.({ state: ch ? 'connected' : 'disconnected', channel: ch });

      // Seed initial pseudos config for HTTP overlays
      settingsStore.getPseudosConfig().then((cfg) => {
        uiServer?.setConfig?.(cfg);
        uiServer?.broadcastConfig?.(cfg);
        try {
          mainWindow?.webContents?.send?.('pseudos:config', cfg);
        } catch {
          // ignore
        }
      });

      // Load UI from the local server so browser/OBS uses same origin
      mainWindow?.loadURL(srv.url);
    })
    .catch((e) => {
      ipcMain.handle('ui:getUrls', () => ({ ok: false, error: String(e?.message || e) }));
    });

  // Auto-connect to stored channel on startup
  settingsStore.getChannel().then((ch) => {
    if (ch) twitchChat.connect(ch).catch(() => {});
  });

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', async () => {
  try {
    await uiServer?.close?.();
  } catch {
    // ignore
  }
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
