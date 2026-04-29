import { useEffect, useRef, useState } from 'react';
import { CirclePlus, X } from 'lucide-react';

export default function CreateSongDialog({ open, loading = false, errorMessage = '', onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [lyrics, setLyrics] = useState('');
  const titleRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    setTitle('');
    setLyrics('');

    const timeout = window.setTimeout(() => {
      titleRef.current?.focus();
    }, 0);

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose?.();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="create-song-dialog" role="dialog" aria-modal="true" aria-labelledby="create-song-title">
      <button className="create-song-dialog__backdrop" type="button" aria-label="Sluit song aanmaakvenster" onClick={onClose} />

      <div className="create-song-dialog__panel panel">
        <div className="panel__header">
          <div>
            <span className="eyebrow">Nieuwe song</span>
            <h2 id="create-song-title">Maak een song aan</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Sluit">
            <X size={16} />
          </button>
        </div>

        <div className="create-song-dialog__body">
          <label className="field">
            <span>Titel</span>
            <input
              ref={titleRef}
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Bijvoorbeeld: Ik e me chickie"
            />
          </label>

          <label className="field">
            <span>Startlyrics</span>
            <textarea
              className="input create-song-dialog__textarea"
              value={lyrics}
              onChange={(event) => setLyrics(event.target.value)}
              placeholder="Begin hier je song. Je kan later altijd verder schrijven in de editor."
            />
          </label>

          {errorMessage ? <p className="settings-menu__message">{errorMessage}</p> : null}
        </div>

        <div className="create-song-dialog__actions">
          <button className="button button--secondary" type="button" onClick={onClose}>
            Annuleer
          </button>
          <button
            className="button button--primary"
            type="button"
            disabled={loading}
            onClick={async () => {
              await onCreate?.({ title, lyrics });
            }}
          >
            <CirclePlus size={16} />
            {loading ? 'Maken...' : 'Song maken'}
          </button>
        </div>
      </div>
    </div>
  );
}
