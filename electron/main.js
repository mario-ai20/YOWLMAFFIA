const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs/promises');
const { createWriteStream } = require('node:fs');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');
const { createClient } = require('@supabase/supabase-js');
const { encryptYowl, decryptYowl } = require('./yowlCodec');

const isDev = !app.isPackaged;
const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
const yowlSecret = process.env.YOWL_FILE_SECRET || 'YOWLMAFFIA-local-encryption-secret';
const appIconPath = isDev
  ? path.join(__dirname, '..', 'build', 'icon.png')
  : path.join(process.resourcesPath, 'build', 'icon.png');

app.setName('YOWLMAFFIA');
app.setAppUserModelId('com.yowlmaffia.portal');

let mainWindow = null;
let autoUpdaterConfigured = false;
let updateState = {
  status: isDev ? 'dev' : 'idle',
  currentVersion: app.getVersion(),
  latestVersion: app.getVersion(),
  notes: '',
  downloadUrl: '',
  filePath: '',
  message: 'Updates worden via de app gecontroleerd.',
  progress: 0
};

async function waitForServer(url, attempts = 80, delayMs = 250) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) {
        return;
      }
    } catch (error) {
      // Ignore and retry while Vite is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

function sendUpdateState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updates:state', updateState);
  }
}

function setUpdateState(patch) {
  updateState = { ...updateState, ...patch };
  sendUpdateState();
}

function configureAutoUpdater() {
  if (autoUpdaterConfigured || !app.isPackaged) {
    return;
  }

  autoUpdaterConfigured = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.autoRunAppAfterInstall = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.logger = console;

  autoUpdater.on('checking-for-update', () => {
    setUpdateState({
      status: 'checking',
      currentVersion: app.getVersion(),
      latestVersion: updateState.latestVersion || app.getVersion(),
      message: 'Controleren op GitHub Releases...'
    });
  });

  autoUpdater.on('update-available', (info) => {
    const latestVersion = String(info?.version || app.getVersion()).trim();
    setUpdateState({
      status: 'available',
      currentVersion: app.getVersion(),
      latestVersion,
      progress: 0,
      filePath: '',
      message: `Nieuwe update beschikbaar: versie ${latestVersion}.`
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    const percentage = Math.max(0, Math.min(100, Math.round(Number(progress?.percent || 0))));
    setUpdateState({
      status: 'downloading',
      progress: percentage,
      message: `Update wordt gedownload... ${percentage}%`
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    const latestVersion = String(info?.version || updateState.latestVersion || app.getVersion()).trim();
    setUpdateState({
      status: 'ready',
      currentVersion: app.getVersion(),
      latestVersion,
      progress: 100,
      message: 'Update is klaar om te installeren.'
    });

    if (updateState.isRequired) {
      setTimeout(() => {
        if (!mainWindow || mainWindow.isDestroyed()) {
          return;
        }

        setUpdateState({
          status: 'installing',
          message: 'Verplichte update wordt nu geïnstalleerd...'
        });

        try {
          autoUpdater.quitAndInstall(false, true);
        } catch (error) {
          setUpdateState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Automatische installatie mislukt.'
          });
        }
      }, 1200);
    }
  });

  autoUpdater.on('update-not-available', () => {
    setUpdateState({
      status: 'up-to-date',
      currentVersion: app.getVersion(),
      latestVersion: app.getVersion(),
      progress: 0,
      message: 'Je gebruikt al de nieuwste versie.'
    });
  });

  autoUpdater.on('error', (error) => {
    setUpdateState({
      status: 'error',
      message: error instanceof Error ? error.message : 'Updatecontrole via GitHub mislukt.'
    });
  });
}

function isGithubHost(hostname = '') {
  const lower = String(hostname || '').toLowerCase();
  return lower === 'github.com' || lower === 'www.github.com' || lower === 'api.github.com';
}

function isDirectDownloadUrl(url) {
  return /\.(exe|msi|zip|dmg|pkg)(\?|#|$)/i.test(String(url || ''));
}

function extractGithubReleaseInfo(inputUrl) {
  const parsed = new URL(inputUrl);
  const pathParts = parsed.pathname.split('/').filter(Boolean);

  if (parsed.hostname === 'api.github.com') {
    if (pathParts[0] === 'repos' && pathParts[3] === 'releases') {
      const owner = pathParts[1];
      const repo = pathParts[2];
      const kind = pathParts[4];
      const value = pathParts.slice(5).join('/');
      if (owner && repo && (kind === 'latest' || (kind === 'tags' && value))) {
        return { owner, repo, tag: kind === 'tags' ? value : 'latest' };
      }
    }
    return null;
  }

  if (!isGithubHost(parsed.hostname)) {
    return null;
  }

  if (pathParts.length < 4 || pathParts[2] !== 'releases') {
    return null;
  }

  const owner = pathParts[0];
  const repo = pathParts[1];
  const kind = pathParts[3];
  const value = pathParts.slice(4).join('/');

  if (!owner || !repo) {
    return null;
  }

  if (kind === 'latest') {
    return { owner, repo, tag: 'latest' };
  }

  if (kind === 'tag' && value) {
    return { owner, repo, tag: value };
  }

  return null;
}

function pickGithubReleaseAsset(release) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  if (!assets.length) {
    return '';
  }

  const preferredAsset =
    assets.find((asset) => /\.exe$/i.test(String(asset?.name || '')) && /yowlmaffia/i.test(String(asset?.name || ''))) ||
    assets.find((asset) => /\.exe$/i.test(String(asset?.name || ''))) ||
    assets.find((asset) => String(asset?.browser_download_url || '').trim());

  return String(preferredAsset?.browser_download_url || '').trim();
}

async function resolveGithubReleaseDownloadUrl(downloadUrl) {
  const trimmed = String(downloadUrl || '').trim();
  if (!trimmed || isDirectDownloadUrl(trimmed)) {
    return trimmed;
  }

  const releaseInfo = extractGithubReleaseInfo(trimmed);
  if (!releaseInfo) {
    return trimmed;
  }

  const apiUrl =
    releaseInfo.tag === 'latest'
      ? `https://api.github.com/repos/${releaseInfo.owner}/${releaseInfo.repo}/releases/latest`
      : `https://api.github.com/repos/${releaseInfo.owner}/${releaseInfo.repo}/releases/tags/${encodeURIComponent(releaseInfo.tag)}`;

  const response = await fetch(apiUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'YOWLMAFFIA'
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub release kon niet worden opgehaald (${response.status}).`);
  }

  const release = await response.json();
  const assetUrl = pickGithubReleaseAsset(release);

  if (!assetUrl) {
    throw new Error('Geen downloadbaar .exe-bestand gevonden in deze GitHub release.');
  }

  return assetUrl;
}

function createStorageClient({ supabaseUrl, supabaseAnonKey, accessToken }) {
  const url = String(supabaseUrl || '').trim();
  const anonKey = String(supabaseAnonKey || '').trim();
  const token = String(accessToken || '').trim();

  if (!url || !anonKey) {
    throw new Error('Supabase is niet geconfigureerd.');
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }
  });
}

async function checkForUpdates() {
  if (!app.isPackaged) {
    setUpdateState({
      status: 'dev',
      currentVersion: app.getVersion(),
      latestVersion: app.getVersion(),
      message: 'Updates zijn uitgeschakeld in development.'
    });
    return updateState;
  }

  configureAutoUpdater();
  setUpdateState({
    status: 'checking',
    currentVersion: app.getVersion(),
    latestVersion: app.getVersion(),
    message: 'Controleren op GitHub Releases...'
  });

  try {
    await autoUpdater.checkForUpdates();
    return updateState;
  } catch (error) {
    setUpdateState({
      status: 'error',
      message: error instanceof Error ? error.message : 'Updatecontrole via GitHub mislukt.'
    });
    throw error;
  }
}

async function downloadUpdate(payload = {}) {
  const downloadUrl = String(payload?.downloadUrl || updateState.downloadUrl || '').trim();
  const latestVersion = String(payload?.latestVersion || updateState.latestVersion || app.getVersion()).trim();
  const notes = String(payload?.notes || updateState.notes || '').trim();
  const isRequired = Boolean(payload?.isRequired || updateState.isRequired);

  if (!app.isPackaged) {
    throw new Error('Updates zijn niet beschikbaar in development.');
  }

  configureAutoUpdater();

  if (!downloadUrl || !isDirectDownloadUrl(downloadUrl)) {
    setUpdateState({
      status: 'downloading',
      progress: 0,
      currentVersion: app.getVersion(),
      latestVersion,
      notes,
      downloadUrl,
      isRequired,
      message: 'Update wordt opgehaald van GitHub Releases...'
    });

    try {
      await autoUpdater.checkForUpdates();
      return updateState;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Download mislukt.';
      setUpdateState({
        status: 'error',
        message
      });
      throw error;
    }
  }

  setUpdateState({
    status: 'downloading',
    progress: 0,
    currentVersion: app.getVersion(),
    latestVersion,
    notes,
    downloadUrl,
    isRequired,
    message: 'Update wordt gedownload...'
  });

  const resolvedDownloadUrl = await resolveGithubReleaseDownloadUrl(downloadUrl);
  const response = await fetch(resolvedDownloadUrl, { cache: 'no-store' });
  if (!response.ok || !response.body) {
    throw new Error(`Update kon niet worden gedownload (${response.status}).`);
  }

  const targetDir = path.join(app.getPath('temp'), 'yowlmaffia-updates');
  await fs.mkdir(targetDir, { recursive: true });

  const fileName = `YOWLMAFFIA-${latestVersion || app.getVersion()}-Setup.exe`;
  const filePath = path.join(targetDir, fileName);
  const writeStream = createWriteStream(filePath);
  await pipeline(Readable.fromWeb(response.body), writeStream);

  setUpdateState({
    status: 'ready',
    currentVersion: app.getVersion(),
    latestVersion,
    notes,
    downloadUrl: resolvedDownloadUrl,
    filePath,
    progress: 100,
    message: 'Update is klaar om te installeren.'
  });

  return updateState;
}

async function installUpdate() {
  if (updateState.filePath) {
    await fs.access(updateState.filePath);
    setUpdateState({
      status: 'installing',
      message: 'Installer wordt gestart...'
    });

    const child = spawn(updateState.filePath, [], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();

    setTimeout(() => {
      app.quit();
    }, 500);

    return { ok: true };
  }

  if (!app.isPackaged) {
    throw new Error('Updates zijn niet beschikbaar in development.');
  }

  configureAutoUpdater();
  setUpdateState({
    status: 'installing',
    message: 'Update wordt geïnstalleerd...'
  });
  autoUpdater.quitAndInstall(false, true);
  return { ok: true };
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1220,
    minHeight: 820,
    fullscreen: true,
    kiosk: true,
    frame: false,
    thickFrame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    title: 'YOWLMAFFIA',
    icon: appIconPath,
    backgroundColor: '#090b14',
    autoHideMenuBar: true,
    show: false,
    fullscreenable: false,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: false
    }
  });

  try {
    mainWindow.setIcon(appIconPath);
  } catch (error) {
    // Windows sometimes ignores late icon updates, so we keep the startup icon path authoritative.
  }

  mainWindow.setMenuBarVisibility(false);
  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setFullScreen(true);
      mainWindow.setKiosk(true);
      mainWindow.maximize();
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      mainWindow.show();
    }
  });
  mainWindow.on('leave-full-screen', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setFullScreen(true);
      mainWindow.setKiosk(true);
      mainWindow.maximize();
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  });
  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setFullScreen(true);
      mainWindow.setKiosk(true);
      mainWindow.maximize();
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  });
  mainWindow.on('maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setFullScreen(true);
      mainWindow.setKiosk(true);
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  });
  mainWindow.on('blur', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setFullScreen(true);
      mainWindow.setKiosk(true);
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  });
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const isDevtoolsShortcut =
      input.key === 'F12' ||
      (input.control && input.shift && ['I', 'J', 'C'].includes(String(input.key || '').toUpperCase()));

    if (isDevtoolsShortcut) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.on('devtools-opened', () => {
    mainWindow.webContents.closeDevTools();
  });

  if (isDev) {
    await waitForServer(devUrl);
    await mainWindow.loadURL(devUrl);
  } else {
    await mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }

  sendUpdateState();
}

app.on('browser-window-created', (_event, window) => {
  window.setMenuBarVisibility(false);
  window.webContents.on('before-input-event', (event, input) => {
    const isDevtoolsShortcut =
      input.key === 'F12' ||
      (input.control && input.shift && ['I', 'J', 'C'].includes(String(input.key || '').toUpperCase()));

    if (isDevtoolsShortcut) {
      event.preventDefault();
    }
  });

  window.webContents.on('devtools-opened', () => {
    window.webContents.closeDevTools();
  });
});

ipcMain.handle('app:get-version', () => app.getVersion());
ipcMain.handle('updates:get-state', () => updateState);
ipcMain.handle('updates:check', async () => checkForUpdates());
ipcMain.handle('updates:download', async (_, payload) => downloadUpdate(payload));
ipcMain.handle('updates:install', async () => installUpdate());

ipcMain.handle('storage:upload', async (_, payload = {}) => {
  const client = createStorageClient(payload);
  const bucket = String(payload.bucket || '').trim();
  const objectPath = String(payload.path || '').trim();
  const contentType = String(payload.contentType || 'application/octet-stream').trim() || 'application/octet-stream';
  const upsert = Boolean(payload.upsert);
  const filePath = String(payload.filePath || '').trim();
  const bytes = payload.bytes instanceof Uint8Array ? payload.bytes : new Uint8Array(payload.bytes || []);

  if (!bucket || !objectPath || (!filePath && !bytes.length)) {
    throw new Error('Uploadgegevens ontbreken.');
  }

  const uploadBody = filePath ? await fs.readFile(filePath) : Buffer.from(bytes);

  const { data, error } = await client.storage.from(bucket).upload(objectPath, uploadBody, {
    contentType,
    upsert
  });

  if (error) {
    throw error;
  }

  const finalPath = data?.path || objectPath;
  return {
    path: finalPath,
    url: client.storage.from(bucket).getPublicUrl(finalPath).data.publicUrl
  };
});

ipcMain.handle('storage:list', async (_, payload = {}) => {
  const client = createStorageClient(payload);
  const bucket = String(payload.bucket || '').trim();
  const folder = String(payload.folder || '').trim();
  const options = payload.options && typeof payload.options === 'object' ? payload.options : {};

  if (!bucket || !folder) {
    throw new Error('Lijstgegevens ontbreken.');
  }

  const { data, error } = await client.storage.from(bucket).list(folder, options);
  if (error) {
    throw error;
  }

  return data || [];
});

ipcMain.handle('storage:remove', async (_, payload = {}) => {
  const client = createStorageClient(payload);
  const bucket = String(payload.bucket || '').trim();
  const paths = Array.isArray(payload.paths) ? payload.paths.filter(Boolean) : [];

  if (!bucket || !paths.length) {
    throw new Error('Verwijdergegevens ontbreken.');
  }

  const { data, error } = await client.storage.from(bucket).remove(paths);
  if (error) {
    throw error;
  }

  return { deleted: true, paths: data || paths };
});

ipcMain.handle('shell:open-external', async (_, url) => {
  if (typeof url !== 'string' || !url.trim()) {
    return { ok: false };
  }

  await shell.openExternal(url);
  return { ok: true };
});

ipcMain.handle('yowl:export', async (_, payload) => {
  const title = typeof payload?.title === 'string' && payload.title.trim() ? payload.title.trim() : 'untitled';
  const defaultPath = `${title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 60) || 'untitled'}.yowl`;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Exporteren als .yowl',
    defaultPath,
    filters: [{ name: 'YOWL files', extensions: ['yowl'] }]
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  const buffer = encryptYowl(payload, yowlSecret);
  await fs.writeFile(result.filePath, buffer);
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle('yowl:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Importeer .yowl',
    properties: ['openFile'],
    filters: [{ name: 'YOWL files', extensions: ['yowl'] }]
  });

  if (result.canceled || !result.filePaths?.length) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  const buffer = await fs.readFile(filePath);
  const payload = decryptYowl(buffer, yowlSecret);
  return { canceled: false, filePath, payload };
});

app.whenReady().then(async () => {
  await createWindow();

  if (app.isPackaged) {
    configureAutoUpdater();
    void checkForUpdates().catch((error) => {
      setUpdateState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Updatecontrole via GitHub mislukt.'
      });
    });
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
