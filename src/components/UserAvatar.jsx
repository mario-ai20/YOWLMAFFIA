function getInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return '?';
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export default function UserAvatar({
  user = null,
  name = '',
  src = '',
  size = 42,
  className = '',
  alt = '',
  showDot = false
}) {
  const label = name || user?.displayName || user?.username || user?.email || 'Profiel';
  const baseAvatarSrc = src || user?.avatar_url || '';
  const avatarVersion = user?.updated_at || user?.avatar_updated_at || '';
  const hasVersionQuery = /[?&]v=/.test(baseAvatarSrc);
  const avatarSrc = baseAvatarSrc
    ? avatarVersion && !/^blob:|^data:/i.test(baseAvatarSrc) && !hasVersionQuery
      ? `${baseAvatarSrc}${baseAvatarSrc.includes('?') ? '&' : '?'}v=${encodeURIComponent(avatarVersion)}`
      : baseAvatarSrc
    : '';
  const sizeStyle = {
    width: `${size}px`,
    height: `${size}px`
  };

  return (
    <span className={`user-avatar ${className}`.trim()} style={sizeStyle}>
      {avatarSrc ? <img className="user-avatar__image" src={avatarSrc} alt={alt || label} /> : <span className="user-avatar__fallback">{getInitials(label)}</span>}
      {showDot ? <span className="user-avatar__dot" /> : null}
    </span>
  );
}
