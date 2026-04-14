import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('parrotAPI', {
  getSources: () => ipcRenderer.invoke('get-sources'),
});
