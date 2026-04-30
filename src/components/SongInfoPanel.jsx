import { Download, Upload, UsersRound } from 'lucide-react';
import ActiveEditors from './ActiveEditors';
import UserAvatar from './UserAvatar';
import { findAllowedUser } from '../utils/users';
import { SONG_STATUS_OPTIONS, getSongStatusLabel } from '../utils/songStatus';

export default function SongInfoPanel({
  song,
  title,
  titleInputRef,
  onTitleChange,
  onTitleFocus,
  onTitleBlur,
  onExport,
  onImport,
  onUploadCover,
  onUploadMedia,
  onUploadTrack,
  onStatusChange,
  onClearLyrics,
  onDeleteSong,
  onOpenProfile,
  savingState,
  activeEditors = [],
  allowedUsers = [],
  collabMessage = ''
}) {
  const lastEditor = findAllowedUser(song.last_edited_by, allowedUsers);

  return (
    <aside className="song-info-panel panel">
      <div className="panel__header">
        <span className="eyebrow">Song info</span>
        <h2>Details</h2>
      </div>

      <div className="song-info-panel__cover-wrap">
        <img className="song-info-panel__cover" src={song.cover_url} alt={song.title} />
      </div>

      <label className="field">
        <span>Title</span>
        <input
          ref={titleInputRef}
          className="input"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          onFocus={onTitleFocus}
          onBlur={onTitleBlur}
        />
      </label>

      <label className="field">
        <span>Songstatus</span>
        <select className="input" value={song.status || 'concept'} onChange={(event) => onStatusChange?.(event.target.value)}>
          {SONG_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <small className="muted-copy">Huidige status: {getSongStatusLabel(song.status)}</small>
      </label>

      <div className="song-info-panel__meta">
        <div>
          <span className="eyebrow">Bijgewerkt door</span>
          <div className="song-info-panel__author">
            <UserAvatar user={lastEditor} name={song.last_edited_by || 'Onbekend'} src={lastEditor?.avatar_url || ''} size={26} />
            <strong>{song.last_edited_by || 'Onbekend'}</strong>
          </div>
        </div>
        <div>
          <span className="eyebrow">Status</span>
          <strong>{getSongStatusLabel(song.status)}</strong>
          <small className="muted-copy">{savingState}</small>
        </div>
      </div>

      <ActiveEditors editors={activeEditors} allowedUsers={allowedUsers} onOpenProfile={onOpenProfile} />

      {collabMessage ? <div className="song-info-panel__live-note">{collabMessage}</div> : null}

      <div className="song-info-panel__actions-group">
        <span className="song-info-panel__actions-label">Bestanden</span>
        <div className="stack-buttons stack-buttons--two">
          <button className="button button--primary button--compact" type="button" onClick={onExport}>
            <Download size={16} />
            Sla op als .yowl
          </button>
          <button className="button button--secondary button--compact" type="button" onClick={onImport}>
            <Upload size={16} />
            Open .yowl
          </button>
        </div>
      </div>

      <div className="song-info-panel__actions-group">
        <span className="song-info-panel__actions-label">Media</span>
        <div className="stack-buttons stack-buttons--three">
          <button className="button button--secondary button--compact" type="button" onClick={onUploadCover}>
            <Upload size={16} />
            Cover
          </button>
          <button className="button button--secondary button--compact" type="button" onClick={onUploadMedia}>
            <Upload size={16} />
            Media
          </button>
          <button className="button button--primary button--compact" type="button" onClick={onUploadTrack}>
            <Upload size={16} />
            Track
          </button>
        </div>
      </div>

      <div className="song-info-panel__actions-group song-info-panel__actions-group--danger">
        <span className="song-info-panel__actions-label">Bewerken</span>
        <div className="stack-buttons stack-buttons--two">
          <button className="button button--ghost button--compact" type="button" onClick={onClearLyrics}>
            Wis lyrics
          </button>

          <button className="button button--danger button--compact" type="button" onClick={onDeleteSong}>
            Verwijder song
          </button>
        </div>
      </div>

      <div className="panel__footer">
        <UsersRound size={16} />
        <span>{collabMessage || 'Realtime presence actief via Supabase.'}</span>
      </div>
    </aside>
  );
}
