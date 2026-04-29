import { createDefaultCoverDataUrl } from './defaultCover';

function cleanPathSegment(value) {
  return String(value || '')
    .trim()
    .replaceAll('\\', '/')
    .split('/')
    .filter(Boolean)
    .join('/');
}

export function getFileStem(path) {
  const cleanPath = cleanPathSegment(path);
  const fileName = cleanPath.split('/').pop() || cleanPath;
  return fileName.replace(/\.[^.]+$/, '');
}

export function formatDisplayTitle(name) {
  const stem = getFileStem(name);
  return stem
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Untitled';
}

export function guessCoverCandidates(path) {
  const stem = getFileStem(path);
  return [
    `covers/${stem}.jpg`,
    `covers/${stem}.jpeg`,
    `covers/${stem}.png`,
    `covers/${stem}.webp`,
    `covers/${stem}.avif`
  ];
}

export function createAudioTrackFromStorageItem(item, coverUrl) {
  return {
    id: item.id || `${item.name}-${item.created_at || ''}`,
    name: item.name,
    title: formatDisplayTitle(item.name),
    path: item.fullPath || item.name,
    url: item.publicUrl,
    mimeType: item.metadata?.mimetype || item.metadata?.mime_type || 'audio/mpeg',
    size: item.metadata?.size || item.metadata?.contentLength || 0,
    coverUrl: coverUrl || createDefaultCoverDataUrl(formatDisplayTitle(item.name), 'audio')
  };
}

export function normalizeStorageItem(item, prefix = '') {
  const folderPath = cleanPathSegment(prefix);
  const filePath = folderPath ? `${folderPath}/${item.name}` : item.name;
  return {
    ...item,
    fullPath: filePath
  };
}

export async function listBucketObjects(supabase, bucket, prefix = '') {
  const items = [];
  const normalizedPrefix = cleanPathSegment(prefix);
  const { data, error } = await supabase.storage.from(bucket).list(normalizedPrefix, {
    limit: 1000,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' }
  });

  if (error) {
    throw error;
  }

  for (const item of data || []) {
    const isFolder = !item.id && !item.metadata;
    if (isFolder) {
      const nested = await listBucketObjects(supabase, bucket, normalizedPrefix ? `${normalizedPrefix}/${item.name}` : item.name);
      items.push(...nested);
      continue;
    }

    items.push(normalizeStorageItem(item, normalizedPrefix));
  }

  return items;
}

export async function loadAudioLibrary(supabase) {
  const [audioItems, coverItems] = await Promise.all([
    listBucketObjects(supabase, 'audio'),
    listBucketObjects(supabase, 'covers')
  ]);

  const coverMap = new Map();
  for (const item of coverItems) {
    const publicUrl = supabase.storage.from('covers').getPublicUrl(item.fullPath).data.publicUrl;
    coverMap.set(getFileStem(item.name), publicUrl);
    coverMap.set(item.fullPath, publicUrl);
  }

  return audioItems.map((item) => {
    const publicUrl = supabase.storage.from('audio').getPublicUrl(item.fullPath).data.publicUrl;
    const stem = getFileStem(item.name);
    const coverUrl =
      coverMap.get(stem) ||
      coverMap.get(item.fullPath) ||
      guessCoverCandidates(item.fullPath)
        .map((candidate) => coverMap.get(getFileStem(candidate)))
        .find(Boolean) ||
      createDefaultCoverDataUrl(formatDisplayTitle(item.name), 'audio');

    return createAudioTrackFromStorageItem(
      {
        ...item,
        publicUrl
      },
      coverUrl
    );
  });
}

export function createNewSongTitle(existingSongs = []) {
  const base = 'Nieuw nummer';
  const counter = existingSongs.length + 1;
  return counter === 1 ? base : `${base} ${counter}`;
}
