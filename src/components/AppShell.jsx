import { Bell, Library, LogOut, LayoutDashboard, MessagesSquare, ShieldEllipsis } from 'lucide-react';
import { NavLink } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
import BrandMark from './BrandMark';
import { getBuildState, subscribeToBuildState } from '../utils/buildInfo';
import SettingsMenu from './SettingsMenu';
import { normalizeUsername } from '../utils/users';
import UserAvatar from './UserAvatar';

function resolveThemeMode(mode) {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }

  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }

  return 'dark';
}

export default function AppShell({
  user,
  onSignOut,
  notificationCount = 0,
  onProfileSave,
  onAvatarUpload,
  onAvatarDelete,
  onEmailChange,
  children
}) {
  const [buildNumber, setBuildNumber] = useState('dev');
  const [themeMode, setThemeMode] = useState(user?.theme_mode || 'system');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const isMattiz = normalizeUsername(user?.username) === 'mattiz';

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
    let mounted = true;

    async function bootstrapBuildState() {
      const initial = await getBuildState();
      if (mounted && initial) {
        setBuildNumber(initial.buildNumber || 'dev');
      }
    }

    bootstrapBuildState();

    const unsubscribe = subscribeToBuildState((nextState) => {
      if (mounted && nextState) {
        setBuildNumber(nextState.buildNumber || 'dev');
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

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
    return () => {
      media.removeEventListener('change', handleChange);
    };
  }, [themeMode]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <BrandMark />

        <nav className="app-shell__nav">
          <NavLink end to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>
            <LayoutDashboard size={16} />
            Dashboard
          </NavLink>
          {isMattiz ? (
            <NavLink end to="/beheren" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>
              <ShieldEllipsis size={16} />
              Beheren
            </NavLink>
          ) : null}
          <NavLink end to="/chat" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>
            <MessagesSquare size={16} />
            Chat
          </NavLink>
          <NavLink end to="/songs" className={({ isActive }) => `nav-link nav-link--ghost ${isActive ? 'is-active' : ''}`.trim()}>
            <Library size={16} />
            Songs
          </NavLink>
        </nav>

        <div className="app-shell__user">
          <div className="app-shell__header-row">
            <div className="app-shell__notifications" aria-live="polite">
              <Bell size={15} />
              <span>{notificationCount > 0 ? `${notificationCount} nieuw` : 'Alles bijgewerkt'}</span>
            </div>

            <div className="app-shell__clock" aria-label={`Huidige datum en tijd: ${headerDateTime}`}>
              <span>{headerDateTime}</span>
            </div>

            <div className="app-shell__version" aria-label={`Huidige buildversie: ${buildNumber}`}>
              Build {buildNumber}
            </div>
          </div>

          <div className="app-shell__user-row">
            <div className="app-shell__status">
              <div className="user-chip">
                <UserAvatar user={user} size={42} showDot />
                <div>
                  <strong>{user?.displayName || 'Onbekend'}</strong>
                  <span>{user?.status_message || user?.bio || 'Beschikbaar'}</span>
                </div>
              </div>
            </div>

            <div className="app-shell__actions">
              <SettingsMenu
                user={user}
                themeMode={themeMode}
                onThemeModeChange={setThemeMode}
                onProfileSave={onProfileSave}
                onAvatarUpload={onAvatarUpload}
                onAvatarDelete={onAvatarDelete}
                onEmailChange={onEmailChange}
              />

              <button className="icon-text-button" type="button" onClick={onSignOut}>
                <LogOut size={16} />
                Uitloggen
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="app-shell__main">{children}</main>
    </div>
  );
}
