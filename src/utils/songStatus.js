export const SONG_STATUS_OPTIONS = [
  { value: 'concept', label: 'Concept', tone: 'neutral' },
  { value: 'bezig', label: 'Bezig', tone: 'warning' },
  { value: 'bijwerken', label: 'Bijwerken', tone: 'accent' },
  { value: 'klaar', label: 'Klaar', tone: 'success' }
];

export function normalizeSongStatus(value) {
  const needle = String(value || '').trim().toLowerCase();
  return SONG_STATUS_OPTIONS.some((option) => option.value === needle) ? needle : 'concept';
}

export function getSongStatusLabel(value) {
  return SONG_STATUS_OPTIONS.find((option) => option.value === normalizeSongStatus(value))?.label || 'Concept';
}

export function getSongStatusTone(value) {
  return SONG_STATUS_OPTIONS.find((option) => option.value === normalizeSongStatus(value))?.tone || 'neutral';
}
