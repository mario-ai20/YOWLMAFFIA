import { Play } from 'lucide-react';
import { createDefaultCoverDataUrl } from '../utils/defaultCover';

export default function TrackCard({ track, active = false, onPlay }) {
  const coverUrl = track.coverUrl || createDefaultCoverDataUrl(track.title || 'Audio', 'track');

  return (
    <button className={`track-card ${active ? 'is-active' : ''}`} type="button" onClick={() => onPlay(track)}>
      <img className="track-card__cover" src={coverUrl} alt={track.title} />
      <div className="track-card__content">
        <span className="eyebrow">Track</span>
        <strong>{track.title}</strong>
        <p>{track.name}</p>
      </div>
      <span className="track-card__play">
        <Play size={16} />
      </span>
    </button>
  );
}
