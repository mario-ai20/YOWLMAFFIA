import { CalendarClock, ChevronRight } from 'lucide-react';
import { formatUpdatedAt } from '../utils/dates';
import { createDefaultCoverDataUrl } from '../utils/defaultCover';
import { findAllowedUser } from '../utils/users';
import { getSongStatusLabel, getSongStatusTone } from '../utils/songStatus';
import UserAvatar from './UserAvatar';

export default function SongCard({ song, onOpen, allowedUsers = [] }) {
  const coverUrl = song.cover_url || createDefaultCoverDataUrl(song.title || 'Untitled', 'song');
  const editor = findAllowedUser(song.last_edited_by, allowedUsers);

  return (
    <button className="song-card" type="button" onClick={() => onOpen(song)}>
      <img className="song-card__cover" src={coverUrl} alt={song.title} />
      <div className="song-card__content">
        <div>
          <span className="eyebrow">Song</span>
          <h3>{song.title || 'Untitled'}</h3>
          <span className={`song-card__status is-${getSongStatusTone(song.status)}`}>{getSongStatusLabel(song.status)}</span>
        </div>

        <div className="song-card__meta">
          <span>
            <UserAvatar user={editor} name={song.last_edited_by || 'Onbekend'} src={editor?.avatar_url || ''} size={20} />
            {song.last_edited_by || 'Onbekend'}
          </span>
          <span>
            <CalendarClock size={14} />
            {formatUpdatedAt(song.updated_at)}
          </span>
        </div>
      </div>

      <div className="song-card__arrow">
        <ChevronRight size={18} />
      </div>
    </button>
  );
}
