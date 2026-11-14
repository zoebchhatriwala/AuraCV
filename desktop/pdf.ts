import { BrowserWindow } from 'electron';

export async function renderPdf(html: string): Promise<Buffer> {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      javascript: false,
      partition: 'auracv-pdf-export',
    },
  });
  const contents = window.webContents;
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event) => event.preventDefault());
  contents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  contents.session.setPermissionCheckHandler(() => false);
  // Resume markup may contain raw Markdown HTML. Only inline assets and template fonts are needed.
  contents.session.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    const allowed = url.protocol === 'data:' ||
      (url.protocol === 'https:' && ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname));
    callback({ cancel: !allowed });
  });

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const print = async () => {
      await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      // Electron expresses PDF margins in inches; match the web export's 15 mm.
      const margin = 15 / 25.4;
      return contents.printToPDF({
        pageSize: 'A4',
        margins: { top: margin, bottom: margin, left: margin, right: margin },
        printBackground: true,
      });
    };
    return await Promise.race([
      print(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('PDF export timed out. Please try again.')), 30000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
    if (!window.isDestroyed()) window.destroy();
  }
}
