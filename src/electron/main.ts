import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.CODEFORGE_ELECTRON = '1';

let mainWindow: BrowserWindow | null = null;
let _shutdownServer: (() => void) | null = null;

function getActiveWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
}

async function applyFixPath() {
  try {
    const fixPath = (await import('fix-path')).default;
    fixPath();
  } catch {
    // tryKnownPaths() fallback handles this
  }
}

async function createWindow(port: number) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'CodeForge Blueprint',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.platform !== 'darwin') {
    mainWindow.setMenuBarVisibility(false);
  }

  await mainWindow.loadURL(`http://localhost:${port}`);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

ipcMain.handle('dialog:openFolder', async () => {
  const win = getActiveWindow();
  const result = win
    ? await dialog.showOpenDialog(win, { properties: ['openDirectory'], title: '워크스페이스 폴더 선택' })
    : await dialog.showOpenDialog({ properties: ['openDirectory'], title: '워크스페이스 폴더 선택' });
  return result.canceled ? null : (result.filePaths[0] ?? null);
});

ipcMain.handle('dialog:openFile', async () => {
  const win = getActiveWindow();
  const opts = { properties: ['openFile' as const], title: '기획서 파일 선택', filters: [{ name: 'Markdown/Text', extensions: ['md', 'txt'] }] };
  const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
  return result.canceled ? null : (result.filePaths[0] ?? null);
});

async function main() {
  process.env.CODEFORGE_APP_DATA_DIR = app.getPath('userData');

  await Promise.all([applyFixPath(), migrateAppData()]);

  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  await app.whenReady();

  const { startServer } = await import('../server/index.js');
  const { shutdownServer } = await import('../server/index.js');
  const port = await startServer(0);
  _shutdownServer = shutdownServer;

  await createWindow(port);

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow(port);
    }
  });
}

app.on('before-quit', () => {
  _shutdownServer?.();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function migrateAppData(): Promise<void> {
  return new Promise((resolve) => {
    const legacyDir = path.join(os.homedir(), '.codeforge-blueprint');
    const newDir = process.env.CODEFORGE_APP_DATA_DIR!;

    if (legacyDir === newDir || !fs.existsSync(legacyDir) || fs.existsSync(path.join(newDir, 'app.db'))) {
      return resolve();
    }

    try {
      fs.mkdirSync(newDir, { recursive: true });
      const legacyDb = path.join(legacyDir, 'app.db');
      if (fs.existsSync(legacyDb)) {
        fs.copyFileSync(legacyDb, path.join(newDir, 'app.db'));
      }
    } catch {
      // 빈 DB로 새로 시작
    }
    resolve();
  });
}

main().catch((err) => {
  console.error('[Electron] 시작 실패:', err);
  app.quit();
});
