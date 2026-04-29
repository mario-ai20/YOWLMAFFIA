export const DEMO_LIBRARY = [
  {
    id: 'demo-4ad',
    name: '4AD.mp4',
    title: '4AD',
    path: 'demo-media/4AD.mp4',
    url: 'demo-media/4AD.mp4',
    coverUrl: 'assets/yowl.jpg',
    mimeType: 'video/mp4',
    source: 'demo'
  },
  {
    id: 'demo-ik-e-me-chickie',
    name: 'Ik e me chickie.mp4',
    title: 'Ik e me chickie',
    path: 'demo-media/Ik e me chickie.mp4',
    url: 'demo-media/Ik e me chickie.mp4',
    coverUrl: 'assets/yowl.jpg',
    mimeType: 'video/mp4',
    source: 'demo'
  }
];

export function getDemoLibrary() {
  return [...DEMO_LIBRARY];
}
