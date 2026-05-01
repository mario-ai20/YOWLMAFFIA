import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useNavigate, useParams } from 'react-router';
import CreateSongDialog from './components/CreateSongDialog';
import { supabase, supabaseUrl, supabaseAnonKey, isSupabaseConfigured } from './utils/supabase';
import {
  DEFAULT_ALLOWED_USERS,
  cacheAllowedUserProfile,
  findAllowedUser,
  loadAllowedUsers,
  normalizeUsername,
  resolveAvatarUrl,
  resolveUserFromSession
} from './utils/users';
import { getDemoSongs } from './utils/demoSongs';
import { loadMusicReleases as loadMusicReleasesFromDatabase, normalizeMusicRelease } from './utils/musicReleases';
import { normalizeSongStatus } from './utils/songStatus';
import { compareVersions } from './utils/version';
import { getAppVersion } from './utils/yowl';

const AppShell = lazy(() => import('./components/AppShell'));
const EditorPage = lazy(() => import('./components/EditorPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const SetupNotice = lazy(() => import('./components/SetupNotice'));

const isProduction = import.meta.env.PROD;
const allowOfflineDemo = !isProduction;

function sanitizeSegment(value) {
  return String(value || '')
    .trim()
    .replaceAll('\\', '/')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._/-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-/]+|[-/]+$/g, '')
    .toLowerCase() || 'item';
}

function getAvatarFolder(username) {
  return `avatars/${sanitizeSegment(username || 'profile')}`;
}

function maskEmail(email = '') {
  const value = String(email || '').trim();
  if (!value.includes('@')) {
    return value;
  }

  const [local, domain] = value.split('@');
  const [host, ...rest] = domain.split('.');
  const maskedLocal = local.length <= 2 ? `${local.slice(0, 1)}*` : `${local.slice(0, 2)}***`;
  const maskedHost = host.length <= 1 ? `${host.slice(0, 1)}*` : `${host.slice(0, 1)}***`;

  return `${maskedLocal}@${maskedHost}${rest.length ? `.${rest.join('.')}` : ''}`;
}

function isValidEmailAddress(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function getAuthRedirectUrl(pathname = '/login') {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const { protocol, origin } = window.location;
  if (!/^https?:$/i.test(protocol) || !origin || origin === 'null') {
    return undefined;
  }

  return `${origin}${pathname}`;
}

function getStoragePathFromPublicUrl(publicUrl = '') {
  const url = String(publicUrl || '').trim();
  if (!url) {
    return '';
  }

  try {
    const parsed = new URL(url);
    const marker = '/object/public/media/';
    const index = parsed.pathname.indexOf(marker);
    if (index >= 0) {
      return decodeURIComponent(parsed.pathname.slice(index + marker.length));
    }

    const genericMarker = '/object/public/';
    const genericIndex = parsed.pathname.indexOf(genericMarker);
    if (genericIndex >= 0) {
      return decodeURIComponent(parsed.pathname.slice(genericIndex + genericMarker.length));
    }
  } catch (error) {
    return '';
  }

  return '';
}

function hasDesktopStorageBridge() {
  return Boolean(window.desktop?.uploadStorageFile && window.desktop?.listStorageFiles && window.desktop?.removeStorageFiles);
}

function isMissingSongsStatusColumnError(error) {
  const message = String(error?.message || error?.error_description || error?.details || '').toLowerCase();
  return message.includes("could not find the 'status' column of 'songs' in the schema cache")
    || message.includes('column "status" does not exist')
    || message.includes('column "status" of relation "songs" does not exist')
    || message.includes('schema cache');
}

function isMissingInfoBlocksTableError(error) {
  const message = String(error?.message || error?.error_description || error?.details || '').toLowerCase();
  return (
    message.includes("could not find the table 'public.app_info_blocks' in the schema cache") ||
    message.includes('schema cache') ||
    message.includes('relation "public.app_info_blocks" does not exist') ||
    message.includes('table "app_info_blocks" does not exist') ||
    message.includes('could not find relation')
  );
}

function isMissingMusicReleasesTableError(error) {
  const message = String(error?.message || error?.error_description || error?.details || '').toLowerCase();
  return (
    message.includes("could not find the table 'public.music_releases' in the schema cache") ||
    message.includes('relation "public.music_releases" does not exist') ||
    message.includes('table "music_releases" does not exist') ||
    message.includes('could not find relation')
  );
}

function isMissingMusicReleaseRpcError(error, functionName) {
  const message = String(error?.message || error?.error_description || error?.details || '').toLowerCase();
  const normalizedFunctionName = String(functionName || '').toLowerCase();
  return (
    message.includes(`function public.${normalizedFunctionName}`) ||
    message.includes(`public.${normalizedFunctionName}`) ||
    message.includes(`function "${normalizedFunctionName}"`) ||
    message.includes(`function ${normalizedFunctionName}`) ||
    message.includes('could not find the function') ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  );
}

function buildActivityItems(songRows = [], messageRows = [], allowedUsers = []) {
  const songItems = (songRows || []).slice(0, 6).map((song) => ({
    id: 'song-' + song.id,
    kind: 'song',
    title: song.title || 'Untitled',
    body: (song.last_edited_by || 'Iemand') + ' werkte aan deze song.',
    timestamp: song.updated_at,
    link: '/editor/' + song.id,
    actorName: song.last_edited_by || '',
    avatarUrl: resolveAvatarUrl(findAllowedUser(song.last_edited_by, allowedUsers))
  }));

  const messageItems = (messageRows || []).slice(0, 6).map((message) => ({
    id: 'message-' + message.id,
    kind: message.scope === 'private' ? 'private_message' : 'team_message',
    title: message.scope === 'private' ? `Privé van ${message.sender || 'iemand'}` : `Team van ${message.sender || 'iemand'}`,
    body: message.body || 'Nieuw bericht',
    timestamp: message.created_at,
    link: '/chat',
    actorName: message.sender || '',
    avatarUrl: resolveAvatarUrl(findAllowedUser(message.sender, allowedUsers))
  }));

  return [...songItems, ...messageItems]
    .filter((item) => item.timestamp)
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
    .slice(0, 8);
}


function ProtectedLayout({
  currentUser,
  onSignOut,
  notificationCount,
  onProfileSave,
  onAvatarUpload,
  onAvatarDelete,
  onEmailChange,
  onPublishInfo,
  onPublishUpdate
}) {
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Suspense
      fallback={
        <div className="empty-state">
          <strong>Werkruimte laden...</strong>
          <p>We openen de app veilig.</p>
        </div>
      }
    >
      <AppShell
        user={currentUser}
        onSignOut={onSignOut}
        notificationCount={notificationCount}
        onProfileSave={onProfileSave}
        onAvatarUpload={onAvatarUpload}
        onAvatarDelete={onAvatarDelete}
        onEmailChange={onEmailChange}
        onPublishInfo={onPublishInfo}
        onPublishUpdate={onPublishUpdate}
      >
        <Outlet />
      </AppShell>
    </Suspense>
  );
}

function normalizePresenceUsername(value) {
  return normalizeUsername(value);
}

function EditorRoute(props) {
  const { songId } = useParams();
  const currentSong = props.songs.find((song) => song.id === songId) || null;
  const [resolvedSong, setResolvedSong] = useState(currentSong);
  const [loadingSong, setLoadingSong] = useState(Boolean(songId) && !currentSong);

  useEffect(() => {
    setResolvedSong(currentSong);
  }, [currentSong?.id, currentSong?.updated_at]);

  useEffect(() => {
    let cancelled = false;

    async function loadMissingSong() {
      if (!songId || currentSong) {
        setLoadingSong(false);
        return;
      }

      if (props.songsLoading) {
        setLoadingSong(true);
        return;
      }

      setLoadingSong(true);

      if (!isSupabaseConfigured || !supabase) {
        const demoSong = getDemoSongs().find((song) => song.id === songId) || null;
        if (!cancelled) {
          setResolvedSong(demoSong);
          setLoadingSong(false);
        }
        return;
      }

      const { data, error } = await supabase.from('songs').select('*').eq('id', songId).maybeSingle();

      if (cancelled) {
        return;
      }

      if (error) {
        console.error(error);
        setResolvedSong(null);
      } else {
        setResolvedSong(data || null);
      }

      setLoadingSong(false);
    }

    loadMissingSong();

    return () => {
      cancelled = true;
    };
  }, [songId, currentSong, props.songsLoading]);

  if (!resolvedSong && (props.songsLoading || loadingSong)) {
    return (
      <div className="empty-state">
        <strong>Song laden...</strong>
        <p>We openen het nummer zodra de songs gesynchroniseerd zijn.</p>
      </div>
    );
  }

  if (!resolvedSong) {
    return (
      <div className="empty-state">
        <strong>Song niet gevonden</strong>
        <p>Ga terug naar het dashboard en open de song opnieuw.</p>
        <button className="button button--primary" type="button" onClick={() => props.navigate('/dashboard')}>
          Song kiezen
        </button>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="empty-state">
          <strong>Editor laden...</strong>
          <p>We openen het nummer.</p>
        </div>
      }
    >
      <EditorPage
        {...props}
        song={resolvedSong}
        onOpenSongPicker={() => props.navigate('/dashboard')}
        onSongImported={async (payload) => {
          if (!payload || !resolvedSong) {
            return;
          }

          await props.onSaveSong(resolvedSong.id, {
            title: payload.title || resolvedSong.title,
            lyrics: payload.lyrics || resolvedSong.lyrics,
            cover_url: payload.coverUrl || resolvedSong.cover_url,
            status: normalizeSongStatus(payload.status || resolvedSong.status),
            last_edited_by: props.currentUser?.displayName || resolvedSong.last_edited_by
          });
        }}
      />
    </Suspense>
  );
}

function LoginRoute({
  currentUser,
  onLogin,
  onVerifyCode,
  onResendCode,
  onForgotPassword,
  onRecoverPassword,
  onBack,
  stage,
  codeTarget,
  identityLabel,
  hint,
  loading,
  error,
  forgotPasswordEnabled,
  showSetupNotice
}) {
  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Suspense
      fallback={
        <div className="empty-state">
          <strong>Login laden...</strong>
          <p>We zetten de toegang klaar.</p>
        </div>
      }
    >
      <>
        {showSetupNotice ? <SetupNotice /> : null}
        <LoginPage
          stage={stage}
          codeTarget={codeTarget}
          identityLabel={identityLabel}
          hint={hint}
          onLogin={onLogin}
          onVerifyCode={onVerifyCode}
          onResendCode={onResendCode}
          onRequestPasswordReset={onForgotPassword}
          onRecoverPassword={onRecoverPassword}
          onBack={onBack}
          forgotPasswordEnabled={forgotPasswordEnabled}
          loading={loading}
          error={error}
        />
      </>
    </Suspense>
  );
}

export default function App() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [loginHint, setLoginHint] = useState('');
  const [loginStage, setLoginStage] = useState('credentials');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginIdentity, setLoginIdentity] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginFailedAttempts, setLoginFailedAttempts] = useState(0);
  const [allowedUsers, setAllowedUsers] = useState(DEFAULT_ALLOWED_USERS);
  const [songs, setSongs] = useState([]);
  const [songsLoading, setSongsLoading] = useState(true);
  const [musicReleases, setMusicReleases] = useState([]);
  const [musicReleasesLoading, setMusicReleasesLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [createSongOpen, setCreateSongOpen] = useState(false);
  const [createSongBusy, setCreateSongBusy] = useState(false);
  const [createSongError, setCreateSongError] = useState('');
  const [onlineUsernames, setOnlineUsernames] = useState([]);
  const [presenceLastSeenByUsername, setPresenceLastSeenByUsername] = useState(() => {
    if (typeof window === 'undefined') {
      return {};
    }

    try {
      const stored = window.localStorage.getItem('yowlmaffia:presence-last-seen');
      if (!stored) {
        return {};
      }

      const parsed = JSON.parse(stored);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });
  const cleanedAvatarFoldersRef = useRef(new Set());
  const loginFlowBypassRef = useRef(false);

  const loadSongs = async () => {
    setSongsLoading(true);

    if (!isSupabaseConfigured || !supabase) {
      if (!allowOfflineDemo) {
        setSongs([]);
        setSongsLoading(false);
        return;
      }

      setSongs(getDemoSongs());
      setSongsLoading(false);
      return;
    }

    const { data, error } = await supabase.from('songs').select('*').order('updated_at', { ascending: false });

    if (error) {
      console.error(error);
      setSongs([]);
    } else {
      setSongs(data || []);
    }

    setSongsLoading(false);
  };

  const loadMusicReleases = async () => {
    setMusicReleasesLoading(true);

    if (!isSupabaseConfigured || !supabase) {
      if (!allowOfflineDemo) {
        setMusicReleases([]);
        setMusicReleasesLoading(false);
        return;
      }

      setMusicReleases([]);
      setMusicReleasesLoading(false);
      return;
    }

    try {
      const loaded = await loadMusicReleasesFromDatabase(supabase);
      setMusicReleases(loaded);
    } catch (error) {
      console.error(error);
      setMusicReleases([]);
    }

    setMusicReleasesLoading(false);
  };

  const loadNotifications = async () => {
    setNotificationsLoading(true);

    if (!currentUser || !supabase) {
      setNotifications([]);
      setNotificationsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_email', currentUser.email)
      .order('created_at', { ascending: false })
      .limit(8);

    if (error) {
      console.error(error);
      setNotifications([]);
    } else {
      setNotifications((data || []).map((notification) => ({
        ...notification,
        actorAvatarUrl: resolveAvatarUrl(findAllowedUser(notification.actor_username, allowedUsers))
      })));
    }

    setNotificationsLoading(false);
  };

  const loadActivity = async () => {
    setActivityLoading(true);

    if (!supabase) {
      setActivity(buildActivityItems(songs, [], allowedUsers));
      setActivityLoading(false);
      return;
    }

    try {
      const [{ data: songRows = [] }, { data: messageRows = [] }] = await Promise.all([
        supabase.from('songs').select('*').order('updated_at', { ascending: false }).limit(6),
        supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(6)
      ]);

      setActivity(buildActivityItems(songRows, messageRows, allowedUsers));
    } catch (error) {
      console.error(error);
      setActivity(buildActivityItems(songs, [], allowedUsers));
    }

    setActivityLoading(false);
  };

  async function cleanupAvatarFolderForUser(userProfile) {
    if (!userProfile?.username) {
      return;
    }

    const avatarFolder = getAvatarFolder(userProfile.username);
    const listOptions = { limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } };

    let data = [];
    let error = null;

    if (supabase && hasDesktopStorageBridge() && session?.access_token && supabaseUrl && supabaseAnonKey) {
      try {
        data = await window.desktop.listStorageFiles({
          supabaseUrl,
          supabaseAnonKey,
          accessToken: session.access_token,
          bucket: 'media',
          folder: avatarFolder,
          options: listOptions
        });
      } catch (bridgeError) {
        error = bridgeError;
      }
    } else if (supabase) {
      const result = await supabase.storage.from('media').list(avatarFolder, listOptions);
      data = result.data || [];
      error = result.error;
    }

    if (error) {
      throw error;
    }

    const keepPath = getStoragePathFromPublicUrl(userProfile.avatar_url || '');
    const keepName = keepPath.startsWith(`${avatarFolder}/`) ? keepPath.slice(`${avatarFolder}/`.length) : 'avatar';
    const removePaths = (data || [])
      .filter((item) => item?.name && item.name !== keepName)
      .map((item) => `${avatarFolder}/${item.name}`);

    if (removePaths.length) {
      if (supabase && hasDesktopStorageBridge() && session?.access_token && supabaseUrl && supabaseAnonKey) {
        const removeResult = await window.desktop.removeStorageFiles({
          supabaseUrl,
          supabaseAnonKey,
          accessToken: session.access_token,
          bucket: 'media',
          paths: removePaths
        });

        if (!removeResult?.deleted) {
          throw new Error('Profielfoto-opruiming mislukt.');
        }
      } else if (supabase) {
        const { error: removeError } = await supabase.storage.from('media').remove(removePaths);
        if (removeError) {
          throw removeError;
        }
      }
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrapAuth() {
      if (!supabase) {
        setAuthLoading(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (cancelled) {
        return;
      }

      setSession(data.session || null);
      setCurrentUser(resolveUserFromSession(data.session, allowedUsers));
      setAuthLoading(false);
    }

    bootstrapAuth();

    if (supabase) {
      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange((event, nextSession) => {
        if (loginFlowBypassRef.current) {
          return;
        }

        setSession(nextSession || null);
        setCurrentUser(resolveUserFromSession(nextSession, allowedUsers));

        if (event === 'PASSWORD_RECOVERY') {
          setLoginStage('recovery');
          setLoginEmail(nextSession?.user?.email || '');
          setLoginIdentity(
            nextSession?.user?.user_metadata?.display_name
              || nextSession?.user?.user_metadata?.displayName
              || nextSession?.user?.user_metadata?.name
              || nextSession?.user?.email
              || ''
          );
          setLoginHint('Kies een nieuw wachtwoord om weer toegang te krijgen.');
          setAuthError('');
        }
      });

      return () => {
        cancelled = true;
        subscription.unsubscribe();
      };
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapAllowedUsers() {
      const users = await loadAllowedUsers();
      if (!cancelled) {
        setAllowedUsers(users);
      }
    }

    bootstrapAllowedUsers();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    let cancelled = false;
    const channel = supabase
      .channel('allowed-users-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'allowed_users' }, async () => {
        const users = await loadAllowedUsers();
        if (!cancelled) {
          setAllowedUsers(users);
        }
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (session) {
      setCurrentUser(resolveUserFromSession(session, allowedUsers));
    }
  }, [session, allowedUsers]);

  useEffect(() => {
    if (!currentUser) {
      setActivity([]);
      setActivityLoading(false);
      return undefined;
    }

    loadActivity();
    return undefined;
  }, [currentUser, songs]);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setNotificationsLoading(false);
      return undefined;
    }

    loadNotifications();
    return undefined;
  }, [currentUser]);

  useEffect(() => {
    try {
      window.localStorage.setItem('yowlmaffia:presence-last-seen', JSON.stringify(presenceLastSeenByUsername));
    } catch {
      // Ignore localStorage errors and keep presence working.
    }
  }, [presenceLastSeenByUsername]);

  useEffect(() => {
    if (!currentUser || !supabase) {
      setOnlineUsernames([]);
      return undefined;
    }

    let cancelled = false;
    const channel = supabase.channel('team-presence');

    const syncPresenceUsers = () => {
      const state = channel.presenceState();
      const nextUsernames = new Set();
      const nextLastSeen = {};

      Object.values(state)
        .flat()
        .forEach((entry) => {
          const username = normalizePresenceUsername(entry.username || entry.id || entry.userId || entry.email || '');
          if (username) {
            nextUsernames.add(username);
            const seenAt = Number(entry.updatedAt || entry.updated_at || entry.lastSeenAt || Date.now());
            nextLastSeen[username] = Number.isFinite(seenAt) ? seenAt : Date.now();
          }
        });

      if (!cancelled) {
        setOnlineUsernames(Array.from(nextUsernames));
        setPresenceLastSeenByUsername((prev) => {
          const merged = { ...(prev || {}) };

          Object.entries(nextLastSeen).forEach(([username, seenAt]) => {
            merged[username] = seenAt;
          });

          return merged;
        });
      }
    };

    setOnlineUsernames([normalizePresenceUsername(currentUser.username)].filter(Boolean));
    setPresenceLastSeenByUsername((prev) => ({
      ...(prev || {}),
      [normalizePresenceUsername(currentUser.username)]: Date.now()
    }));

    channel.on('presence', { event: 'sync' }, syncPresenceUsers);
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await channel.track({
            id: currentUser.username,
            username: currentUser.username,
            name: currentUser.displayName || currentUser.username,
            avatar_url: currentUser.avatar_url || '',
            email: currentUser.email,
            status: 'online',
            updatedAt: Date.now()
          });
        } catch (error) {
          console.error(error);
        }

        syncPresenceUsers();
      }
    });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [currentUser?.username, currentUser?.displayName, currentUser?.avatar_url, currentUser?.email]);

  useEffect(() => {
    if (!currentUser || !supabase || !currentUser.username) {
      return undefined;
    }

    const cleanupKey = normalizeUsername(currentUser.username);
    if (!cleanupKey || cleanedAvatarFoldersRef.current.has(cleanupKey)) {
      return undefined;
    }

    let cancelled = false;

    async function cleanupAvatarFolder() {
      try {
        const avatarFolder = getAvatarFolder(currentUser.username);
        const { data, error } = await supabase.storage.from('media').list(avatarFolder, {
          limit: 1000,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' }
        });

        if (error || cancelled) {
          return;
        }

        const keepPath = getStoragePathFromPublicUrl(currentUser.avatar_url || '');
        const keepName = keepPath.startsWith(`${avatarFolder}/`) ? keepPath.slice(`${avatarFolder}/`.length) : 'avatar';
        const removePaths = (data || [])
          .filter((item) => item?.name && item.name !== keepName)
          .map((item) => `${avatarFolder}/${item.name}`);

        if (removePaths.length) {
          const { error: removeError } = await supabase.storage.from('media').remove(removePaths);
          if (removeError) {
            console.error(removeError);
          }
        }

        cleanedAvatarFoldersRef.current.add(cleanupKey);
      } catch (error) {
        console.error(error);
      }
    }

    cleanupAvatarFolder();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.username, currentUser?.avatar_url]);

  useEffect(() => {
    if (!currentUser) {
      return undefined;
    }

    loadSongs();
    loadMusicReleases();

    if (!supabase) {
      return undefined;
    }

    const songsChannel = supabase
      .channel('songs-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, () => {
        loadSongs();
      })
      .subscribe();

    const musicReleasesChannel = supabase
      .channel('music-releases-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'music_releases' }, () => {
        loadMusicReleases();
      })
      .subscribe();

    const notificationsChannel = supabase
      .channel(`notifications-live-${currentUser.email}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `recipient_email=eq.${currentUser.email}` },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    const messagesActivityChannel = supabase
      .channel('messages-activity-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        loadActivity();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(songsChannel);
      supabase.removeChannel(musicReleasesChannel);
      supabase.removeChannel(notificationsChannel);
      supabase.removeChannel(messagesActivityChannel);
    };
  }, [currentUser, allowedUsers]);

  const activeUser = useMemo(() => currentUser || null, [currentUser]);
  const unreadNotificationCount = notifications.filter((notification) => !notification.is_read).length;

  function resetLoginFlow() {
    setLoginStage('credentials');
    setLoginEmail('');
    setLoginIdentity('');
    setLoginHint('');
    setAuthError('');
  }

  async function handleLogin({ username, password }) {
    setAuthError('');
    setLoginHint('');
    let user = findAllowedUser(username, allowedUsers);

    if (!user || !user.email) {
      const freshUsers = await loadAllowedUsers();
      setAllowedUsers(freshUsers);
      user = findAllowedUser(username, freshUsers);
    }

    if (!user) {
      setAuthError('Dit account staat niet in de toegelaten lijst.');
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      if (!allowOfflineDemo) {
        setAuthError('Supabase is niet gekoppeld. Vul de online instellingen in en bouw opnieuw.');
        return;
      }

      if (!password.trim()) {
        setAuthError('Vul een wachtwoord in om door te gaan.');
        return;
      }

      setLoginFailedAttempts(0);
      setCurrentUser(user);
      setSession({ user: { email: user.email, id: `local-${user.username}` } });
      resetLoginFlow();
      navigate('/dashboard');
      return;
    }

    loginFlowBypassRef.current = true;
    setLoginBusy(true);

    try {
      const { error: passwordError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password
      });

      if (passwordError) {
        const normalizedMessage = String(passwordError.message || '').toLowerCase();
        if (normalizedMessage.includes('invalid login credentials')) {
          setLoginFailedAttempts((count) => count + 1);
          setAuthError('Onjuiste username, e-mail of wachtwoord. Controleer het juiste YOWLMAFFIA-account en probeer opnieuw.');
        } else {
          setAuthError(passwordError.message || 'Inloggen mislukt.');
        }
        return;
      }

      setLoginFailedAttempts(0);
      await supabase.auth.signOut();

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: user.email,
        options: {
          shouldCreateUser: false
        }
      });

      if (otpError) {
        setAuthError(otpError.message || 'We konden de inlogcode niet sturen.');
        return;
      }

      setLoginStage('otp');
      setLoginEmail(user.email);
      setLoginIdentity(user.displayName || user.username || user.email);
      setLoginHint(`We hebben een inlogcode gestuurd naar ${maskEmail(user.email)}.`);
      setSession(null);
      setCurrentUser(null);
    } finally {
      loginFlowBypassRef.current = false;
      setLoginBusy(false);
    }
  }

  async function handleVerifyLoginCode({ code }) {
    setAuthError('');
    setLoginHint('');

    if (!supabase) {
      setAuthError('Supabase is niet gekoppeld.');
      return;
    }

    const nextCode = String(code || '').trim();
    if (!nextCode) {
      setAuthError('Vul de code in die je per mail kreeg.');
      return;
    }

    if (!loginEmail) {
      setAuthError('We missen het e-mailadres voor deze code. Log opnieuw in.');
      resetLoginFlow();
      return;
    }

    setLoginBusy(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: loginEmail,
        token: nextCode,
        type: 'email'
      });

      if (error) {
        setAuthError(error.message || 'De code klopt niet of is verlopen.');
        return;
      }

      const resolvedUser = resolveUserFromSession(data.session, allowedUsers) || findAllowedUser(loginIdentity, allowedUsers) || findAllowedUser(loginEmail, allowedUsers);

      setSession(data.session || null);
      setCurrentUser(resolvedUser);
      setLoginFailedAttempts(0);
      resetLoginFlow();
      navigate('/dashboard');
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleResendLoginCode() {
    setAuthError('');
    setLoginHint('');

    if (!supabase) {
      setAuthError('Supabase is niet gekoppeld.');
      return;
    }

    if (!loginEmail) {
      setAuthError('Log eerst opnieuw in om een nieuwe code te sturen.');
      return;
    }

    setLoginBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: loginEmail,
        options: {
          shouldCreateUser: false
        }
      });

      if (error) {
        setAuthError(error.message || 'We konden geen nieuwe code sturen.');
        return;
      }

      setLoginHint(`We stuurden een nieuwe code naar ${maskEmail(loginEmail)}.`);
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleForgotPassword({ email } = {}) {
    const nextEmail = String(email || '').trim();

    if (!isValidEmailAddress(nextEmail)) {
      throw new Error('Vul een geldig e-mailadres in.');
    }

    let user = findAllowedUser(nextEmail, allowedUsers);
    if (!user || !user.email) {
      const freshUsers = await loadAllowedUsers();
      setAllowedUsers(freshUsers);
      user = findAllowedUser(nextEmail, freshUsers);
    }

    if (!user || !user.email) {
      throw new Error('Dit e-mailadres hoort niet bij een YOWLMAFFIA-account.');
    }

    if (!supabase) {
      throw new Error('Supabase is niet gekoppeld.');
    }

    const redirectTo = getAuthRedirectUrl('/login');
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, redirectTo ? { redirectTo } : undefined);

    if (error) {
      throw new Error(error.message || 'We konden de resetmail niet sturen.');
    }

    return {
      message: `Resetmail verstuurd naar ${maskEmail(user.email)}.`
    };
  }

  async function handleRecoverPassword({ password, confirmPassword } = {}) {
    const nextPassword = String(password || '');
    const nextConfirmPassword = String(confirmPassword || '');

    if (!supabase) {
      throw new Error('Supabase is niet gekoppeld.');
    }

    if (!nextPassword.trim()) {
      throw new Error('Vul een nieuw wachtwoord in.');
    }

    if (nextPassword.length < 6) {
      throw new Error('Kies een wachtwoord van minstens 6 tekens.');
    }

    if (nextPassword !== nextConfirmPassword) {
      throw new Error('De wachtwoorden komen niet overeen.');
    }

    const { error } = await supabase.auth.updateUser({ password: nextPassword });
    if (error) {
      throw new Error(error.message || 'Wachtwoord wijzigen mislukt.');
    }

    await supabase.auth.signOut();
    setSession(null);
    setCurrentUser(null);
    setLoginEmail('');
    setLoginIdentity('');
    setLoginHint('Wachtwoord aangepast. Log opnieuw in met je nieuwe wachtwoord.');
    setAuthError('');
    setLoginStage('credentials');
    setLoginFailedAttempts(0);
    navigate('/login');

    return {
      message: 'Wachtwoord aangepast. Log opnieuw in met je nieuwe wachtwoord.'
    };
  }

  function handleBackToCredentials() {
    resetLoginFlow();
  }

  async function handleSignOut() {
    if (supabase && session) {
      await supabase.auth.signOut();
    }

    setSession(null);
    setCurrentUser(null);
    setLoginFailedAttempts(0);
    resetLoginFlow();
    navigate('/login');
  }

  async function handleSaveProfile(patch) {
    if (!currentUser) {
      return null;
    }

    const nextProfile = {
      bio: String(patch?.bio || '').trim(),
      status_message: String(patch?.status_message || '').trim(),
      avatar_url: String(patch?.avatar_url || '').trim(),
      updated_at: new Date().toISOString()
    };

    if (!supabase) {
      setAllowedUsers((previous) =>
        previous.map((user) =>
          user.username === currentUser.username
            ? {
                ...user,
                ...nextProfile
              }
            : user
        )
      );
      const nextCurrentUser = currentUser ? { ...currentUser, ...nextProfile } : currentUser;
      setCurrentUser(nextCurrentUser);
      cacheAllowedUserProfile(nextCurrentUser);
      return nextCurrentUser;
    }

    const { data, error } = await supabase
      .from('allowed_users')
      .update(nextProfile)
      .eq('email', currentUser.email)
      .select('username, email, display_name, accent, avatar_url, updated_at, bio, status_message')
      .maybeSingle();

    if (error) {
      console.error(error);
      throw error;
    }

    const normalized = data
      ? {
          ...currentUser,
          avatar_url: data.avatar_url || '',
          updated_at: data.updated_at || nextProfile.updated_at,
          bio: data.bio || '',
          status_message: data.status_message || ''
        }
      : { ...currentUser, ...nextProfile };

    setAllowedUsers((previous) =>
      previous.map((user) =>
        user.username === currentUser.username
          ? {
              ...user,
              ...nextProfile,
              avatar_url: data?.avatar_url || nextProfile.avatar_url || '',
              updated_at: data?.updated_at || nextProfile.updated_at
            }
          : user
      )
    );
    setCurrentUser(normalized);
    cacheAllowedUserProfile(normalized);
    try {
      await cleanupAvatarFolderForUser(normalized);
    } catch (cleanupError) {
      console.error(cleanupError);
    }
    const freshUsers = await loadAllowedUsers();
    setAllowedUsers(freshUsers);
    const refreshedCurrentUser = findAllowedUser(currentUser.username, freshUsers) || normalized;
    setCurrentUser(refreshedCurrentUser);
    cacheAllowedUserProfile(refreshedCurrentUser);
    return refreshedCurrentUser;
  }

  async function handleUploadProfileAvatar(file) {
    if (!file) {
      return { url: '' };
    }

    if (!currentUser) {
      throw new Error('Je moet eerst ingelogd zijn.');
    }

    const avatarPrefix = `avatars/${sanitizeSegment(currentUser.username || currentUser.displayName || 'profile')}`;
    const safeExtension = file.name.includes('.') ? `.${sanitizeSegment(file.name.split('.').pop() || '')}` : '';
    const uploadPath = `${avatarPrefix}/avatar-${Date.now()}-${crypto.randomUUID()}${safeExtension}`;

    const uploaded = await uploadFileToStorage(file, 'media', 'avatars', {
      fixedPath: uploadPath,
      upsert: false
    });

    try {
      await cleanupAvatarFolderForUser({
        ...currentUser,
        avatar_url: uploaded.url || currentUser.avatar_url || ''
      });
    } catch (cleanupError) {
      console.error(cleanupError);
    }

    return uploaded;
  }

  async function handleDeleteProfileAvatar() {
    if (!currentUser) {
      throw new Error('Je moet eerst ingelogd zijn.');
    }

    if (!supabase) {
      return { deleted: true };
    }

    const avatarFolder = getAvatarFolder(currentUser.username || currentUser.displayName || 'profile');
    const listOptions = { limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } };

    let data = [];
    let error = null;

    if (hasDesktopStorageBridge() && session?.access_token && supabaseUrl && supabaseAnonKey) {
      try {
        data = await window.desktop.listStorageFiles({
          supabaseUrl,
          supabaseAnonKey,
          accessToken: session.access_token,
          bucket: 'media',
          folder: avatarFolder,
          options: listOptions
        });
      } catch (bridgeError) {
        error = bridgeError;
      }
    } else {
      const result = await supabase.storage.from('media').list(avatarFolder, listOptions);
      data = result.data || [];
      error = result.error;
    }

    if (error) {
      throw error;
    }

    const removePaths = (data || [])
      .filter((item) => item?.name)
      .map((item) => `${avatarFolder}/${item.name}`);

    if (removePaths.length) {
      if (hasDesktopStorageBridge() && session?.access_token && supabaseUrl && supabaseAnonKey) {
        const removeResult = await window.desktop.removeStorageFiles({
          supabaseUrl,
          supabaseAnonKey,
          accessToken: session.access_token,
          bucket: 'media',
          paths: removePaths
        });

        if (!removeResult?.deleted) {
          throw new Error('Profielfoto verwijderen mislukt.');
        }
      } else {
        const { error: removeError } = await supabase.storage.from('media').remove(removePaths);
        if (removeError) {
          throw removeError;
        }
      }
    }

    try {
      await cleanupAvatarFolderForUser({
        ...currentUser,
        avatar_url: ''
      });
    } catch (cleanupError) {
      console.error(cleanupError);
    }

    return { deleted: true };
  }

  async function handleChangeEmail({ email } = {}) {
    if (!currentUser) {
      throw new Error('Je moet eerst ingelogd zijn.');
    }

    const nextEmail = String(email || '').trim().toLowerCase();
    if (!isValidEmailAddress(nextEmail)) {
      throw new Error('Vul een geldig e-mailadres in.');
    }

    const existing = allowedUsers.find((user) => normalizeUsername(user.email) === normalizeUsername(nextEmail));
    if (existing && normalizeUsername(existing.username) !== normalizeUsername(currentUser.username)) {
      throw new Error('Dit e-mailadres is al gekoppeld aan een ander account.');
    }

    if (!supabase) {
      throw new Error('Supabase is niet gekoppeld.');
    }

    const { error } = await supabase.auth.updateUser({ email: nextEmail });
    if (error) {
      throw new Error(error.message || 'E-mailadres wijzigen mislukt.');
    }

    const nextProfile = {
      email: nextEmail,
      updated_at: new Date().toISOString()
    };

    const { data, error: updateError } = await supabase
      .from('allowed_users')
      .update(nextProfile)
      .eq('username', currentUser.username)
      .select('username, email, display_name, accent, avatar_url, updated_at, bio, status_message')
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    const nextCurrentUser = data
      ? {
          ...currentUser,
          email: data.email || nextEmail,
          updated_at: data.updated_at || nextProfile.updated_at
        }
      : {
          ...currentUser,
          email: nextEmail,
          updated_at: nextProfile.updated_at
        };

    setAllowedUsers((previous) =>
      previous.map((user) =>
        normalizeUsername(user.username) === normalizeUsername(currentUser.username)
          ? {
              ...user,
              email: nextEmail,
              updated_at: nextProfile.updated_at
            }
          : user
      )
    );
    setCurrentUser(nextCurrentUser);
    setSession((previous) =>
      previous
        ? {
            ...previous,
            user: {
              ...previous.user,
              email: nextEmail
            }
          }
        : previous
    );
    cacheAllowedUserProfile(nextCurrentUser);

    return {
      message: `Bevestigingsmail verstuurd naar ${maskEmail(nextEmail)}.`
    };
  }

  async function handleCreateSong({ title, lyrics } = {}) {
    if (!currentUser || createSongBusy) {
      return;
    }

    setCreateSongError('');
    const nextTitle = String(title || '').trim() || `Nieuw nummer ${songs.length + 1}`;
    const nextLyrics = String(lyrics || '').trim();
    const songId = crypto.randomUUID();
    let createdSongId = songId;

    setCreateSongBusy(true);
    try {
      if (!supabase) {
        if (!allowOfflineDemo) {
          return;
        }

        const demoSong = getDemoSongs()[0];
        setCreateSongOpen(false);
        navigate(`/editor/${demoSong.id}`);
        return;
      }

      const { data, error } = await supabase
        .from('songs')
        .insert({
          id: songId,
          title: nextTitle,
          lyrics: nextLyrics,
          cover_url: '',
          last_edited_by: currentUser.displayName || currentUser.username || 'Onbekend',
          updated_at: new Date().toISOString()
        })
        .select('id')
        .maybeSingle();

      if (error) {
        if (!isMissingSongsStatusColumnError(error)) {
          console.error(error);
          setCreateSongError(error.message || 'Song maken mislukt.');
          return;
        }

        const fallback = await supabase
          .from('songs')
          .insert({
            id: songId,
            title: nextTitle,
            lyrics: nextLyrics,
            cover_url: '',
            last_edited_by: currentUser.displayName || currentUser.username || 'Onbekend',
            updated_at: new Date().toISOString()
          })
          .select('id')
          .maybeSingle();

        if (fallback.error) {
          console.error(fallback.error);
          setCreateSongError(fallback.error.message || 'Song maken mislukt.');
          return;
        }

        createdSongId = fallback.data?.id || songId;
      } else {
        createdSongId = data?.id || songId;
      }

      await loadSongs();
      setCreateSongOpen(false);
      navigate(`/editor/${createdSongId}`);
    } finally {
      setCreateSongBusy(false);
    }
  }

  async function handleNewSong() {
    if (!currentUser) {
      return;
    }

    setCreateSongError('');
    setCreateSongOpen(true);
  }

  async function handleSaveSong(songId, patch) {
    if (!supabase) {
      if (!allowOfflineDemo) {
        return;
      }

      setSongs((previous) =>
        previous.map((song) =>
          song.id === songId
            ? {
                ...song,
                ...patch,
                updated_at: new Date().toISOString()
              }
            : song
        )
      );
      return;
    }

    const { error } = await supabase
      .from('songs')
      .update({
        title: patch.title,
        lyrics: patch.lyrics,
        cover_url: patch.cover_url,
        status: normalizeSongStatus(patch.status),
        last_edited_by: patch.last_edited_by,
        updated_at: new Date().toISOString()
      })
      .eq('id', songId);

    if (error) {
      if (!isMissingSongsStatusColumnError(error)) {
        console.error(error);
        throw error;
      }

      const fallback = await supabase
        .from('songs')
        .update({
          title: patch.title,
          lyrics: patch.lyrics,
          cover_url: patch.cover_url,
          last_edited_by: patch.last_edited_by,
          updated_at: new Date().toISOString()
        })
        .eq('id', songId);

      if (fallback.error) {
        console.error(fallback.error);
        throw fallback.error;
      }
    }

    loadSongs();
  }

  async function handleDeleteSong(songId) {
    if (!songId) {
      return;
    }

    if (!supabase) {
      if (!allowOfflineDemo) {
        return;
      }

      setSongs((previous) => previous.filter((song) => song.id !== songId));
      navigate('/dashboard');
      return;
    }

    const { error } = await supabase.from('songs').delete().eq('id', songId);

    if (error) {
      console.error(error);
      throw error;
    }

    await loadSongs();
    navigate('/dashboard');
  }

  async function handleMarkNotificationRead(notificationId) {
    if (!notificationId || !supabase || !currentUser) {
      return;
    }

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('recipient_email', currentUser.email);

    if (error) {
      console.error(error);
      return;
    }

    loadNotifications();
  }

  async function handleClearAllNotifications() {
    if (!supabase || !currentUser) {
      return;
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: now })
      .eq('recipient_email', currentUser.email)
      .eq('is_read', false);

    if (error) {
      console.error(error);
      return;
    }

    await loadNotifications();
  }

  async function handleOpenNotification(notification) {
    if (!notification) {
      return;
    }

    if (notification.recipient_email && notification.id) {
      await handleMarkNotificationRead(notification.id);
    }

    if (notification.link) {
      navigate(notification.link);
    }
  }

  async function handlePublishUpdate({ version = '', notes = '', file = null, downloadUrl = '', isRequired = false } = {}) {
    if (!currentUser) {
      throw new Error('Je moet ingelogd zijn om updates te publiceren.');
    }

    if (normalizeUsername(currentUser.username) !== 'mattiz') {
      throw new Error('Alleen Mattiz mag updates publiceren.');
    }

    if (!supabase) {
      throw new Error('Supabase is niet gekoppeld.');
    }

    const nextVersion = String(version || '').trim();
    const nextNotes = String(notes || '').trim();
    const currentVersion = await getAppVersion();

    if (!nextVersion) {
      throw new Error('Geef een versienummer op.');
    }

    if (compareVersions(nextVersion, currentVersion) <= 0) {
      throw new Error(`Kies een versie hoger dan ${currentVersion}. Anders blijft de update hetzelfde.`);
    }

    const nextDownloadUrl = String(downloadUrl || '').trim();
    const maxSupabaseUploadBytes = 50 * 1024 * 1024;

    if (!file && !nextDownloadUrl) {
      throw new Error('Kies een .exe-bestand of vul een download-URL in.');
    }

    if (file && !nextDownloadUrl && file.size > maxSupabaseUploadBytes) {
      const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
      throw new Error(
        `Dit updatebestand is ${sizeInMb} MB. Supabase Free laat max 50 MB toe. Gebruik een kleinere build, een externe download-URL of een hogere Supabase storage-limiet.`
      );
    }

    let downloadUrlToStore = nextDownloadUrl;

    if (!downloadUrlToStore) {
      const uploadPath = `releases/${sanitizeSegment(nextVersion)}/YOWLMAFFIA.exe`;
      const uploadFilePath = typeof file?.path === 'string' && file.path.trim() ? file.path.trim() : '';
      const uploaded = await uploadFileToStorage(file, 'app-updates', 'releases', {
        fixedPath: uploadPath,
        upsert: true,
        filePath: uploadFilePath
      });
      downloadUrlToStore = uploaded.url;
    }

    const { error } = await supabase.from('app_update_releases').upsert(
      {
        version: nextVersion,
        download_url: downloadUrlToStore,
        notes: nextNotes,
        is_required: Boolean(isRequired),
        published_at: new Date().toISOString()
      },
      {
        onConflict: 'version'
      }
    );

    if (error) {
      throw error;
    }

    return {
      ok: true,
      message: `Update ${nextVersion} is gepubliceerd.`
    };
  }

  async function handlePublishInfo({ title = '', body = '', isActive = true } = {}) {
    if (!currentUser) {
      throw new Error('Je moet ingelogd zijn om info te publiceren.');
    }

    if (normalizeUsername(currentUser.username) !== 'mattiz') {
      throw new Error('Alleen Mattiz mag info publiceren.');
    }

    if (!supabase) {
      throw new Error('Supabase is niet gekoppeld.');
    }

    const nextTitle = String(title || '').trim();
    const nextBody = String(body || '').trim();
    const nextIsActive = Boolean(isActive);

    if (nextIsActive && (!nextTitle || !nextBody)) {
      throw new Error('Vul zowel een titel als een bericht in.');
    }

    const { error } = await supabase.from('app_info_blocks').upsert(
      {
        id: 'current',
        title: nextTitle,
        body: nextBody,
        is_active: nextIsActive,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        onConflict: 'id'
      }
    );

    if (error) {
      if (isMissingInfoBlocksTableError(error)) {
        throw new Error('De info-tabel ontbreekt nog in Supabase. Run supabase/setup.sql opnieuw.');
      }

      throw error;
    }

    return {
      ok: true,
      message: 'Info opgeslagen.'
    };
  }

  async function handleSaveMusicRelease({
    id = null,
    title = '',
    artistName = '',
    spotifyUrl = '',
    coverUrl = '',
    coverStoragePath = ''
  } = {}) {
    if (!currentUser) {
      throw new Error('Je moet ingelogd zijn om een muziekbanner op te slaan.');
    }

    if (normalizeUsername(currentUser.username) !== 'mattiz') {
      throw new Error('Alleen Mattiz mag muziekbanners beheren.');
    }

    if (!supabase) {
      throw new Error('Supabase is niet gekoppeld.');
    }

    const nextTitle = String(title || '').trim();
    const nextArtistName = String(artistName || '').trim();
    const nextSpotifyUrl = String(spotifyUrl || '').trim();
    const nextCoverUrl = String(coverUrl || '').trim();
    const nextCoverStoragePath = String(coverStoragePath || '').trim();

    if (!nextTitle) {
      throw new Error('Geef een titel op.');
    }

    const nextRelease = normalizeMusicRelease({
      id: id || crypto.randomUUID(),
      title: nextTitle,
      artist_name: nextArtistName || 'YOWLMAFFIA',
      spotify_url: nextSpotifyUrl,
      cover_url: nextCoverUrl,
      cover_storage_path: nextCoverStoragePath
    });

    let data = null;
    let error = null;

    const rpcResult = await supabase.rpc('upsert_music_release', {
      p_id: nextRelease.id,
      p_title: nextRelease.title,
      p_artist_name: nextRelease.artistName,
      p_spotify_url: nextRelease.spotifyUrl,
      p_cover_url: nextRelease.coverUrl,
      p_cover_storage_path: nextCoverStoragePath,
      p_sort_order: nextRelease.sortOrder
    });

    data = rpcResult.data;
    error = rpcResult.error;

    if (error && isMissingMusicReleaseRpcError(error, 'upsert_music_release')) {
      const fallbackResult = await supabase
        .from('music_releases')
        .upsert(
          {
            id: nextRelease.id,
            title: nextRelease.title,
            artist_name: nextRelease.artistName,
            spotify_url: nextRelease.spotifyUrl,
            cover_url: nextRelease.coverUrl,
            cover_storage_path: nextCoverStoragePath,
            sort_order: nextRelease.sortOrder,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'id' }
        )
        .select('*')
        .maybeSingle();

      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error) {
      if (isMissingMusicReleasesTableError(error)) {
        throw new Error('De muziekbanners-tabel ontbreekt nog in Supabase. Run supabase/setup.sql opnieuw.');
      }

      throw error;
    }

    return {
      ok: true,
      data: data ? normalizeMusicRelease(data) : nextRelease,
      message: 'Spotify-banner opgeslagen.'
    };
  }

  async function handleDeleteMusicRelease(release = {}) {
    if (!currentUser) {
      throw new Error('Je moet ingelogd zijn om een muziekbanner te verwijderen.');
    }

    if (normalizeUsername(currentUser.username) !== 'mattiz') {
      throw new Error('Alleen Mattiz mag muziekbanners verwijderen.');
    }

    if (!supabase) {
      throw new Error('Supabase is niet gekoppeld.');
    }

    const releaseId = String(release.id || '').trim();
    if (!releaseId) {
      throw new Error('Muziekbanner niet gevonden.');
    }

    if (release.coverStoragePath) {
      const { error: removeCoverError } = await supabase.storage.from('covers').remove([release.coverStoragePath]);
      if (removeCoverError) {
        console.error(removeCoverError);
      }
    }

    let error = null;

    const rpcResult = await supabase.rpc('delete_music_release', { p_id: releaseId });
    error = rpcResult.error;

    if (error && isMissingMusicReleaseRpcError(error, 'delete_music_release')) {
      const fallbackResult = await supabase.from('music_releases').delete().eq('id', releaseId);
      error = fallbackResult.error;
    }

    if (error) {
      throw error;
    }

    return {
      ok: true,
      message: 'Spotify-banner verwijderd.'
    };
  }

  async function handleSendAnnouncement({ recipientUsername = 'team', title = '', body = '', link = '' } = {}) {
    if (!currentUser) {
      throw new Error('Je moet ingelogd zijn om meldingen te sturen.');
    }

    if (normalizeUsername(currentUser.username) !== 'mattiz') {
      throw new Error('Alleen Mattiz kan pushberichten sturen.');
    }

    if (!supabase) {
      throw new Error('Supabase is niet gekoppeld.');
    }

    const nextTitle = String(title || '').trim();
    const nextBody = String(body || '').trim();
    const nextLink = String(link || '').trim();

    if (!nextTitle || !nextBody) {
      throw new Error('Vul zowel een titel als een bericht in.');
    }

    const recipientKey = normalizeUsername(recipientUsername || 'team');
    const audience =
      recipientKey === 'team'
        ? allowedUsers.filter((user) => normalizeUsername(user.username) !== normalizeUsername(currentUser.username))
        : [findAllowedUser(recipientUsername, allowedUsers)].filter(Boolean);

    if (!audience.length) {
      throw new Error('Geen ontvangers gevonden voor deze melding.');
    }

    const rows = audience.map((recipient) => ({
      recipient_username: recipient.username,
      recipient_email: recipient.email,
      actor_username: currentUser.username,
      kind: recipientKey === 'team' ? 'announcement' : 'direct',
      title: nextTitle,
      body: nextBody,
      link: nextLink || null,
      metadata: {
        audience: recipientKey === 'team' ? 'team' : 'direct',
        sender: currentUser.username
      }
    }));

    const { error } = await supabase.from('notifications').insert(rows);

    if (error) {
      throw error;
    }

    await loadNotifications();

    return {
      ok: true,
      message: `Melding verstuurd naar ${rows.length} ${rows.length === 1 ? 'persoon' : 'personen'}.`
    };
  }

  async function uploadFileToStorage(file, bucket, folder, options = {}) {
    const { fixedPath = null, upsert = false, filePath = '' } = options;
    const safeName = sanitizeSegment(file.name);
    const path = fixedPath || `${folder}/${crypto.randomUUID()}-${safeName}`;

    if (!supabase) {
      if (!allowOfflineDemo) {
        throw new Error('Supabase is niet gekoppeld.');
      }

      return {
        url: URL.createObjectURL(file),
        path
      };
    }

    if (hasDesktopStorageBridge() && session?.access_token && supabaseUrl && supabaseAnonKey) {
      const result = await window.desktop.uploadStorageFile({
        supabaseUrl,
        supabaseAnonKey,
        accessToken: session.access_token,
        bucket,
        path,
        contentType: file.type,
        upsert,
        filePath: filePath || (typeof file?.path === 'string' ? file.path : ''),
        bytes: filePath ? undefined : await file.arrayBuffer()
      });

      if (!result?.path || !result?.url) {
        throw new Error('Upload mislukt.');
      }

      return {
        url: result.url,
        path: result.path
      };
    }

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      upsert
    });

    if (error) {
      throw error;
    }

    return {
      url: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl,
      path
    };
  }

  async function handleUploadAsset(file, mode = 'media', song) {
    const bucket = mode === 'cover' ? 'covers' : 'media';
    const folder = mode === 'cover' ? 'covers' : song ? `songs/${sanitizeSegment(song.title || song.id)}` : 'media';
    return uploadFileToStorage(file, bucket, folder);
  }

  async function handleUploadTrack(fileOrFiles, song) {
    if (normalizeUsername(activeUser?.username) !== 'mattiz') {
      throw new Error('Alleen Mattiz kan tracks uploaden.');
    }

    const files = Array.isArray(fileOrFiles)
      ? fileOrFiles.filter(Boolean)
      : fileOrFiles?.length && typeof fileOrFiles !== 'string'
        ? Array.from(fileOrFiles).filter(Boolean)
        : fileOrFiles
          ? [fileOrFiles]
          : [];

    if (!files.length) {
      return { track: null, tracks: [] };
    }

    const uploadedTracks = [];

    const nextFolder = song ? `songs/${sanitizeSegment(song.title || song.id)}` : 'tracks';
    const uploadErrors = [];

    for (const file of files) {
      try {
        const uploaded = await uploadFileToStorage(file, 'audio', nextFolder);
        uploadedTracks.push({
          id: uploaded.path,
          name: file.name,
          fullPath: uploaded.path,
          metadata: {
            mimetype: file.type,
            size: file.size
          },
          publicUrl: uploaded.url
        });
      } catch (error) {
        uploadErrors.push(`${file.name}: ${error instanceof Error ? error.message : 'Upload mislukt.'}`);
      }
    }

    if (!uploadedTracks.length && uploadErrors.length) {
      throw new Error(uploadErrors.join(' | '));
    }

    if (uploadErrors.length) {
      return {
        track: uploadedTracks[0] || null,
        tracks: uploadedTracks,
        warnings: uploadErrors
      };
    }

    return { track: uploadedTracks[0] || null, tracks: uploadedTracks };
  }

  return (
    <Suspense
      fallback={
        <div className="empty-state">
          <strong>Even laden...</strong>
          <p>We openen de app.</p>
        </div>
      }
    >
      <Routes>
        <Route
          path="/login"
          element={
            <LoginRoute
              currentUser={activeUser}
              onLogin={handleLogin}
              onVerifyCode={handleVerifyLoginCode}
              onResendCode={handleResendLoginCode}
              onForgotPassword={handleForgotPassword}
              onRecoverPassword={handleRecoverPassword}
              onBack={handleBackToCredentials}
              stage={loginStage}
              codeTarget={loginEmail}
              identityLabel={loginIdentity}
              hint={loginHint}
              loading={authLoading || loginBusy}
              error={authError}
              forgotPasswordEnabled={loginFailedAttempts >= 3}
              showSetupNotice={!isSupabaseConfigured}
            />
          }
        />
        <Route
          element={
            <ProtectedLayout
              currentUser={activeUser}
              onSignOut={handleSignOut}
              notificationCount={unreadNotificationCount}
              onProfileSave={handleSaveProfile}
              onAvatarUpload={handleUploadProfileAvatar}
              onAvatarDelete={handleDeleteProfileAvatar}
              onEmailChange={handleChangeEmail}
              onPublishInfo={handlePublishInfo}
              onPublishUpdate={handlePublishUpdate}
            />
          }
        >
          <Route
            path="/dashboard"
            element={
              <DashboardPage
                currentUser={activeUser}
                songs={songs}
                loading={songsLoading}
                allowedUsers={allowedUsers}
                musicReleases={musicReleases}
                musicReleasesLoading={musicReleasesLoading}
                notifications={notifications}
                notificationsLoading={notificationsLoading}
                activity={activity}
                activityLoading={activityLoading}
                pageMode="dashboard"
                onNewSong={handleNewSong}
                onOpenSong={(song) => navigate(`/editor/${song.id}`)}
                onRefreshSongs={loadSongs}
                onOpenNotification={handleOpenNotification}
                onClearNotifications={handleClearAllNotifications}
                onSendAnnouncement={handleSendAnnouncement}
                onUploadAsset={handleUploadAsset}
                onRefreshMusicReleases={loadMusicReleases}
                onSaveMusicRelease={handleSaveMusicRelease}
                onDeleteMusicRelease={handleDeleteMusicRelease}
              />
            }
          />
          <Route
            path="/songs"
            element={
              <DashboardPage
                currentUser={activeUser}
                songs={songs}
                loading={songsLoading}
                allowedUsers={allowedUsers}
                musicReleases={musicReleases}
                musicReleasesLoading={musicReleasesLoading}
                notifications={notifications}
                notificationsLoading={notificationsLoading}
                activity={activity}
                activityLoading={activityLoading}
                pageMode="songs"
                onNewSong={handleNewSong}
                onOpenSong={(song) => navigate(`/editor/${song.id}`)}
                onRefreshSongs={loadSongs}
                onOpenNotification={handleOpenNotification}
                onClearNotifications={handleClearAllNotifications}
                onSendAnnouncement={handleSendAnnouncement}
                onUploadAsset={handleUploadAsset}
                onRefreshMusicReleases={loadMusicReleases}
                onSaveMusicRelease={handleSaveMusicRelease}
                onDeleteMusicRelease={handleDeleteMusicRelease}
              />
            }
          />
          <Route
            path="/editor/:songId"
            element={
              <EditorRoute
                songs={songs}
                songsLoading={songsLoading}
                navigate={navigate}
                currentUser={activeUser}
                allowedUsers={allowedUsers}
                savingState={songsLoading ? 'Songs laden...' : 'Klaar'}
                activeEditors={[]}
                onSaveSong={handleSaveSong}
                onDeleteSong={handleDeleteSong}
                onReloadSongs={loadSongs}
                onUploadAsset={handleUploadAsset}
                onUploadTrack={handleUploadTrack}
              />
            }
          />
          <Route path="/player" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/chat"
            element={
              <ChatPage
                currentUser={activeUser}
                loading={authLoading}
                allowedUsers={allowedUsers}
                onlineUsernames={onlineUsernames}
                presenceLastSeenByUsername={presenceLastSeenByUsername}
              />
            }
          />
          <Route path="*" element={<Navigate to={activeUser ? '/dashboard' : '/login'} replace />} />
        </Route>
        <Route path="/" element={<Navigate to={activeUser ? '/dashboard' : '/login'} replace />} />
      </Routes>
      <CreateSongDialog
        open={createSongOpen}
        loading={createSongBusy}
        errorMessage={createSongError}
        onClose={() => setCreateSongOpen(false)}
        onCreate={handleCreateSong}
      />
    </Suspense>
  );
}
