import { Bell, LayoutDashboard, LogOut, MessagesSquare, ShieldEllipsis } from 'lucide-react';
import { NavLink } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
import BrandMark from './BrandMark';
import UserAvatar from './UserAvatar';
import { normalizePublicUsername } from '../utils/publicUsers';

function resolveThemeMode(mode) {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }

  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }

  return 'dark';
}

export default function PublicShell({
  user,
  onSignOut,
  statusText = 'Alles bijgewerkt',
  children
}) {
  const [themeMode, setThemeMode] = useState(user?.theme_mode || 'system');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const isMattiz = normalizePublicUsername(user?.username) === 'mattiz';

  const headerDateTime = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('nl-BE', {
        dateStyle: 'medium',
        timeStyle: 'medium'
      }).format(new Date(nowTick));
    } catch {
      return new Date(nowTick).toLocaleString('nl-BE');
    }
  }, [nowTick]);

  useEffect(() => {
    setThemeMode(user?.theme_mode || 'system');
  }, [user?.theme_mode, user?.username]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const resolvedTheme = resolveThemeMode(themeMode);
    root.dataset.theme = resolvedTheme;
    root.dataset.themeMode = themeMode;
    root.style.colorScheme = resolvedTheme;

    if (typeof window === 'undefined' || themeMode !== 'system') {
      return;
    }

    const media = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = () => {
      const nextTheme = resolveThemeMode('system');
      root.dataset.theme = nextTheme;
      root.style.colorScheme = nextTheme;
    };

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [themeMode]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="public-shell">
      <header className="public-shell__header">
        <BrandMark />

        <nav className="public-shell__nav">
          <NavLink end to="/public/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>
            <LayoutDashboard size={16} />
            Dashboard
          </NavLink>
          <NavLink end to="/public/chat" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>
            <MessagesSquare size={16} />
            Public chat
          </NavLink>
          {isMattiz ? (
            <NavLink end to="/public/beheren" className={({ isActive }) => `nav-link nav-link--ghost ${isActive ? 'is-active' : ''}`.trim()}>
              <ShieldEllipsis size={16} />
              Beheren
            </NavLink>
          ) : null}
        </nav>

        <div className="public-shell__user">
          <div className="public-shell__header-row">
            <div className="public-shell__notifications" aria-live="polite">
              <Bell size={15} />
              <span>{statusText}</span>
            </div>

            <div className="public-shell__clock" aria-label={`Huidige datum en tijd: ${headerDateTime}`}>
              <span>{headerDateTime}</span>
            </div>
          </div>

          <div className="public-shell__user-row">
            <div className="public-shell__status">
              <div className="user-chip">
                <UserAvatar user={user} size={42} showDot />
                <div>
                  <strong>{user?.displayName || user?.username || 'Bezoeker'}</strong>
                  <span>{user?.status_message || user?.bio || 'Beschikbaar'}</span>
                </div>
              </div>
            </div>

            <div className="public-shell__actions">
              <NavLink className="icon-text-button" to="/public/settings">
                <ShieldEllipsis size={16} />
                Instellingen
              </NavLink>

              <button className="icon-text-button" type="button" onClick={onSignOut}>
                <LogOut size={16} />
                Uitloggen
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="public-shell__main">{children}</main>
    </div>
  );
}
