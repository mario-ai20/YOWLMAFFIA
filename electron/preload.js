const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  exportYowl: (payload) => ipcRenderer.invoke('yowl:export', payload),
  importYowl: () => ipcRenderer.invoke('yowl:import'),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),
  getUpdateState: () => ipcRenderer.invoke('updates:get-state'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  downloadUpdate: (payload) => ipcRenderer.invoke('updates:download', payload),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  onUpdateState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('updates:state', listener);
    return () => ipcRenderer.removeListener('updates:state', listener);
  },
  uploadStorageFile: (payload) => ipcRenderer.invoke('storage:upload', payload),
  listStorageFiles: (payload) => ipcRenderer.invoke('storage:list', payload),
  removeStorageFiles: (payload) => ipcRenderer.invoke('storage:remove', payload)
});
