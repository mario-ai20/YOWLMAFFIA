export const DEFAULT_THEME = {
  accent: '#72d4ff',
  accentSoft: '#c2f0ff',
  accentStrong: '#2cb1ef',
  accentContrast: '#08111b',
  accentHalo: '#effcff'
};

export function applyThemeVariables(theme) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const nextTheme = {
    ...DEFAULT_THEME,
    ...(theme || {})
  };

  root.style.setProperty('--accent', nextTheme.accent);
  root.style.setProperty('--accent-soft', nextTheme.accentSoft);
  root.style.setProperty('--accent-strong', nextTheme.accentStrong);
  root.style.setProperty('--accent-contrast', nextTheme.accentContrast);
  root.style.setProperty('--accent-halo', nextTheme.accentHalo);
  root.style.setProperty('--accent-shadow', `${nextTheme.accent}26`);
  root.style.setProperty('--accent-glow', `${nextTheme.accent}40`);
}

export function resetThemeVariables() {
  applyThemeVariables(DEFAULT_THEME);
}
