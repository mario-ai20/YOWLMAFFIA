import { Users } from 'lucide-react';
import UserAvatar from './UserAvatar';
import { normalizeUsername } from '../utils/users';

function resolveStatusLabel(status) {
  if (status === 'typing') {
    return 'aan het bewerken';
  }

  if (status === 'editing') {
    return 'aan het bewerken';
  }

  if (status === 'online') {
    return 'online';
  }

  return 'offline';
}

export default function ActiveEditors({ editors = [], allowedUsers = [], onOpenProfile }) {
  const safeEditors = Array.isArray(editors) ? editors.filter(Boolean) : [];
  const safeAllowedUsers = Array.isArray(allowedUsers) ? allowedUsers.filter(Boolean) : [];
  const editorMap = new Map();

  safeEditors.forEach((editor) => {
    const key = normalizeUsername(editor.username || editor.id || editor.name);
    if (!key) {
      return;
    }

    const current = editorMap.get(key);
    const incomingRank = editor.status === 'typing' ? 3 : editor.status === 'editing' ? 2 : editor.status === 'online' ? 1 : 0;
    const currentRank = current?.status === 'typing' ? 3 : current?.status === 'editing' ? 2 : current?.status === 'online' ? 1 : 0;

    if (!current || incomingRank >= currentRank) {
      editorMap.set(key, editor);
    }
  });

  const visibleEditors = safeAllowedUsers.length
    ? safeAllowedUsers.map((user) => {
        const key = normalizeUsername(user.username);
        const match = editorMap.get(key);
        return {
          id: user.username,
          username: user.username,
          name: user.displayName || user.username,
          avatar_url: user.avatar_url || '',
          status: match?.status || 'offline'
        };
      }).filter((editor) => editor.status !== 'offline')
    : Array.from(editorMap.values()).map((editor) => ({
        ...editor,
        status: editor.status || 'offline'
      })).filter((editor) => editor.status !== 'offline');

  return (
    <div className="active-editors">
      <div className="active-editors__header">
        <Users size={16} />
        <span>Actieve editors</span>
      </div>

      {visibleEditors.length ? (
        <div className="active-editors__list">
          {visibleEditors.map((editor) => (
            <button
              className={`active-editors__pill ${editor.status === 'typing' || editor.status === 'editing' ? 'is-typing' : ''}`}
              key={`${editor.id}-${editor.name}`}
              type="button"
              onClick={() => onOpenProfile?.(editor)}
            >
              <UserAvatar user={editor} name={editor.name} src={editor.avatar_url} size={32} showDot={editor.status !== 'offline'} />
              <span className="active-editors__pill-text">
                <strong>{editor.name}</strong>
                <span>{resolveStatusLabel(editor.status)}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted-copy">Nog niemand zit in deze song.</p>
      )}
    </div>
  );
}
