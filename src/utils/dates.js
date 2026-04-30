const dateFormatter = new Intl.DateTimeFormat('nl-BE', {
  dateStyle: 'medium',
  timeStyle: 'short'
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

function formatDutchRelative(count, unit, isPast) {
  const absolute = Math.abs(count);

  if (absolute === 0) {
    return 'nu';
  }

  if (absolute === 1) {
    const singularUnit =
      unit === 'second' ? 'seconde' : unit === 'minute' ? 'minuut' : unit === 'hour' ? 'uur' : 'dag';
    return isPast ? `1 ${singularUnit} geleden` : `over 1 ${singularUnit}`;
  }

  const pluralUnit =
    unit === 'second' ? 'seconden' : unit === 'minute' ? 'minuten' : unit === 'hour' ? 'uur' : 'dagen';
  return isPast ? `${absolute} ${pluralUnit} geleden` : `over ${absolute} ${pluralUnit}`;
}

export function formatRelativeTime(value, referenceTime = Date.now()) {
  if (!value) {
    return 'zojuist';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'zojuist';
  }

  const diffSeconds = Math.round((date.getTime() - referenceTime) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 60) {
    return formatDutchRelative(diffSeconds, 'second', diffSeconds < 0);
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  const absMinutes = Math.abs(diffMinutes);

  if (absMinutes < 60) {
    return formatDutchRelative(diffMinutes, 'minute', diffMinutes < 0);
  }

  const diffHours = Math.round(diffSeconds / 3600);
  const absHours = Math.abs(diffHours);

  if (absHours < 24) {
    return formatDutchRelative(diffHours, 'hour', diffHours < 0);
  }

  const diffDays = Math.round(diffSeconds / 86400);
  return formatDutchRelative(diffDays, 'day', diffDays < 0);
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
