import { contextBridge, ipcRenderer } from 'electron';

// Expose safe desktop environment info and capabilities to renderer
contextBridge.exposeInMainWorld('auraDesktop', {
  isDesktop: true,
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0',
});
