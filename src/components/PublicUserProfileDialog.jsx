import { MessageSquarePlus, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import UserAvatar from './UserAvatar';
import { formatRelativeTime } from '../utils/dates';
import { normalizePublicUsername, resolvePublicPresenceLabel } from '../utils/publicUsers';

export default function PublicUserProfileDialog({
  open = false,
  user = null,
  onClose,
  onStartMessage
}) {
  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose?.();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !user || typeof document === 'undefined') {
    return null;
  }

  const presenceLabel = resolvePublicPresenceLabel(user);
  const lastUpdated = formatRelativeTime(user.updated_at || user.avatar_updated_at || user.profile_updated_at || '');
  const lastOnline = formatRelativeTime(user.last_online_at || '');

  return createPortal(
    <div className="profile-dialog" role="dialog" aria-modal="true" aria-label={`Profiel van ${user.displayName || user.username || 'gebruiker'}`}>
      <button className="profile-dialog__backdrop" type="button" aria-label="Sluit profiel" onClick={() => onClose?.()} />

      <div className="profile-dialog__panel panel" role="document">
        <div className="profile-dialog__header">
          <div className="profile-dialog__identity">
            <UserAvatar user={user} name={user.displayName || user.username} src={user.avatar_url || ''} size={74} />
            <div>
              <span className="eyebrow">Profiel</span>
              <h2>{user.displayName || user.username || 'Onbekend'}</h2>
              <p>{user.gender || 'zeg ik liever niet'}</p>
            </div>
          </div>

          <button className="icon-button" type="button" onClick={() => onClose?.()} aria-label="Sluit profiel">
            <X size={16} />
          </button>
        </div>

        <div className="profile-dialog__content">
          <div className="profile-dialog__block">
            <span className="profile-dialog__label">Status</span>
            <strong className={`profile-dialog__presence is-${presenceLabel}`}>{presenceLabel}</strong>
          </div>

          <div className="profile-dialog__block">
            <span className="profile-dialog__label">Bio</span>
            <p>{user.bio || 'Geen bio ingevuld.'}</p>
          </div>

          <div className="profile-dialog__block">
            <span className="profile-dialog__label">Statusbericht</span>
            <p>{user.status_message || 'Geen statusbericht ingesteld.'}</p>
          </div>

          <div className="profile-dialog__block">
            <span className="profile-dialog__label">Laatst online</span>
            <p>{lastOnline || 'Nog niet bekend.'}</p>
          </div>

          <div className="profile-dialog__block">
            <span className="profile-dialog__label">Bijgewerkt</span>
            <p>{lastUpdated}</p>
          </div>
        </div>

        <div className="profile-dialog__actions">
          {typeof onStartMessage === 'function' && normalizePublicUsername(user.username) ? (
            <button
              className="button button--primary"
              type="button"
              onClick={() => onStartMessage(user)}
            >
              <MessageSquarePlus size={16} />
              Bericht sturen
            </button>
          ) : null}

          <button className="button button--secondary" type="button" onClick={() => onClose?.()}>
            <X size={16} />
            Sluiten
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
