import { createDefaultCoverDataUrl } from './defaultCover';

function normalizeText(value, fallback = '') {
  return String(value || '').trim() || fallback;
}

export function createSpotifySearchUrl(title = '', artistName = '') {
  const query = [title, artistName].map((value) => String(value || '').trim()).filter(Boolean).join(' ');
  return query ? `https://open.spotify.com/search/${encodeURIComponent(query)}` : 'https://open.spotify.com';
}

export function normalizeMusicRelease(record = {}) {
  const title = normalizeText(record.title, 'Onbekende release');
  const artistName = normalizeText(record.artist_name, 'YOWLMAFFIA');
  const spotifyUrl = normalizeText(record.spotify_url, createSpotifySearchUrl(title, artistName));
  const coverUrl = normalizeText(record.cover_url, createDefaultCoverDataUrl(title, artistName || 'Spotify'));
  const coverStoragePath = normalizeText(record.cover_storage_path, '');

  return {
    id: normalizeText(record.id, `${title}-${artistName}`),
    title,
    artistName,
    spotifyUrl,
    coverUrl,
    coverStoragePath,
    sortOrder: Number(record.sort_order || 0),
    createdAt: record.created_at || new Date().toISOString(),
    updatedAt: record.updated_at || record.created_at || new Date().toISOString()
  };
}

export async function loadMusicReleases(supabase) {
  const { data, error } = await supabase
    .from('music_releases')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || [])
    .map((release) => normalizeMusicRelease(release))
    .filter((release) => {
      const releaseId = String(release.id || '').trim().toLowerCase();
      return releaseId && !releaseId.startsWith('demo-release-');
    });
}

export function buildMusicReleaseDisplayTitle(release = {}) {
  const title = normalizeText(release.title, 'Onbekende release');
  const artistName = normalizeText(release.artistName || release.artist_name, 'YOWLMAFFIA');
  return `${title} · ${artistName}`;
}
