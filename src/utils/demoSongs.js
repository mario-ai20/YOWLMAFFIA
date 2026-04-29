import { createDefaultCoverDataUrl } from './defaultCover';
import { DEMO_LIBRARY } from './demoMedia';

export const DEMO_SONGS = [
  {
    id: 'demo-song-4ad',
    title: '4AD',
    lyrics: `4AD\n\nDemo song van YOWLMAFFIA.\n\nPlay it loud.\n\n# Media\n${DEMO_LIBRARY[0].url}`,
    cover_url: 'assets/yowl.jpg',
    last_edited_by: 'YOWLMAFFIA',
    updated_at: new Date().toISOString()
  },
  {
    id: 'demo-song-chickie',
    title: 'Ik e me chickie',
    lyrics: `Ik e me chickie\n\nDemo song van YOWLMAFFIA.\n\n# Media\n${DEMO_LIBRARY[1].url}`,
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
