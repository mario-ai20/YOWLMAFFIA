import { ArrowUpRight, Trash2 } from 'lucide-react';
import { createDefaultCoverDataUrl } from '../utils/defaultCover';

function openExternalUrl(url) {
  const nextUrl = String(url || '').trim();
  if (!nextUrl) {
    return;
  }

  if (typeof window !== 'undefined' && window.desktop?.openExternal) {
    window.desktop.openExternal(nextUrl);
    return;
  }

  if (typeof window !== 'undefined') {
    window.open(nextUrl, '_blank', 'noopener,noreferrer');
  }
}

export default function MusicReleaseCard({ release, onDelete, canManage = false }) {
  const coverUrl = release.coverUrl || createDefaultCoverDataUrl(release.title || 'Spotify', release.artistName || 'YOWLMAFFIA');
  const spotifyUrl = String(release.spotifyUrl || '').trim();

  return (
    <article className="music-release-card">
      <img className="music-release-card__cover" src={coverUrl} alt={release.title} />

      <div className="music-release-card__content">
        <span className="eyebrow">Spotify</span>
        <strong>{release.title}</strong>
        <p>{release.artistName || 'YOWLMAFFIA'}</p>
        <small>{spotifyUrl ? 'Open de release op Spotify' : 'Nog geen Spotify-link ingesteld'}</small>
      </div>

      <div className="music-release-card__actions">
        <button
          className="button button--secondary button--small"
          type="button"
          onClick={() => openExternalUrl(spotifyUrl)}
          disabled={!spotifyUrl}
        >
          <ArrowUpRight size={16} />
          Spotify
        </button>

        {canManage && typeof onDelete === 'function' ? (
          <button
            className="button button--ghost button--small music-release-card__delete"
            type="button"
            onClick={() => onDelete(release)}
            aria-label={`Verwijder ${release.title}`}
            title="Verwijder banner"
          >
            <Trash2 size={16} />
            Wis
          </button>
        ) : null}
      </div>
    </article>
  );
}
