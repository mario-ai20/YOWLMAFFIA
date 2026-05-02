import { Camera, Check, Mail, Trash2, UserCircle2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import PublicShell from '../components/PublicShell';
import UserAvatar from '../components/UserAvatar';
import { publicChatSupabase, isPublicChatSupabaseConfigured } from '../utils/supabase';
import {
  DEFAULT_PUBLIC_USERS,
  findPublicAllowedUser,
  loadPublicAllowedUsers,
  normalizePublicUsername,
  resolvePublicUserFromSession
} from '../utils/publicUsers';

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

export default function PublicSettingsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [allowedUsers, setAllowedUsers] = useState(DEFAULT_PUBLIC_USERS);
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [bio, setBio] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [gender, setGender] = useState('zeg ik liever niet');
  const [themeMode, setThemeMode] = useState('system');
  const [email, setEmail] = useState('');
  const [emailMfaEnabled, setEmailMfaEnabled] = useState(true);

  useEffect(() => {
    if (!publicChatSupabase) {
      setLoadingAuth(false);
      return undefined;
    }

    let cancelled = false;

    async function bootstrapAuth() {
      const [{ data: sessionData }, users] = await Promise.all([
        publicChatSupabase.auth.getSession(),
        loadPublicAllowedUsers().catch(() => DEFAULT_PUBLIC_USERS)
      ]);

      if (cancelled) {
        return;
      }

      setSession(sessionData.session || null);
      setAllowedUsers(Array.isArray(users) && users.length ? users : DEFAULT_PUBLIC_USERS);
      setLoadingAuth(false);
    }

    bootstrapAuth();

    const {
      data: { subscription }
    } = publicChatSupabase.auth.onAuthStateChange((_, nextSession) => {
      if (!cancelled) {
        setSession(nextSession || null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setCurrentUser(resolvePublicUserFromSession(session, allowedUsers));
  }, [session, allowedUsers]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    setBio(currentUser.bio || '');
    setStatusMessage(currentUser.status_message || '');
    setGender(currentUser.gender || 'zeg ik liever niet');
    setThemeMode(currentUser.theme_mode || 'system');
    setEmail(currentUser.email || '');
    setEmailMfaEnabled(currentUser.email_mfa_enabled !== false);
    setAvatarPreview(currentUser.avatar_url || '');
  }, [currentUser?.username, currentUser?.updated_at, currentUser?.email_mfa_enabled]);

  useEffect(() => {
    if (!avatarFile) {
      return undefined;
    }

    const nextPreview = URL.createObjectURL(avatarFile);
    setAvatarPreview(nextPreview);

    return () => {
      URL.revokeObjectURL(nextPreview);
    };
  }, [avatarFile]);

  const currentUserRecord = useMemo(
    () => findPublicAllowedUser(currentUser?.username, allowedUsers) || currentUser,
    [allowedUsers, currentUser]
  );

  async function handleSignOut() {
    if (!publicChatSupabase) {
      navigate('/');
      return;
    }

    await publicChatSupabase.auth.signOut();
    navigate('/');
  }

  async function handleDeleteAvatar() {
    if (!publicChatSupabase || !currentUser) {
      return;
    }

    const avatarFolder = getAvatarFolder(currentUser.username);
    const { data: existingItems = [], error: listError } = await publicChatSupabase.storage.from('media').list(avatarFolder, {
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' }
    });

    if (listError) {
      throw listError;
    }

    const removePaths = (existingItems || [])
      .filter((item) => item?.name)
      .map((item) => `${avatarFolder}/${item.name}`);

    const { error: removeError } = await publicChatSupabase.storage.from('media').remove(removePaths);
    if (removeError) {
      throw removeError;
    }

    const nextUpdatedAt = new Date().toISOString();
    const { error } = await publicChatSupabase
      .from('allowed_users')
      .update({ avatar_url: '', updated_at: nextUpdatedAt })
      .eq('username', currentUser.username);

    if (error) {
      throw error;
    }

    setAvatarFile(null);
    setAvatarPreview('');
    setCurrentUser((previous) => (previous ? { ...previous, avatar_url: '', updated_at: nextUpdatedAt } : previous));
    setMessage('Profielfoto verwijderd.');
  }

  async function handleSave(event) {
    event.preventDefault();

    if (!publicChatSupabase || !currentUser) {
      return;
    }

    setSaving(true);
    setMessage('');
    setError('');

    try {
      let avatarUrl = currentUser.avatar_url || '';
      const nextUpdatedAt = new Date().toISOString();

      if (avatarFile) {
        const avatarFolder = getAvatarFolder(currentUser.username);
        const { data: existingItems = [], error: listError } = await publicChatSupabase.storage.from('media').list(avatarFolder, {
          limit: 1000,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' }
        });

        if (listError) {
          throw listError;
        }

        const removePaths = (existingItems || [])
          .filter((item) => item?.name)
          .map((item) => `${avatarFolder}/${item.name}`);

        if (removePaths.length) {
          const { error: removeError } = await publicChatSupabase.storage.from('media').remove(removePaths);
          if (removeError) {
            throw removeError;
          }
        }

        const nextExtension = avatarFile.name.includes('.') ? avatarFile.name.split('.').pop() : 'png';
        const uploadPath = `${avatarFolder}/avatar.${nextExtension}`;
        const { error: uploadError } = await publicChatSupabase.storage.from('media').upload(uploadPath, avatarFile, {
          upsert: true,
          contentType: avatarFile.type
        });

        if (uploadError) {
          throw uploadError;
        }

        avatarUrl = publicChatSupabase.storage.from('media').getPublicUrl(uploadPath).data.publicUrl;
      }

      if (email && email !== currentUser.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Vul een geldig e-mailadres in.');
      }

      if (email && email !== currentUser.email) {
        const { error: authError } = await publicChatSupabase.auth.updateUser({ email });
        if (authError) {
          throw authError;
        }
      }

      const payload = {
        username: currentUser.username,
        display_name: currentUser.displayName || currentUser.username,
        email: email || currentUser.email,
        bio,
        status_message: statusMessage,
        gender,
        theme_mode: themeMode,
        avatar_url: avatarUrl,
        updated_at: nextUpdatedAt,
        email_mfa_enabled: emailMfaEnabled
      };

      const { data, error } = await publicChatSupabase
        .from('allowed_users')
        .update(payload)
        .eq('username', currentUser.username)
        .select('username, email, display_name, accent, avatar_url, updated_at, bio, status_message, theme_mode, email_mfa_enabled')
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error('Je profiel kon niet worden opgeslagen. Controleer of je account online bestaat.');
      }

      setAvatarFile(null);
      setCurrentUser((previous) =>
        previous
          ? {
              ...previous,
              ...payload
            }
          : previous
      );

      setMessage(email && email !== currentUser.email ? 'Wijziging opgeslagen. Check je e-mail voor bevestiging.' : 'Instellingen opgeslagen.');
    } catch (formError) {
      setError(formError instanceof Error ? formError.message : 'Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  }

  if (loadingAuth) {
    return (
      <section className="public-page">
        <div className="public-page__shell">
          <div className="empty-state empty-state--compact">
            <strong>Instellingen laden...</strong>
            <p>We openen je openbare profiel veilig.</p>
          </div>
        </div>
      </section>
    );
  }

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <PublicShell user={currentUserRecord} onSignOut={handleSignOut} statusText="Publieke instellingen">
      <section className="public-settings">
        <header className="panel public-settings__hero">
          <div className="public-settings__hero-copy">
            <span className="eyebrow">Instellingen</span>
            <h1>Beheer je publieke profiel</h1>
            <p>Werk je bio, status, profielfoto, gender, thema en e-mailadres bij voor de public chat.</p>
          </div>

          <div className="public-settings__preview">
            <UserAvatar user={currentUserRecord} size={72} showDot />
            <div>
              <strong>{currentUserRecord?.displayName || currentUserRecord?.username}</strong>
              <span>{currentUserRecord?.status_message || currentUserRecord?.bio || 'Beschikbaar'}</span>
            </div>
          </div>
        </header>

        <section className="panel public-settings__card">
          <div className="panel__header panel__header--compact">
            <span className="eyebrow">Profiel</span>
            <h2>Persoonlijke gegevens</h2>
          </div>

          <form className="public-settings__form" onSubmit={handleSave}>
            <div className="public-settings__avatar">
              <img
                className="public-settings__avatar-image"
                src={avatarPreview || currentUserRecord?.avatar_url || ''}
                alt={currentUserRecord?.displayName || currentUserRecord?.username || 'Profielfoto'}
              />
              <div className="public-settings__avatar-actions">
                <label className="button button--secondary button--compact">
                  <Camera size={16} />
                  Wijzig foto
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    onChange={(event) => setAvatarFile(event.target.files?.[0] || null)}
                  />
                </label>
                <button className="button button--ghost button--compact" type="button" onClick={() => void handleDeleteAvatar()}>
                  <Trash2 size={16} />
                  Verwijder foto
                </button>
              </div>
            </div>

            <div className="public-settings__split">
              <label className="field">
                <span>Bio</span>
                <textarea className="input public-settings__textarea" rows={4} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Vertel iets over jezelf" />
              </label>

              <label className="field">
                <span>Status</span>
                <input className="input" value={statusMessage} onChange={(event) => setStatusMessage(event.target.value)} placeholder="Bijvoorbeeld: aan het schrijven" />
              </label>
            </div>

            <div className="public-settings__split">
              <label className="field">
                <span>Geslacht</span>
                <select className="input" value={gender} onChange={(event) => setGender(event.target.value)}>
                  <option value="man">Man</option>
                  <option value="vrouw">Vrouw</option>
                  <option value="zeg ik liever niet">Zeg ik liever niet</option>
                </select>
              </label>

              <label className="field">
                <span>Thema</span>
                <select className="input" value={themeMode} onChange={(event) => setThemeMode(event.target.value)}>
                  <option value="system">Systeem</option>
                  <option value="dark">Zwart</option>
                  <option value="light">Wit</option>
                </select>
              </label>
            </div>

            <label className="field">
              <span>E-mailadres</span>
              <div className="public-settings__email">
                <Mail size={16} />
                <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
            </label>

            <div className={`settings-menu__toggle ${emailMfaEnabled ? 'is-active' : ''}`}>
              <div className="settings-menu__toggle-copy">
                <strong>MFA via mail</strong>
                <span>Vraag na je wachtwoord een code per e-mail.</span>
              </div>
              <input
                type="checkbox"
                checked={emailMfaEnabled}
                onChange={(event) => setEmailMfaEnabled(event.target.checked)}
                aria-label="MFA via mail voor de public chat"
              />
            </div>

            <div className="public-settings__actions">
              <button className="button button--primary" type="submit" disabled={saving}>
                <Check size={16} />
                {saving ? 'Opslaan...' : 'Opslaan en toepassen'}
              </button>
              <button className="button button--secondary" type="button" onClick={() => navigate('/public/chat')}>
                <UserCircle2 size={16} />
                Naar chat
              </button>
            </div>

            {message ? <p className="form-hint">{message}</p> : null}
            {error ? <p className="form-error">{error}</p> : null}
          </form>
        </section>

        <section className="panel public-settings__card">
          <div className="panel__header panel__header--compact">
            <span className="eyebrow">Account</span>
            <h2>Snelle status</h2>
          </div>

          <div className="public-settings__summary">
            <div>
              <strong>Welkom, {currentUserRecord?.displayName || currentUserRecord?.username}</strong>
              <p>{currentUserRecord?.gender || 'zeg ik liever niet'}</p>
            </div>
            <div>
              <span className="eyebrow">Laatste wijziging</span>
              <p>{currentUserRecord?.updated_at ? new Date(currentUserRecord.updated_at).toLocaleString('nl-BE') : 'Onbekend'}</p>
            </div>
          </div>
        </section>

        {!isPublicChatSupabaseConfigured ? (
          <div className="empty-state empty-state--compact">
            <strong>Public Supabase staat nog niet klaar.</strong>
            <p>Koppel eerst de public database zodat de instellingen online kunnen opslaan.</p>
          </div>
        ) : null}
      </section>
    </PublicShell>
  );
}
