import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage } from 'electron';
import path from 'node:path';
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

function getTrayIcon() {
  // Tiny 1x1 PNG (opaque) - Electron will scale it for the tray.
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

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 500,
    height: 500,
    minWidth: 500,
    minHeight: 500,
    autoHideMenuBar: true,
    frame: false,
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
