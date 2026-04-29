import { createDefaultCoverDataUrl } from './defaultCover';

export const DEMO_SONGS = [
  {
    id: 'demo-song-yowlmaffia',
    title: 'YOWLMAFFIA',
    lyrics: 'Demo song van YOWLMAFFIA.\n\nHier komen jullie echte songs uit Supabase binnen.',
    cover_url: 'assets/yowl.jpg',
    last_edited_by: 'YOWLMAFFIA',
    updated_at: new Date().toISOString()
  }
];

export function getDemoSongs() {
  return DEMO_SONGS.map((song) => ({
    ...song,
    cover_url: song.cover_url || createDefaultCoverDataUrl(song.title, 'song')
  }));
}
