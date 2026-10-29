import { app, BrowserWindow, shell, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let activeServerUrl = '';

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
process.env.AURACV_EMBEDDED = '1';

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

// Resolve bundled schema.sql
const schemaPath = isDev
  ? path.join(__dirname, '..', 'server', 'src', 'db', 'schema.sql')
  : path.join(process.resourcesPath, 'server', 'schema.sql');
if (fs.existsSync(schemaPath)) {
  process.env.AURACV_SCHEMA_PATH = schemaPath;
}

// Resolve bundled templates directory
const templatesDir = isDev
  ? path.join(__dirname, '..', 'server', 'src', 'templates')
  : path.join(process.resourcesPath, 'server', 'templates');
if (fs.existsSync(templatesDir)) {
  process.env.AURACV_TEMPLATES_DIR = templatesDir;
}

const DEV_URL = 'http://localhost:5842';

// ─── Helper: Port & Service Check ─────────────────────────────────────────────
function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        tester.once('close', () => resolve(true)).close();
      })
      .listen(port, '127.0.0.1');
  });
}

function checkAuraCvHealth(url: string, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`${url}/api/health`, { timeout: timeoutMs }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function findAvailablePort(startPort: number, maxAttempts = 10): Promise<number> {
  for (let p = startPort; p < startPort + maxAttempts; p++) {
    const free = await checkPortAvailable(p);
    if (free) return p;
  }
  return startPort;
}

// ─── Embedded Express Server (Production) ─────────────────────────────────────
async function startProductionServer(): Promise<string> {
  if (isDev) {
    return DEV_URL;
  }

  const defaultPort = Number(process.env.PORT || 3847);
  let chosenPort = defaultPort;

  // 1. Check if an AuraCV backend is already healthy on default port (e.g. background service)
  const isHealthy = await checkAuraCvHealth(`http://localhost:${defaultPort}`);
  if (isHealthy) {
    console.log(`[Desktop] Reusing existing healthy AuraCV service on port ${defaultPort}`);
    return `http://localhost:${defaultPort}`;
  }

  // 2. If port is occupied by another application, find a free port
  const portFree = await checkPortAvailable(defaultPort);
  if (!portFree) {
    chosenPort = await findAvailablePort(defaultPort + 1);
    console.log(`[Desktop] Port ${defaultPort} was in use; selected port ${chosenPort} instead`);
  }

  process.env.PORT = String(chosenPort);

  try {
    const candidates = [
      path.join(process.resourcesPath, 'server', 'dist', 'index.js'),
      path.join(__dirname, '..', 'server', 'dist', 'index.js'),
    ];
    const serverPath = candidates.find((c) => fs.existsSync(c));

    if (serverPath) {
      console.log('[Desktop] Starting embedded server from:', serverPath, `on port ${chosenPort}`);
      require(serverPath);
    } else {
      console.warn('[Desktop] Compiled server not found in candidates:', candidates);
    }
  } catch (err) {
    console.error('[Desktop] Failed to start production server:', err);
  }

  return `http://localhost:${chosenPort}`;
}

// Wait for a URL and backend health to respond before loading
function waitForServer(url: string, timeoutMs = 25000): Promise<void> {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      // Check health endpoint to ensure SQLite and routes are ready
      const healthUrl = isDev ? 'http://localhost:3847/api/health' : `${url}/api/health`;
      const req = http.get(healthUrl, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else if (Date.now() - startTime > timeoutMs) {
          // If timeout reached, proceed anyway to allow fallback error page
          resolve();
        } else {
          setTimeout(check, 300);
        }
      });
      req.on('error', () => {
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

  const targetUrl = activeServerUrl || (isDev ? DEV_URL : 'http://localhost:3847');

  try {
    await waitForServer(targetUrl, isDev ? 15000 : 25000);
    await mainWindow.loadURL(targetUrl);
  } catch (err) {
    console.error('[Desktop] Failed to load server URL:', err);
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>AuraCV - Service Unavailable</title>
          <style>
            body {
              margin: 0;
              padding: 40px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              background-color: #0b0f19;
              color: #f3f4f6;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 85vh;
              text-align: center;
            }
            .card {
              background: #111827;
              border: 1px solid #1f2937;
              border-radius: 12px;
              padding: 32px;
              max-width: 540px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            }
            h1 { font-size: 20px; color: #f87171; margin-top: 0; }
            p { color: #9ca3af; font-size: 14px; line-height: 1.6; }
            code { background: #1f2937; color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-size: 13px; word-break: break-all; }
            .btn {
              margin-top: 20px;
              padding: 10px 20px;
              background: #6366f1;
              color: white;
              border: none;
              border-radius: 8px;
              font-weight: 600;
              cursor: pointer;
            }
            .btn:hover { background: #4f46e5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>AuraCV Service Unavailable</h1>
            <p>Could not connect to the local server at <code>${targetUrl}</code>.</p>
            <p style="font-size: 12px; color: #ef4444;">${err instanceof Error ? err.message : String(err)}</p>
            <button class="btn" onclick="location.reload()">Retry Connection</button>
          </div>
        </body>
      </html>
    `;
    await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
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
  activeServerUrl = await startProductionServer();
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
