import { createDefaultCoverDataUrl } from './defaultCover';

export const DEMO_LIBRARY = [
  {
    id: 'demo-track-4ad',
    name: '4AD.mp4',
    title: '4AD',
    path: 'demo-media/4AD.mp4',
    url: encodeURI('/demo-media/4AD.mp4'),
    mimeType: 'video/mp4',
    size: 58079870,
    coverUrl: createDefaultCoverDataUrl('4AD', 'audio')
  },
  {
    id: 'demo-track-ik-e-me-chickie',
    name: 'Ik e me chickie.mp4',
    title: 'Ik e me chickie',
    path: 'demo-media/Ik e me chickie.mp4',
    url: encodeURI('/demo-media/Ik e me chickie.mp4'),
    mimeType: 'video/mp4',
    size: 66151813,
    coverUrl: createDefaultCoverDataUrl('Ik e me chickie', 'audio')
  }
];

export function getDemoLibrary() {
  return DEMO_LIBRARY.map((track) => ({ ...track }));
}
