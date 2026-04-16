import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('overlayAPI', {
  sendAction: (action: 'stop-analyze' | 'cancel'): void => {
    ipcRenderer.send('overlay-action', action);
  },

  onThemeChange: (cb: (theme: 'light' | 'dark') => void): void => {
    ipcRenderer.on('overlay-theme-change', (_event, theme) => cb(theme));
  },
});
