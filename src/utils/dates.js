const dateFormatter = new Intl.DateTimeFormat('nl-BE', {
  dateStyle: 'medium',
  timeStyle: 'short'
});

const relativeFormatter = new Intl.RelativeTimeFormat('nl-BE', {
  numeric: 'auto'
});

export function formatUpdatedAt(value) {
  if (!value) {
    return 'Nog niet opgeslagen';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Onbekende datum';
  }

  return dateFormatter.format(date);
}

export function formatRelativeTime(value) {
  if (!value) {
    return 'zopas';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'zopas';
  }

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 60) {
    return relativeFormatter.format(diffSeconds, 'second');
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  const absMinutes = Math.abs(diffMinutes);

  if (absMinutes < 60) {
    return relativeFormatter.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffSeconds / 3600);
  const absHours = Math.abs(diffHours);

  if (absHours < 24) {
    return relativeFormatter.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffSeconds / 86400);
  return relativeFormatter.format(diffDays, 'day');
}

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
