import { contextBridge, ipcRenderer } from 'electron';

// renderer process에서 window.electronBridge 로 접근 가능
contextBridge.exposeInMainWorld('electronBridge', {
  openFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFolder'),
  openFile: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFile'),
  isElectron: true,
});
