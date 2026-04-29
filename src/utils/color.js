function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeChannel(value) {
  return clamp(Math.round(Number(value) || 0), 0, 255);
}

export function hexToRgb(hex) {
  const cleaned = String(hex || '')
    .replace('#', '')
    .trim();

  if (cleaned.length !== 6) {
    return { r: 0, g: 0, b: 0 };
  }

  return {
    r: Number.parseInt(cleaned.slice(0, 2), 16),
    g: Number.parseInt(cleaned.slice(2, 4), 16),
    b: Number.parseInt(cleaned.slice(4, 6), 16)
  };
}

export function rgbToHex(r, g, b) {
  return [r, g, b]
    .map((channel) => normalizeChannel(channel).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function rgbToHsl(r, g, b) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  if (delta !== 0) {
    if (max === red) {
      hue = 60 * (((green - blue) / delta) % 6);
    } else if (max === green) {
      hue = 60 * ((blue - red) / delta + 2);
    } else {
      hue = 60 * ((red - green) / delta + 4);
    }
  }

  return {
    h: (hue + 360) % 360,
    s: clamp(saturation * 100, 0, 100),
    l: clamp(lightness * 100, 0, 100)
  };
}

export function hslToRgb(h, s, l) {
  const hue = ((Number(h) % 360) + 360) % 360;
  const sat = clamp(Number(s) / 100, 0, 1);
  const light = clamp(Number(l) / 100, 0, 1);
  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = light - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 60) {
    red = chroma;
    green = x;
  } else if (hue < 120) {
    red = x;
    green = chroma;
  } else if (hue < 180) {
    green = chroma;
    blue = x;
  } else if (hue < 240) {
    green = x;
    blue = chroma;
  } else if (hue < 300) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return {
    r: normalizeChannel((red + match) * 255),
    g: normalizeChannel((green + match) * 255),
    b: normalizeChannel((blue + match) * 255)
  };
}

export function mixHex(baseHex, targetHex, amount = 0.5) {
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);
  return `#${rgbToHex(
    base.r + (target.r - base.r) * amount,
    base.g + (target.g - base.g) * amount,
    base.b + (target.b - base.b) * amount
  )}`;
}

export function readableTextColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return luminance >= 150 ? '#0c1020' : '#f7f9ff';
}

export function defaultAccentFromTitle(title = 'YOWLMAFFIA') {
  const seed = String(title || 'YOWLMAFFIA')
    .split('')
    .reduce((accumulator, char) => accumulator + char.charCodeAt(0), 0);
  const hue = seed % 360;
  const { r, g, b } = hslToRgb(hue, 84, 58);
  return `#${rgbToHex(r, g, b)}`;
}

export function buildThemeFromAccent(accentHex, label = 'YOWLMAFFIA') {
  const normalized = accentHex || defaultAccentFromTitle(label);
  const contrast = readableTextColor(normalized);
  const soft = mixHex(normalized, '#ffffff', 0.72);
  const strong = mixHex(normalized, '#000000', 0.18);
  const halo = mixHex(normalized, '#ffffff', 0.88);

  return {
    accent: normalized,
    accentSoft: soft,
    accentStrong: strong,
    accentContrast: contrast,
    accentHalo: halo
  };
}

export async function extractThemeFromImage(imageUrl, fallbackLabel = 'YOWLMAFFIA') {
  if (!imageUrl) {
    return buildThemeFromAccent(null, fallbackLabel);
  }

  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const image = await loadImage(objectUrl);
    URL.revokeObjectURL(objectUrl);

    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) {
      return buildThemeFromAccent(null, fallbackLabel);
    }

    context.drawImage(image, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size).data;

    let total = 0;
    let red = 0;
    let green = 0;
    let blue = 0;
    let saturationBoost = 0;

    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3] / 255;
      if (alpha <= 0.1) {
        continue;
      }

      const pixelRed = pixels[index];
      const pixelGreen = pixels[index + 1];
      const pixelBlue = pixels[index + 2];
      const { s, l } = rgbToHsl(pixelRed, pixelGreen, pixelBlue);

      if (l < 8 || l > 96) {
        continue;
      }

      const weight = alpha * (0.55 + s / 140);
      red += pixelRed * weight;
      green += pixelGreen * weight;
      blue += pixelBlue * weight;
      total += weight;
      saturationBoost += s;
    }

    if (total === 0) {
      return buildThemeFromAccent(null, fallbackLabel);
    }

    const averageRed = Math.round(red / total);
    const averageGreen = Math.round(green / total);
    const averageBlue = Math.round(blue / total);
    const hsl = rgbToHsl(averageRed, averageGreen, averageBlue);
    const elevated = hslToRgb(hsl.h, clamp(hsl.s + 18, 0, 100), clamp(hsl.l + 4, 0, 100));
    const accent = `#${rgbToHex(elevated.r, elevated.g, elevated.b)}`;

    return buildThemeFromAccent(accent, fallbackLabel);
  } catch (error) {
    return buildThemeFromAccent(null, fallbackLabel);
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Kon afbeelding niet laden: ${url}`));
    image.src = url;
  });
}
