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

export const DEMO_MUSIC_RELEASES = [
  {
    id: 'demo-release-viera-d',
    title: 'VIERA D',
    artist_name: 'YOWLMAFFIA',
    spotify_url: createSpotifySearchUrl('VIERA D', 'YOWLMAFFIA'),
    cover_url: createDefaultCoverDataUrl('VIERA D', 'Spotify')
  },
  {
    id: 'demo-release-ik-e-me-chickie',
    title: 'Ik e me chickie',
    artist_name: 'YOWLMAFFIA',
    spotify_url: createSpotifySearchUrl('Ik e me chickie', 'YOWLMAFFIA'),
    cover_url: createDefaultCoverDataUrl('Ik e me chickie', 'Spotify')
  }
];

export function getDemoMusicReleases() {
  return DEMO_MUSIC_RELEASES.map((release) => normalizeMusicRelease(release));
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

  return (data || []).map((release) => normalizeMusicRelease(release));
}

export function buildMusicReleaseDisplayTitle(release = {}) {
  const title = normalizeText(release.title, 'Onbekende release');
  const artistName = normalizeText(release.artistName || release.artist_name, 'YOWLMAFFIA');
  return `${title} · ${artistName}`;
}
