import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('overlayAPI', {
  sendAction: (action: 'stop-analyze' | 'cancel'): void => {
    ipcRenderer.send('overlay-action', action);
  },
});
