const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fg', {
  call: (type, payload) => ipcRenderer.invoke('fg:call', type, payload || {}),
  onState: (cb) => ipcRenderer.on('fg:state', (_e, data) => cb(data)),
  onShown: (cb) => ipcRenderer.on('fg:shown', (_e, data) => cb(data))
});
