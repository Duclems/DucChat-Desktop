// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

// Minimal preload so the bundle isn't empty.
// You can expose a safe API to the renderer here later.
contextBridge.exposeInMainWorld('app', {
  version: process.env.npm_package_version,
  minimizeToTray: () => ipcRenderer.invoke('app:minimizeToTray'),
  restoreFromTray: () => ipcRenderer.invoke('app:restoreFromTray'),
});

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
});

contextBridge.exposeInMainWorld('twitch', {
  getChannel: () => ipcRenderer.invoke('twitch:getChannel'),
  setChannel: (channel) => ipcRenderer.invoke('twitch:setChannel', channel),
  disconnect: () => ipcRenderer.invoke('twitch:disconnect'),
  onMessage: (callback) => {
    const listener = (_event, msg) => callback(msg);
    ipcRenderer.on('twitch:message', listener);
    return () => ipcRenderer.removeListener('twitch:message', listener);
  },
  onStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('twitch:status', listener);
    return () => ipcRenderer.removeListener('twitch:status', listener);
  },
});

contextBridge.exposeInMainWorld('ui', {
  getUrls: () => ipcRenderer.invoke('ui:getUrls'),
});

contextBridge.exposeInMainWorld('pseudos', {
  getConfig: () => ipcRenderer.invoke('pseudos:getConfig'),
  setConfig: (config) => ipcRenderer.invoke('pseudos:setConfig', config),
  onConfig: (callback) => {
    const listener = (_event, cfg) => callback(cfg);
    ipcRenderer.on('pseudos:config', listener);
    return () => ipcRenderer.removeListener('pseudos:config', listener);
  },
});
