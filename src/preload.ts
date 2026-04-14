import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('parrotAPI', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  saveRecording: (buffer: ArrayBuffer) => ipcRenderer.invoke('save-recording', buffer),
});
