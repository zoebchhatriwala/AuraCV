import { app, BrowserWindow, shell, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let serverProcess: any = null;

// Single instance lock — prevent multiple app instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ─── Environment & Paths ───────────────────────────────────────────────────────
const userDataPath = app.getPath('userData');
process.env.AURACV_DATA_DIR = userDataPath;
process.env.AURACV_DB_PATH = path.join(userDataPath, 'auracv.db');

// Ensure app data directory and custom providers directory exist
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}
const userCustomProvidersDir = path.join(userDataPath, 'providers');
if (!fs.existsSync(userCustomProvidersDir)) {
  fs.mkdirSync(userCustomProvidersDir, { recursive: true });
}

// Resolve bundled providers directory
const providersDir = isDev
  ? path.join(__dirname, '..', 'providers')
  : path.join(process.resourcesPath, 'providers');
if (fs.existsSync(providersDir)) {
  process.env.AURACV_PROVIDERS_DIR = providersDir;
}

// Resolve bundled client dist directory
const clientDistDir = isDev
  ? path.join(__dirname, '..', 'client', 'dist')
  : path.join(process.resourcesPath, 'client', 'dist');
if (fs.existsSync(clientDistDir)) {
  process.env.AURACV_CLIENT_DIST = clientDistDir;
}

const SERVER_PORT = Number(process.env.PORT || 3847);
const DEV_URL = 'http://localhost:5842';
const PROD_URL = `http://localhost:${SERVER_PORT}`;

// ─── Embedded Express Server (Production) ─────────────────────────────────────
async function startProductionServer(): Promise<void> {
  if (isDev) return;

  try {
    // In production, require the compiled server index
    const serverPath = path.join(process.resourcesPath, 'server', 'dist', 'index.js');
    if (fs.existsSync(serverPath)) {
      console.log('[Desktop] Starting embedded server from:', serverPath);
      require(serverPath);
    } else {
      console.warn('[Desktop] Compiled server not found at:', serverPath);
    }
  } catch (err) {
    console.error('[Desktop] Failed to start production server:', err);
  }
}

// Wait for a URL to respond before loading
function waitForServer(url: string, timeoutMs = 25000): Promise<void> {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(url, (res) => {
        resolve();
      }).on('error', () => {
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`));
        } else {
          setTimeout(check, 300);
        }
      });
    };
    check();
  });
}

// ─── Native Application Window ────────────────────────────────────────────────
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 680,
    title: 'AuraCV',
    backgroundColor: '#0b0f19',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    icon: path.join(__dirname, '..', 'client', 'public', 'icon.png'),
    show: false, // Show once ready-to-show to prevent white flash
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Open external links (e.g. portfolio, github, documentation) in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const targetUrl = isDev ? DEV_URL : PROD_URL;

  try {
    if (isDev) {
      await waitForServer(targetUrl, 15000);
    }
    await mainWindow.loadURL(targetUrl);
  } catch (err) {
    console.warn('[Desktop] Direct load failed, retrying loadURL:', err);
    await mainWindow.loadURL(targetUrl);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── Application Menu ─────────────────────────────────────────────────────────
function setupMenu() {
  const isMac = process.platform === 'darwin';
  const template: any[] = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' },
          ],
        }]
      : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(isDev ? [{ role: 'toggleDevTools' }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  setupMenu();
  await startProductionServer();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
