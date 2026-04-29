function hashString(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function hueToHex(hue, saturation = 72, lightness = 58) {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (channel) => Math.round((channel + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function createDefaultCoverDataUrl(title = 'YOWLMAFFIA', subtitle = 'writers portal') {
  const seed = hashString(String(title).trim() || 'YOWLMAFFIA');
  const baseHue = seed % 360;
  const gradientA = hueToHex(baseHue, 78, 56);
  const gradientB = hueToHex((baseHue + 44) % 360, 82, 38);
  const gradientC = hueToHex((baseHue + 130) % 360, 72, 24);
  const initials = String(title || 'YM')
    .trim()
    .slice(0, 2)
    .toUpperCase() || 'YM';

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${gradientA}" />
          <stop offset="52%" stop-color="${gradientB}" />
          <stop offset="100%" stop-color="${gradientC}" />
        </linearGradient>
        <radialGradient id="halo" cx="50%" cy="35%" r="70%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="640" height="640" rx="72" fill="url(#g)" />
      <rect width="640" height="640" rx="72" fill="url(#halo)" opacity="0.55" />
      <circle cx="520" cy="120" r="150" fill="#ffffff" opacity="0.06" />
      <circle cx="120" cy="540" r="180" fill="#000000" opacity="0.18" />
      <text
        x="50%"
        y="50%"
        dominant-baseline="middle"
        text-anchor="middle"
        font-family="Space Grotesk, Arial, sans-serif"
        font-size="160"
        font-weight="700"
        letter-spacing="8"
        fill="#ffffff"
      >${escapeXml(initials)}</text>
      <text
        x="50%"
        y="73%"
        dominant-baseline="middle"
        text-anchor="middle"
        font-family="Manrope, Arial, sans-serif"
        font-size="28"
        font-weight="600"
        letter-spacing="5"
        fill="#ffffff"
        opacity="0.82"
      >${escapeXml(subtitle)}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
