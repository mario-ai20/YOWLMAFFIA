import { supabase } from './supabase';
import { getAppVersion } from './yowl';

let updateState = {
  status: 'idle',
  currentVersion: 'dev',
  latestVersion: 'dev',
  notes: '',
  downloadUrl: '',
  filePath: '',
  message: '',
  progress: 0,
  publishedAt: '',
  isRequired: false
};

const listeners = new Set();
let releaseSubscription = null;
let updateReleaseTableMissing = false;

function compareVersions(left, right) {
  const parse = (value) =>
    String(value || '0.0.0')
      .trim()
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0);

  const a = parse(left);
  const b = parse(right);
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function emitUpdateState() {
  for (const callback of listeners) {
    try {
      callback(updateState);
    } catch (error) {
      // Ignore subscriber failures so one broken listener does not block the rest.
    }
  }
}

function setUpdateState(patch) {
  updateState = { ...updateState, ...patch };
  emitUpdateState();
  return updateState;
}

async function ensureReleaseSubscription() {
  if (!supabase || releaseSubscription || updateReleaseTableMissing) {
    return;
  }

  releaseSubscription = supabase
    .channel('app-update-releases-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_update_releases' }, () => {
      void refreshLatestRelease().catch((error) => {
        setUpdateState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Updatecontrole mislukt.'
        });
      });
    })
    .subscribe();
}

function isMissingUpdateReleaseTableError(error) {
  const message = String(error?.message || error?.error_description || error?.details || '').toLowerCase();
  return (
    message.includes("could not find the table 'public.app_update_releases' in the schema cache") ||
    message.includes('schema cache') ||
    message.includes('relation "public.app_update_releases" does not exist') ||
    message.includes('table "app_update_releases" does not exist') ||
    message.includes('could not find relation')
  );
}

function normalizeLatestRelease(release = null, currentVersion = 'dev') {
  const latestVersion = String(release?.version || '').trim();
  const downloadUrl = String(release?.download_url || '').trim();
  const notes = String(release?.notes || '').trim();
  const publishedAt = String(release?.published_at || release?.created_at || '').trim();
  const isRequired = Boolean(release?.is_required);

  if (!latestVersion || !downloadUrl) {
    throw new Error('De update-release mist version of download_url.');
  }

  if (compareVersions(latestVersion, currentVersion) <= 0) {
    return setUpdateState({
      status: 'up-to-date',
      currentVersion,
      latestVersion: currentVersion,
      downloadUrl: '',
      filePath: '',
      progress: 0,
      notes,
      publishedAt,
      isRequired,
      message: 'Je gebruikt al de nieuwste versie.'
    });
  }

  return setUpdateState({
    status: 'available',
    currentVersion,
    latestVersion,
    downloadUrl,
    filePath: '',
    progress: 0,
    notes,
    publishedAt,
    isRequired,
    message: `Nieuwe update beschikbaar: versie ${latestVersion}.`
  });
}

async function refreshLatestRelease() {
  if (!supabase) {
    return setUpdateState({
      status: 'disabled',
      message: 'Supabase is nog niet geconfigureerd.'
    });
  }

  const currentVersion = await getAppVersion();
  setUpdateState({
    status: 'checking',
    currentVersion,
    latestVersion: currentVersion,
    message: 'Controleren op updates...'
  });

  const { data, error } = await supabase
    .from('app_update_releases')
    .select('version, download_url, notes, is_required, published_at, created_at')
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    if (isMissingUpdateReleaseTableError(error)) {
      updateReleaseTableMissing = true;
      return setUpdateState({
        status: 'idle',
        currentVersion,
        latestVersion: currentVersion,
        downloadUrl: '',
        filePath: '',
        progress: 0,
        notes: '',
        publishedAt: '',
        isRequired: false,
        message: ''
      });
    }

    throw new Error(error.message || 'Updatecontrole via Supabase mislukt.');
  }

  updateReleaseTableMissing = false;

  const release = Array.isArray(data) ? data[0] || null : null;
  if (!release) {
    await ensureReleaseSubscription();
    return setUpdateState({
      status: 'up-to-date',
      currentVersion,
      latestVersion: currentVersion,
      downloadUrl: '',
      filePath: '',
      progress: 0,
      notes: '',
      publishedAt: '',
      isRequired: false,
      message: 'Er is nog geen update gepubliceerd.'
    });
  }

  const normalized = normalizeLatestRelease(release, currentVersion);
  await ensureReleaseSubscription();
  return normalized;
}

export async function getUpdateState() {
  if (updateState.status !== 'idle') {
    return updateState;
  }

  try {
    return await refreshLatestRelease();
  } catch (error) {
    return setUpdateState({
      status: 'error',
      message: error instanceof Error ? error.message : 'Updatecontrole mislukt.'
    });
  }
}

export async function checkForUpdates() {
  try {
    return await refreshLatestRelease();
  } catch (error) {
    return setUpdateState({
      status: 'error',
      message: error instanceof Error ? error.message : 'Updatecontrole mislukt.'
    });
  }
}

export async function downloadUpdate() {
  if (!updateState.downloadUrl) {
    throw new Error('Geen download-url ingesteld voor de update.');
  }

  if (!window.desktop?.downloadUpdate) {
    throw new Error('De desktop bestandslaag is niet beschikbaar.');
  }

  setUpdateState({
    status: 'downloading',
    progress: 0,
    message: 'Update wordt gedownload...'
  });

  try {
    const result = await window.desktop.downloadUpdate({
      downloadUrl: updateState.downloadUrl,
      latestVersion: updateState.latestVersion,
      notes: updateState.notes,
      isRequired: updateState.isRequired
    });

    if (result) {
      setUpdateState(result);
    }

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

export async function installUpdate() {
  if (!window.desktop?.installUpdate) {
    throw new Error('De desktop bestandslaag is niet beschikbaar.');
  }

  try {
    const result = await window.desktop.installUpdate();
    if (result) {
      setUpdateState(result);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Installatie mislukt.';
    setUpdateState({
      status: 'error',
      message
    });
    throw error;
  }
}

export function subscribeToUpdateState(callback) {
  if (typeof callback !== 'function') {
    return () => {};
  }

  listeners.add(callback);
  callback(updateState);

  return () => {
    listeners.delete(callback);
  };
}
