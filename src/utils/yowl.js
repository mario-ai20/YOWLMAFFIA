export async function exportYowlFile(payload) {
  if (!window.desktop?.exportYowl) {
    throw new Error('De desktop bestandslaag is niet beschikbaar.');
  }

  return window.desktop.exportYowl(payload);
}

export async function importYowlFile() {
  if (!window.desktop?.importYowl) {
    throw new Error('De desktop bestandslaag is niet beschikbaar.');
  }

  return window.desktop.importYowl();
}

export async function openExternalUrl(url) {
  if (!window.desktop?.openExternal) {
    throw new Error('De desktop bestandslaag is niet beschikbaar.');
  }

  return window.desktop.openExternal(url);
}

export async function getAppVersion() {
  if (!window.desktop?.getVersion) {
    return 'dev';
  }

  return window.desktop.getVersion();
}
