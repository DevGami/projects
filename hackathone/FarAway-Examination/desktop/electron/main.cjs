/**
 * FortisExam Desktop — Electron Main Process
 *
 * Kiosk-mode BrowserWindow with maximum security hardening:
 * - Full kiosk mode (no frame, no taskbar, always on top)
 * - Blocks ALL system shortcuts: Alt+F4, Alt+Tab, Win key, F12, etc.
 * - Prevents window close except via explicit app.quit()
 * - Blocks navigation, new windows, and devtools
 */

const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    // ── Kiosk Mode ──────────────────────────────────────────
    kiosk: true,
    fullscreen: true,
    fullscreenable: true,
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    alwaysOnTop: true,          // Stay above taskbar/other windows
    skipTaskbar: false,

    // ── Security ─────────────────────────────────────────────
    closable: false,            // Disable the OS close button
    minimizable: false,         // Disable minimize

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      devTools: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  // ── Load React App ────────────────────────────────────────
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5174');
    // Only allow devtools in explicit dev mode via env flag
    if (process.env.FORTIS_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // ── Block Navigation ──────────────────────────────────────
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  // ── Force Fullscreen & Kiosk on Load ──────────────────────
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.setFullScreen(true);
    mainWindow.setKiosk(true);
    mainWindow.show();
  });

  // ── Block New Windows ─────────────────────────────────────
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // ── Prevent Window Close via OS (e.g. Alt+F4 reaches close event) ──
  mainWindow.on('close', (event) => {
    // Only allow quit if app is explicitly exiting (via app.quit())
    if (!app.isQuiting) {
      event.preventDefault();
      // Re-focus window in case it lost focus
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true);
    }
  });

  // ── Restore fullscreen if minimized/lost ─────────────────
  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(true);
    }
  });

  mainWindow.on('minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  // ── Mark app as NOT quiting by default ───────────────────
  app.isQuiting = false;
  createWindow();

  // ── Block ALL critical system shortcuts ──────────────────
  const blocked = [
    // DevTools / Debug
    'CommandOrControl+Shift+I',
    'CommandOrControl+Shift+J',
    'CommandOrControl+Shift+C',
    'CommandOrControl+U',
    'F12',

    // Window management
    'CommandOrControl+W',
    'CommandOrControl+Q',
    'CommandOrControl+R',
    'CommandOrControl+Shift+R',
    'CommandOrControl+F5',
    'F5',
    'Alt+F4',

    // Task switching (Windows)
    'Alt+Tab',
    'Alt+Shift+Tab',
    'Super+D',
    'Super+Tab',
    'Super+L',            // Lock screen
    'Super+R',            // Run dialog
    'Super+E',            // File Explorer
    'Super+M',            // Minimize all
    'Control+Escape',     // Start menu
    'Alt+F10',

    // Screenshots
    'PrintScreen',
    'Alt+PrintScreen',
    'Super+PrintScreen',
    'Super+Shift+S',

    // Clipboard
    'CommandOrControl+C',
    'CommandOrControl+X',
    'CommandOrControl+V',
    'CommandOrControl+A',
  ];

  blocked.forEach(shortcut => {
    try {
      globalShortcut.register(shortcut, () => {
        // Swallow silently — anomaly is reported via the renderer process
        mainWindow?.webContents.send('anomaly-shortcut', shortcut);
      });
    } catch (e) {
      // Some shortcuts may not be registerable on all platforms
    }
  });

  // ── Register Supervisor Close Shortcut ─────────────────────
  const triggerClose = () => mainWindow?.webContents.send('trigger-supervisor-close');
  globalShortcut.register('CommandOrControl+Shift+L', triggerClose);
  globalShortcut.register('CommandOrControl+Shift+X', triggerClose);
  globalShortcut.register('CommandOrControl+Shift+Q', triggerClose);

  // ── IPC Handlers ───────────────────────────────────────────
  ipcMain.on('system:close-app', () => {
    app.isQuiting = true;
    app.quit();
  });
});

// ── Intercept quit — only allow programmatic quit ─────────
app.on('before-quit', () => {
  app.isQuiting = true;
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  app.quit();
});

// ── Prevent second instance ───────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
