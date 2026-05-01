export function parseVersionParts(value) {
  return String(value || '0.0.0')
    .trim()
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

export function compareVersions(left, right) {
  const a = parseVersionParts(left);
  const b = parseVersionParts(right);
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

export function suggestNextVersion(value) {
  const parts = parseVersionParts(value);
  if (!parts.length) {
    return '1.0.0';
  }

  const [major = 0, minor = 0, patch = 0] = parts;
  return `${major}.${minor}.${patch + 1}`;
}
