import { Check, RefreshCw, Save, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import MusicReleaseCard from '../components/MusicReleaseCard';
import PublicShell from '../components/PublicShell';
import { publicChatSupabase, isPublicChatSupabaseConfigured } from '../utils/supabase';
import {
  DEFAULT_PUBLIC_USERS,
  loadPublicAllowedUsers,
  normalizePublicUsername,
  resolvePublicUserFromSession
} from '../utils/publicUsers';
import { loadMusicReleases as loadMusicReleasesFromDatabase, normalizeMusicRelease } from '../utils/musicReleases';

function blankInfo(title, body) {
  return {
    title,
    body
  };
}

export default function PublicManagePage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [allowedUsers, setAllowedUsers] = useState(DEFAULT_PUBLIC_USERS);
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingPage, setLoadingPage] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [buildNumber, setBuildNumber] = useState('');
  const [buildState, setBuildState] = useState(null);
  const [buildBusy, setBuildBusy] = useState(false);
  const [buildMessage, setBuildMessage] = useState('');
  const [infoCurrent, setInfoCurrent] = useState(blankInfo('YOWLMAFFIA', 'Welkom op de publieke dashboardpagina.'));
  const [infoRules, setInfoRules] = useState(blankInfo('Regels', 'Wees vriendelijk, respectvol en hou het proper.'));
  const [updateVersion, setUpdateVersion] = useState('');
  const [updateNotes, setUpdateNotes] = useState('');
  const [updateDownloadUrl, setUpdateDownloadUrl] = useState('');
  const [updateRequired, setUpdateRequired] = useState(false);
  const [latestUpdate, setLatestUpdate] = useState(null);
  const [musicTitle, setMusicTitle] = useState('');
  const [musicArtistName, setMusicArtistName] = useState('YOWLMAFFIA');
  const [musicSpotifyUrl, setMusicSpotifyUrl] = useState('');
  const [musicCoverUrl, setMusicCoverUrl] = useState('');
  const [musicReleases, setMusicReleases] = useState([]);

  const isMattiz = normalizePublicUsername(currentUser?.username) === 'mattiz';

  function normalizeBuildState(row = null) {
    return {
      buildNumber: String(row?.build_number || '').trim(),
      publishedAt: String(row?.published_at || row?.created_at || '').trim(),
      updatedAt: String(row?.updated_at || row?.published_at || row?.created_at || '').trim()
    };
  }

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
    if (!currentUser || !isMattiz || !isPublicChatSupabaseConfigured || !publicChatSupabase) {
      setLoadingPage(false);
      return undefined;
    }

    let cancelled = false;

    async function bootstrapManage() {
      setLoadingPage(true);

      const [buildResult, infoResult, rulesResult, musicResult, updateResult] = await Promise.all([
        publicChatSupabase.from('app_build_state').select('build_number, published_at, created_at, updated_at').eq('id', 'current').maybeSingle(),
        publicChatSupabase.from('app_info_blocks').select('*').eq('id', 'current').maybeSingle(),
        publicChatSupabase.from('app_info_blocks').select('*').eq('id', 'rules').maybeSingle(),
        loadMusicReleasesFromDatabase(publicChatSupabase).catch(() => []),
        publicChatSupabase
          .from('app_update_releases')
          .select('version, download_url, notes, is_required, published_at, created_at')
          .order('published_at', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
      ]);

      if (cancelled) {
        return;
      }

      if (buildResult?.data) {
        const nextBuildState = normalizeBuildState(buildResult.data);
        setBuildState(nextBuildState);
        setBuildNumber(nextBuildState.buildNumber);
      }

      if (infoResult?.data) {
        setInfoCurrent(
          blankInfo(
            String(infoResult.data.title || 'YOWLMAFFIA').trim() || 'YOWLMAFFIA',
            String(infoResult.data.body || '').trim() || 'Welkom op de publieke dashboardpagina.'
          )
        );
      }

      if (rulesResult?.data) {
        setInfoRules(
          blankInfo(
            String(rulesResult.data.title || 'Regels').trim() || 'Regels',
            String(rulesResult.data.body || '').trim() || 'Wees vriendelijk, respectvol en hou het proper.'
          )
        );
      }

      setMusicReleases(Array.isArray(musicResult) ? musicResult.map(normalizeMusicRelease) : []);
      setLatestUpdate(Array.isArray(updateResult?.data) ? updateResult.data[0] || null : null);
      setLoadingPage(false);
    }

    bootstrapManage();

    const infoChannel = publicChatSupabase
      .channel('public-manage-info-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_info_blocks' }, bootstrapManage)
      .subscribe();

    const buildChannel = publicChatSupabase
      .channel('public-manage-build-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_build_state' }, bootstrapManage)
      .subscribe();

    const updateChannel = publicChatSupabase
      .channel('public-manage-updates-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_update_releases' }, bootstrapManage)
      .subscribe();

    const musicChannel = publicChatSupabase
      .channel('public-manage-music-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'music_releases' }, bootstrapManage)
      .subscribe();

    return () => {
      cancelled = true;
      publicChatSupabase.removeChannel(infoChannel);
      publicChatSupabase.removeChannel(buildChannel);
      publicChatSupabase.removeChannel(updateChannel);
      publicChatSupabase.removeChannel(musicChannel);
    };
  }, [currentUser, isMattiz]);

  const statusText = useMemo(() => (latestUpdate ? 'Nieuwe update beschikbaar' : 'Alles bijgewerkt'), [latestUpdate]);

  async function handleSignOut() {
    if (!publicChatSupabase) {
      navigate('/');
      return;
    }

    await publicChatSupabase.auth.signOut();
    navigate('/');
  }

  async function handleSaveInfo(event) {
    event.preventDefault();

    if (!publicChatSupabase || !isMattiz) {
      return;
    }

    setSaving(true);
    setMessage('');
    setError('');

    try {
      const nextUpdatedAt = new Date().toISOString();

      const payloads = [
        {
          id: 'current',
          title: infoCurrent.title.trim() || 'YOWLMAFFIA',
          body: infoCurrent.body.trim() || 'Welkom op de publieke dashboardpagina.',
          updated_at: nextUpdatedAt
        },
        {
          id: 'rules',
          title: infoRules.title.trim() || 'Regels',
          body: infoRules.body.trim() || 'Wees vriendelijk, respectvol en hou het proper.',
          updated_at: nextUpdatedAt
        }
      ];

      const results = await Promise.all(
        payloads.map((payload) => publicChatSupabase.from('app_info_blocks').upsert(payload, { onConflict: 'id' }))
      );

      const firstError = results.find((result) => result.error)?.error || null;
      if (firstError) {
        throw firstError;
      }

      setMessage('Publieke info opgeslagen.');
    } catch (saveError) {
      setError(saveError?.message || 'Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveBuild(event) {
    event.preventDefault();

    if (!publicChatSupabase || !isMattiz) {
      return;
    }

    setBuildBusy(true);
    setBuildMessage('');
    setError('');

    try {
      const nextBuildNumber = String(buildNumber || '').trim();
      if (!nextBuildNumber) {
        throw new Error('Vul een buildnummer in.');
      }

      const now = new Date().toISOString();
      const { error: saveError } = await publicChatSupabase.from('app_build_state').upsert(
        {
          id: 'current',
          build_number: nextBuildNumber,
          published_at: now,
          updated_at: now
        },
        { onConflict: 'id' }
      );

      if (saveError) {
        throw saveError;
      }

      setBuildState({
        buildNumber: nextBuildNumber,
        publishedAt: now,
        updatedAt: now
      });
      setBuildMessage('Buildnummer opgeslagen.');
    } catch (buildError) {
      setBuildMessage('');
      setError(buildError?.message || 'Buildnummer opslaan mislukt.');
    } finally {
      setBuildBusy(false);
    }
  }

  async function handlePublishUpdate(event) {
    event.preventDefault();

    if (!publicChatSupabase || !isMattiz) {
      return;
    }

    setSaving(true);
    setMessage('');
    setError('');

    try {
      if (!updateVersion.trim()) {
        throw new Error('Vul een versienummer in.');
      }

      const now = new Date().toISOString();
      const { error: insertError } = await publicChatSupabase.from('app_update_releases').insert({
        version: updateVersion.trim(),
        notes: updateNotes.trim(),
        download_url: updateDownloadUrl.trim(),
        is_required: Boolean(updateRequired),
        published_at: now,
        created_at: now
      });

      if (insertError) {
        throw insertError;
      }

      setUpdateVersion('');
      setUpdateNotes('');
      setUpdateDownloadUrl('');
      setUpdateRequired(false);
      setMessage('Nieuwe update gepubliceerd.');
    } catch (publishError) {
      setError(publishError?.message || 'Update publiceren mislukt.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMusicRelease(event) {
    event.preventDefault();

    if (!publicChatSupabase || !isMattiz) {
      return;
    }

    setSaving(true);
    setMessage('');
    setError('');

    try {
      if (!musicTitle.trim()) {
        throw new Error('Geef een titel op.');
      }

      const { error: insertError } = await publicChatSupabase.from('music_releases').insert({
        title: musicTitle.trim(),
        artist_name: musicArtistName.trim() || 'YOWLMAFFIA',
        spotify_url: musicSpotifyUrl.trim(),
        cover_url: musicCoverUrl.trim()
      });

      if (insertError) {
        throw insertError;
      }

      setMusicTitle('');
      setMusicArtistName('YOWLMAFFIA');
      setMusicSpotifyUrl('');
      setMusicCoverUrl('');
      setMessage('Spotify-banner toegevoegd.');
    } catch (musicError) {
      setError(musicError?.message || 'Banner toevoegen mislukt.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMusicRelease(release) {
    if (!publicChatSupabase || !isMattiz || !release?.id) {
      return;
    }

    setSaving(true);
    setMessage('');
    setError('');

    try {
      const { error: deleteError } = await publicChatSupabase.from('music_releases').delete().eq('id', release.id);
      if (deleteError) {
        throw deleteError;
      }

      setMusicReleases((previous) => previous.filter((item) => item.id !== release.id));
      setMessage(`Banner "${release.title}" verwijderd.`);
    } catch (deleteError) {
      setError(deleteError?.message || 'Verwijderen mislukt.');
    } finally {
      setSaving(false);
    }
  }

  if (loadingAuth) {
    return (
      <section className="public-page">
        <div className="public-page__shell">
          <div className="empty-state empty-state--compact">
            <strong>Beheer laden...</strong>
            <p>We openen de publieke beheeromgeving veilig.</p>
          </div>
        </div>
      </section>
    );
  }

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  if (!isMattiz) {
    return <Navigate to="/public/dashboard" replace />;
  }

  return (
    <PublicShell user={currentUser} onSignOut={handleSignOut} statusText={statusText}>
      <section className="public-manage">
        <header className="public-dashboard__hero panel">
          <div className="public-dashboard__hero-brand">
            <div>
              <span className="eyebrow">Beheren</span>
              <h1>Publieke content beheren</h1>
              <p>
                Hier beheer je alleen de publieke kant: info, regels, updates en Spotify-banners. Alles blijft online in de public Supabase-database.
              </p>
            </div>
          </div>

          <div className="public-dashboard__hero-actions">
            <button className="button button--secondary" type="button" onClick={() => setMessage('Alles blijft publiek en gescheiden van de interne app.')}>
              <Sparkles size={16} />
              Alleen publiek
            </button>
          </div>
        </header>

        <div className="public-manage__grid">
          <form className="panel public-manage__card" onSubmit={handleSaveBuild}>
            <div className="panel__header panel__header--compact">
              <span className="eyebrow">Build</span>
              <h2>Buildnummer beheren</h2>
            </div>

            <label className="field">
              <span>Buildnummer</span>
              <input
                className="input"
                value={buildNumber}
                onChange={(event) => setBuildNumber(event.target.value)}
                placeholder="Bijvoorbeeld 2.2.0"
              />
              <small className="settings-menu__hint">
                Huidig online buildnummer: {buildState?.buildNumber || 'nog niet ingesteld'}
              </small>
            </label>

            <button className="button button--primary" type="submit" disabled={buildBusy}>
              <Save size={16} />
              {buildBusy ? 'Opslaan...' : 'Buildnummer opslaan'}
            </button>

            {buildMessage ? <p className="settings-menu__message">{buildMessage}</p> : null}
          </form>

          <form className="panel public-manage__card" onSubmit={handleSaveInfo}>
            <div className="panel__header panel__header--compact">
              <span className="eyebrow">Info</span>
              <h2>Login en dashboard tekst</h2>
            </div>

            <div className="public-settings__split">
              <label className="field">
                <span>Hoofdtitel</span>
                <input
                  className="input"
                  value={infoCurrent.title}
                  onChange={(event) => setInfoCurrent((previous) => ({ ...previous, title: event.target.value }))}
                  placeholder="YOWLMAFFIA"
                />
              </label>

              <label className="field">
                <span>Regel-titel</span>
                <input
                  className="input"
                  value={infoRules.title}
                  onChange={(event) => setInfoRules((previous) => ({ ...previous, title: event.target.value }))}
                  placeholder="Regels"
                />
              </label>
            </div>

            <label className="field">
              <span>Info tekst</span>
              <textarea
                className="lyrics-editor__textarea"
                value={infoCurrent.body}
                onChange={(event) => setInfoCurrent((previous) => ({ ...previous, body: event.target.value }))}
                placeholder="Welkom op de publieke dashboardpagina."
              />
            </label>

            <label className="field">
              <span>Regels tekst</span>
              <textarea
                className="lyrics-editor__textarea"
                value={infoRules.body}
                onChange={(event) => setInfoRules((previous) => ({ ...previous, body: event.target.value }))}
                placeholder="Wees vriendelijk, respectvol en hou het proper."
              />
            </label>

            <button className="button button--primary" type="submit" disabled={saving}>
              <Save size={16} />
              Info opslaan
            </button>
          </form>

          <form className="panel public-manage__card" onSubmit={handlePublishUpdate}>
            <div className="panel__header panel__header--compact">
              <span className="eyebrow">Updates</span>
              <h2>Nieuwe release publiceren</h2>
            </div>

            <label className="field">
              <span>Versie</span>
              <input
                className="input"
                value={updateVersion}
                onChange={(event) => setUpdateVersion(event.target.value)}
                placeholder="2.2.0"
              />
            </label>

            <label className="field">
              <span>Opmerking</span>
              <textarea
                className="lyrics-editor__textarea"
                value={updateNotes}
                onChange={(event) => setUpdateNotes(event.target.value)}
                placeholder="Nieuwe publieke update..."
              />
            </label>

            <label className="field">
              <span>Downloadlink</span>
              <input
                className="input"
                value={updateDownloadUrl}
                onChange={(event) => setUpdateDownloadUrl(event.target.value)}
                placeholder="https://github.com/.../releases/download/..."
              />
            </label>

            <label className="button button--secondary settings-menu__toggle">
              <input
                type="checkbox"
                checked={updateRequired}
                onChange={(event) => setUpdateRequired(event.target.checked)}
              />
              Verplichte update
            </label>

            <button className="button button--primary" type="submit" disabled={saving}>
              <RefreshCw size={16} />
              Update publiceren
            </button>
          </form>

          <form className="panel public-manage__card" onSubmit={handleSaveMusicRelease}>
            <div className="panel__header panel__header--compact">
              <span className="eyebrow">Songs</span>
              <h2>Spotify-banner toevoegen</h2>
            </div>

            <label className="field">
              <span>Titel</span>
              <input
                className="input"
                value={musicTitle}
                onChange={(event) => setMusicTitle(event.target.value)}
                placeholder="VIERA D"
              />
            </label>

            <label className="field">
              <span>Artiest</span>
              <input
                className="input"
                value={musicArtistName}
                onChange={(event) => setMusicArtistName(event.target.value)}
                placeholder="YOWLMAFFIA"
              />
            </label>

            <label className="field">
              <span>Spotify-link</span>
              <input
                className="input"
                value={musicSpotifyUrl}
                onChange={(event) => setMusicSpotifyUrl(event.target.value)}
                placeholder="https://open.spotify.com/track/..."
              />
            </label>

            <label className="field">
              <span>Cover-url</span>
              <input
                className="input"
                value={musicCoverUrl}
                onChange={(event) => setMusicCoverUrl(event.target.value)}
                placeholder="https://..."
              />
            </label>

            <button className="button button--primary" type="submit" disabled={saving}>
              <Sparkles size={16} />
              Banner toevoegen
            </button>
          </form>
        </div>

        <section className="panel public-dashboard__releases">
          <div className="panel__header panel__header--compact">
            <span className="eyebrow">Songs</span>
            <h2>Bestaande banners</h2>
            <button className="button button--ghost button--compact" type="button" onClick={() => setMessage('Banners staan online en worden live gesynchroniseerd.')}>
              <Check size={16} />
              Live
            </button>
          </div>

          {!isPublicChatSupabaseConfigured ? (
            <div className="empty-state empty-state--compact">
              <strong>Public Supabase is nog niet gekoppeld.</strong>
              <p>Koppel eerst de public database om banners te beheren.</p>
            </div>
          ) : loadingPage ? (
            <div className="empty-state empty-state--compact">
              <strong>Publieke content laden...</strong>
              <p>We halen info, releases en banners uit Supabase.</p>
            </div>
          ) : musicReleases.length ? (
            <div className="music-release-grid music-release-grid--compact">
              {musicReleases.map((release) => (
                <MusicReleaseCard key={release.id} release={release} canManage onDelete={handleDeleteMusicRelease} />
              ))}
            </div>
          ) : (
            <div className="empty-state empty-state--compact">
              <strong>Nog geen banners</strong>
              <p>Maak hierboven de eerste publieke Spotify-banner aan.</p>
            </div>
          )}
        </section>

        <section className="public-manage__preview">
          <article className="panel public-block">
            <span className="eyebrow">Voorvertoning</span>
            <h2>{infoCurrent.title || 'YOWLMAFFIA'}</h2>
            <p>{infoCurrent.body || 'Welkom op de publieke dashboardpagina.'}</p>
          </article>

          <article className="panel public-block">
            <span className="eyebrow">Voorvertoning</span>
            <h2>{infoRules.title || 'Regels'}</h2>
            <p>{infoRules.body || 'Wees vriendelijk, respectvol en hou het proper.'}</p>
          </article>

          <article className="panel public-block">
            <span className="eyebrow">Updates</span>
            <h2>{latestUpdate ? `Versie ${latestUpdate.version}` : 'Nog geen release'}</h2>
            <p>{latestUpdate?.notes || 'Mattiz kan later hier nieuwe app-updates publiceren.'}</p>
          </article>
        </section>

        {message ? <p className="settings-menu__message public-manage__message">{message}</p> : null}
        {error ? <p className="settings-menu__message public-manage__message public-manage__message--error">{error}</p> : null}
      </section>
    </PublicShell>
  );
}
