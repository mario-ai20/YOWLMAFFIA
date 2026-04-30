import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, Rocket, Upload } from 'lucide-react';
import { checkForUpdates, downloadUpdate, getUpdateState, installUpdate, subscribeToUpdateState } from '../utils/updates';

const visibleStatuses = new Set(['available', 'downloading', 'ready', 'installing', 'error']);

function formatVersion(version) {
  return version ? `v${version}` : '';
}

export default function UpdateBanner({
  className = '',
  compact = false,
  showActions = true,
  eyebrow = 'Nieuwe update'
} = {}) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const initial = await getUpdateState();
      if (!cancelled && initial) {
        setState(initial);
      }
    }

    bootstrap();

    const unsubscribe = subscribeToUpdateState((nextState) => {
      if (!cancelled) {
        setState(nextState);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const status = state?.status || 'idle';
  const isVisible = visibleStatuses.has(status);
  const title = useMemo(() => {
    if (status === 'downloading') {
      return 'Update wordt gedownload';
    }

    if (status === 'ready') {
      return 'Update klaar';
    }

    if (status === 'installing') {
      return 'Bijwerken...';
    }

    if (status === 'error') {
      return 'Update mislukt';
    }

    return 'Nieuwe update beschikbaar';
  }, [status]);

  async function handleCheck() {
    setBusy(true);
    try {
      await checkForUpdates();
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    setBusy(true);
    try {
      await downloadUpdate();
    } finally {
      setBusy(false);
    }
  }

  async function handleInstall() {
    setBusy(true);
    try {
      await installUpdate();
    } finally {
      setBusy(false);
    }
  }

  if (!isVisible) {
    return null;
  }

  return (
    <aside className={`update-banner panel ${compact ? 'update-banner--compact' : ''} ${className}`.trim()} aria-live="polite">
      <div className="panel__header update-banner__header">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <Rocket size={18} />
      </div>

      <p className="update-banner__copy">
        {state?.message || 'De app zoekt online naar de nieuwste versie.'}
      </p>

      {state?.notes ? <p className="update-banner__notes">{state.notes}</p> : null}

      <div className="update-banner__meta">
        <span>Huidig: {formatVersion(state?.currentVersion)}</span>
        <span>Nieuw: {formatVersion(state?.latestVersion)}</span>
      </div>

      {showActions ? (
        <div className="update-banner__actions">
          <button className="button button--secondary" type="button" onClick={handleCheck} disabled={busy || status === 'installing'}>
            <RefreshCw size={16} />
            Controleren
          </button>

          {status === 'available' ? (
            <button className="button button--primary" type="button" onClick={handleDownload} disabled={busy}>
              <Download size={16} />
              Downloaden
            </button>
          ) : null}

          {status === 'ready' ? (
            <button className="button button--primary" type="button" onClick={handleInstall} disabled={busy}>
              <Upload size={16} />
              Nu bijwerken
            </button>
          ) : null}

          {status === 'downloading' ? <div className="update-banner__progress">Downloaden...</div> : null}
        </div>
      ) : null}
    </aside>
  );
}
