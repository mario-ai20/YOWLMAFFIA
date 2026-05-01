import { supabase } from './supabase';

let infoState = {
  status: 'idle',
  title: '',
  body: '',
  isActive: false,
  publishedAt: '',
  updatedAt: '',
  message: ''
};

const listeners = new Set();
let infoSubscription = null;
let infoTableMissing = false;

function emitInfoState() {
  for (const callback of listeners) {
    try {
      callback(infoState);
    } catch (error) {
      // Ignore broken subscribers so one listener does not block the rest.
    }
  }
}

function setInfoState(patch) {
  infoState = { ...infoState, ...patch };
  emitInfoState();
  return infoState;
}

function isMissingInfoTableError(error) {
  const message = String(error?.message || error?.error_description || error?.details || '').toLowerCase();
  return (
    message.includes("could not find the table 'public.app_info_blocks' in the schema cache") ||
    message.includes('schema cache') ||
    message.includes('relation "public.app_info_blocks" does not exist') ||
    message.includes('table "app_info_blocks" does not exist') ||
    message.includes('could not find relation')
  );
}

function normalizeInfoBlock(row = null) {
  const title = String(row?.title || '').trim();
  const body = String(row?.body || '').trim();
  const isActive = Boolean(row?.is_active);
  const publishedAt = String(row?.published_at || row?.created_at || '').trim();
  const updatedAt = String(row?.updated_at || row?.published_at || row?.created_at || '').trim();

  if (!title || !body || !isActive) {
    return setInfoState({
      status: 'idle',
      title: '',
      body: '',
      isActive: false,
      publishedAt,
      updatedAt,
      message: ''
    });
  }

  return setInfoState({
    status: 'available',
    title,
    body,
    isActive,
    publishedAt,
    updatedAt,
    message: ''
  });
}

async function ensureInfoSubscription() {
  if (!supabase || infoSubscription || infoTableMissing) {
    return;
  }

  infoSubscription = supabase
    .channel('app-info-block-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_info_blocks' }, () => {
      void refreshInfoBlock().catch((error) => {
        setInfoState({
          status: 'idle',
          message: error instanceof Error ? error.message : ''
        });
      });
    })
    .subscribe();
}

async function refreshInfoBlock() {
  if (!supabase) {
    return setInfoState({
      status: 'idle',
      message: ''
    });
  }

  const { data, error } = await supabase
    .from('app_info_blocks')
    .select('id, title, body, is_active, published_at, created_at, updated_at')
    .eq('id', 'current')
    .maybeSingle();

  if (error) {
    if (isMissingInfoTableError(error)) {
      infoTableMissing = true;
      return setInfoState({
        status: 'idle',
        title: '',
        body: '',
        isActive: false,
        publishedAt: '',
        updatedAt: '',
        message: ''
      });
    }

    throw new Error(error.message || 'Info ophalen mislukt.');
  }

  infoTableMissing = false;

  if (!data) {
    await ensureInfoSubscription();
    return setInfoState({
      status: 'idle',
      title: '',
      body: '',
      isActive: false,
      publishedAt: '',
      updatedAt: '',
      message: ''
    });
  }

  const normalized = normalizeInfoBlock(data);
  await ensureInfoSubscription();
  return normalized;
}

export async function getInfoState() {
  if (infoState.status !== 'idle') {
    return infoState;
  }

  try {
    return await refreshInfoBlock();
  } catch (error) {
    return setInfoState({
      status: 'idle',
      message: error instanceof Error ? error.message : ''
    });
  }
}

export async function checkForInfoBlock() {
  try {
    return await refreshInfoBlock();
  } catch (error) {
    return setInfoState({
      status: 'idle',
      message: error instanceof Error ? error.message : ''
    });
  }
}

export function subscribeToInfoState(callback) {
  listeners.add(callback);

  return () => {
    listeners.delete(callback);
  };
}
