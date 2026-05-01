import { Bell, CheckCheck, Clock3, Music2, Plus, RefreshCw, Sparkles, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import SongCard from '../components/SongCard';
import InfoNoticeCard from '../components/InfoNoticeCard';
import UpdateNoticeCard from '../components/UpdateNoticeCard';
import MusicReleaseCard from '../components/MusicReleaseCard';
import UserAvatar from '../components/UserAvatar';
import { createDefaultCoverDataUrl } from '../utils/defaultCover';
import { formatRelativeTime } from '../utils/dates';
import { createSpotifySearchUrl, getDemoMusicReleases } from '../utils/musicReleases';
import { normalizeUsername } from '../utils/users';

function DashboardListItem({ item, onClick, unread = false, icon: Icon, nowTick, showTimestamp = true }) {
  return (
    <button className={`dashboard-feed__item ${unread ? 'is-unread' : ''}`} type="button" onClick={onClick}>
      <div className="dashboard-feed__item-icon">
        {item.avatarUrl || item.actorAvatarUrl ? (
          <UserAvatar name={item.actorName || item.title} src={item.avatarUrl || item.actorAvatarUrl} size={38} />
        ) : (
          <Icon size={16} />
        )}
      </div>
      <div className="dashboard-feed__item-copy">
        <strong>{item.title}</strong>
        <span>{item.body}</span>
        {showTimestamp ? <small>{formatRelativeTime(item.timestamp, nowTick)}</small> : null}
      </div>
      {unread ? <CheckCheck size={16} /> : null}
    </button>
  );
}

export default function DashboardPage({
  currentUser,
  songs = [],
  loading = false,
  allowedUsers = [],
  musicReleases = [],
  musicReleasesLoading = false,
  notifications = [],
  notificationsLoading = false,
  activity = [],
  activityLoading = false,
  pageMode = 'dashboard',
  onNewSong,
  onOpenSong,
  onRefreshSongs,
  onOpenNotification,
  onClearNotifications,
  onSendAnnouncement,
  onUploadAsset,
  onRefreshMusicReleases,
  onSaveMusicRelease,
  onDeleteMusicRelease
}) {
  const coverInputRef = useRef(null);
  const [announcementRecipient, setAnnouncementRecipient] = useState('team');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementLink, setAnnouncementLink] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementBusy, setAnnouncementBusy] = useState(false);
  const [musicTitle, setMusicTitle] = useState('');
  const [musicArtist, setMusicArtist] = useState('');
  const [musicSpotifyUrl, setMusicSpotifyUrl] = useState('');
  const [musicCoverUrl, setMusicCoverUrl] = useState('');
  const [musicCoverStoragePath, setMusicCoverStoragePath] = useState('');
  const [musicBusy, setMusicBusy] = useState(false);
  const [musicMessage, setMusicMessage] = useState('');
  const [nowTick, setNowTick] = useState(() => Date.now());

  const unreadNotifications = notifications.filter((notification) => !notification.is_read);
  const isSongsPage = pageMode === 'songs';
  const canSendAnnouncements = normalizeUsername(currentUser?.username) === 'mattiz' && typeof onSendAnnouncement === 'function';
  const canManageMusic =
    normalizeUsername(currentUser?.username) === 'mattiz' &&
    typeof onSaveMusicRelease === 'function' &&
    typeof onDeleteMusicRelease === 'function';
  const displayedMusicReleases = useMemo(
    () => (musicReleases.length ? musicReleases : getDemoMusicReleases()),
    [musicReleases]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  async function handleSendAnnouncement(event) {
    event.preventDefault();

    if (!canSendAnnouncements || announcementBusy) {
      return;
    }

    setAnnouncementBusy(true);
    setAnnouncementMessage('');

    try {
      const result = await onSendAnnouncement({
        recipientUsername: announcementRecipient,
        title: announcementTitle,
        body: announcementBody,
        link: announcementLink
      });

      setAnnouncementMessage(result?.message || 'Melding verstuurd.');
      setAnnouncementTitle('');
      setAnnouncementBody('');
      setAnnouncementLink('');
      setAnnouncementRecipient('team');
    } catch (error) {
      setAnnouncementMessage(error instanceof Error ? error.message : 'Melding versturen mislukt.');
    } finally {
      setAnnouncementBusy(false);
    }
  }

  async function handleMusicCoverUpload(event) {
    const file = event.target.files?.[0] || null;
    event.target.value = '';

    if (!file || !canManageMusic || typeof onUploadAsset !== 'function') {
      return;
    }

    try {
      setMusicMessage('');
      const uploaded = await onUploadAsset(file, 'cover');
      if (!uploaded?.url) {
        throw new Error('Geen cover-URL ontvangen.');
      }

      setMusicCoverUrl(uploaded.url);
      setMusicCoverStoragePath(uploaded.path || '');
      setMusicMessage('Cover geüpload.');
    } catch (error) {
      setMusicMessage(error instanceof Error ? error.message : 'Cover upload mislukt.');
    }
  }

  async function handleSaveMusicRelease(event) {
    event.preventDefault();

    if (!canManageMusic || musicBusy) {
      return;
    }

    setMusicBusy(true);
    setMusicMessage('');

    try {
      const title = musicTitle.trim();
      const artistName = musicArtist.trim();
      const spotifyUrl = musicSpotifyUrl.trim() || createSpotifySearchUrl(title, artistName);
      const coverUrl = musicCoverUrl.trim();

      if (!title) {
        throw new Error('Geef eerst een titel op.');
      }

      const result = await onSaveMusicRelease({
        title,
        artistName,
        spotifyUrl,
        coverUrl,
        coverStoragePath: musicCoverStoragePath
      });

      setMusicMessage(result?.message || 'Spotify-banner opgeslagen.');
      setMusicTitle('');
      setMusicArtist('');
      setMusicSpotifyUrl('');
      setMusicCoverUrl('');
      setMusicCoverStoragePath('');

      if (typeof onRefreshMusicReleases === 'function') {
        await onRefreshMusicReleases();
      }
    } catch (error) {
      setMusicMessage(error instanceof Error ? error.message : 'Spotify-banner opslaan mislukt.');
    } finally {
      setMusicBusy(false);
    }
  }

  async function handleDeleteMusicRelease(release) {
    if (!canManageMusic || !release) {
      return;
    }

    if (!window.confirm(`Verwijder "${release.title}"?`)) {
      return;
    }

    setMusicBusy(true);
    setMusicMessage('');

    try {
      await onDeleteMusicRelease(release);
      setMusicMessage('Spotify-banner verwijderd.');
      setMusicCoverUrl('');
      setMusicCoverStoragePath('');

      if (typeof onRefreshMusicReleases === 'function') {
        await onRefreshMusicReleases();
      }
    } catch (error) {
      setMusicMessage(error instanceof Error ? error.message : 'Verwijderen mislukt.');
    } finally {
      setMusicBusy(false);
    }
  }

  return (
    <section className={`dashboard-page ${isSongsPage ? 'is-songs' : ''}`.trim()}>
      <div className="dashboard-page__main">
        <div className="page-title">
          <div>
            <span className="eyebrow">{isSongsPage ? 'Songs' : 'Dashboard'}</span>
            <h1>{isSongsPage ? 'Alle songs' : 'Alle songs in de gedeelde database'}</h1>
            <p>
              {isSongsPage
                ? 'Open een song of maak meteen een nieuw nummer aan.'
                : 'Open een song, maak een nieuwe aan of check wat er zonet gebeurde binnen jouw crew.'}
            </p>
          </div>

          <div className="page-title__actions">
            <button className="button button--secondary" type="button" onClick={onRefreshSongs}>
              <RefreshCw size={16} />
              Herladen
            </button>
            <button className="button button--primary" type="button" onClick={onNewSong}>
              <Plus size={16} />
              Nieuwe song
            </button>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <Sparkles size={18} />
            <strong>Songs laden...</strong>
            <p>We halen de bibliotheek op uit Supabase.</p>
          </div>
        ) : songs.length ? (
          <div className="song-grid">
            {songs.map((song) => (
              <SongCard key={song.id} song={song} onOpen={onOpenSong} allowedUsers={allowedUsers} nowTick={nowTick} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Sparkles size={18} />
            <strong>Nog geen songs</strong>
            <p>Maak je eerste song aan met de knop rechtsboven.</p>
          </div>
        )}

        {!isSongsPage ? (
          <section className="panel dashboard-music">
            <div className="panel__header panel__header--compact">
              <span className="eyebrow">Spotify</span>
              <h2>
                <Music2 size={16} />
                Songs
              </h2>

              {typeof onRefreshMusicReleases === 'function' ? (
                <button className="button button--ghost button--small" type="button" onClick={onRefreshMusicReleases}>
                  <RefreshCw size={15} />
                  Herladen
                </button>
              ) : null}
            </div>

            {canManageMusic ? (
              <form className="dashboard-compose dashboard-compose--music dashboard-compose--music-tight" onSubmit={handleSaveMusicRelease}>
                <div className="dashboard-compose__split">
                  <label className="field dashboard-compose__field">
                    <span>Titel</span>
                    <input
                      className="input"
                      value={musicTitle}
                      onChange={(event) => setMusicTitle(event.target.value)}
                      placeholder="Bijvoorbeeld: VIERA D"
                    />
                  </label>

                  <label className="field dashboard-compose__field">
                    <span>Artiest</span>
                    <input
                      className="input"
                      value={musicArtist}
                      onChange={(event) => setMusicArtist(event.target.value)}
                      placeholder="Bijvoorbeeld: YOWLMAFFIA"
                    />
                  </label>
                </div>

                <label className="field dashboard-compose__field">
                  <span>Spotify-link</span>
                  <input
                    className="input"
                    value={musicSpotifyUrl}
                    onChange={(event) => setMusicSpotifyUrl(event.target.value)}
                    placeholder="Plak hier de Spotify-link"
                  />
                </label>

                <div className="dashboard-compose__cover-row">
                  <div className="dashboard-compose__cover-preview">
                    <img
                      src={musicCoverUrl || createDefaultCoverDataUrl(musicTitle || 'Spotify', musicArtist || 'YOWLMAFFIA')}
                      alt={musicTitle || 'Cover preview'}
                    />
                  </div>

                  <div className="dashboard-compose__cover-copy">
                    <p>Kies een cover voor de banner. Deze wordt zichtbaar als Spotify-kaart in de app.</p>

                    <button
                      className="button button--secondary button--small"
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                    >
                      <Upload size={15} />
                      Kies cover
                    </button>

                    <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={handleMusicCoverUpload} />
                  </div>
                </div>

                <button className="button button--primary button--full" type="submit" disabled={musicBusy}>
                  {musicBusy ? 'Opslaan...' : 'Spotify-banner opslaan'}
                </button>

                {musicMessage ? <p className="settings-menu__message">{musicMessage}</p> : null}
              </form>
            ) : null}

            <div className="dashboard-music__separator">
              <span>Bestaande songs</span>
            </div>

            {musicReleasesLoading ? (
              <div className="empty-state empty-state--compact">
                <strong>Releases laden...</strong>
                <p>We halen de Spotify-banners uit Supabase.</p>
              </div>
            ) : displayedMusicReleases.length ? (
              <div className="music-release-grid music-release-grid--compact">
                {displayedMusicReleases.map((release) => (
                  <MusicReleaseCard
                    key={release.id}
                    release={release}
                    canManage={canManageMusic}
                    onDelete={handleDeleteMusicRelease}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state empty-state--compact">
                <strong>Nog geen muziekbanners</strong>
                <p>Mattiz kan hier een titel, cover en Spotify-link toevoegen.</p>
              </div>
            )}
          </section>
        ) : null}
      </div>

      {!isSongsPage ? (
        <aside className="dashboard-page__sidebar">
          <InfoNoticeCard compact className="dashboard-info" />
          <UpdateNoticeCard compact className="dashboard-update" />

          {canSendAnnouncements ? (
            <section className="panel dashboard-compose">
              <div className="panel__header">
                <span className="eyebrow">Pushberichten</span>
                <h2>
                  <Bell size={16} />
                  Melding sturen
                </h2>
              </div>

              <form className="dashboard-compose__form" onSubmit={handleSendAnnouncement}>
                <label className="field dashboard-compose__field">
                  <span>Ontvanger</span>
                  <select
                    className="input"
                    value={announcementRecipient}
                    onChange={(event) => setAnnouncementRecipient(event.target.value)}
                  >
                    <option value="team">Team</option>
                    {allowedUsers
                      .filter((user) => normalizeUsername(user.username) !== normalizeUsername(currentUser?.username))
                      .map((user) => (
                        <option key={user.username} value={user.username}>
                          {user.displayName || user.username}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="field dashboard-compose__field">
                  <span>Titel</span>
                  <input
                    className="input"
                    value={announcementTitle}
                    onChange={(event) => setAnnouncementTitle(event.target.value)}
                    placeholder="Bijvoorbeeld: Nieuwe sessie vanavond"
                  />
                </label>

                <label className="field dashboard-compose__field">
                  <span>Bericht</span>
                  <textarea
                    className="input dashboard-compose__textarea"
                    value={announcementBody}
                    onChange={(event) => setAnnouncementBody(event.target.value)}
                    placeholder="Typ hier je team- of pushbericht..."
                  />
                </label>

                <label className="field dashboard-compose__field">
                  <span>Link optioneel</span>
                  <input
                    className="input"
                    value={announcementLink}
                    onChange={(event) => setAnnouncementLink(event.target.value)}
                    placeholder="/chat of /dashboard"
                  />
                </label>

                <button className="button button--primary button--full" type="submit" disabled={announcementBusy}>
                  <Bell size={16} />
                  {announcementBusy ? 'Versturen...' : 'Stuur melding'}
                </button>

                {announcementMessage ? <p className="settings-menu__message">{announcementMessage}</p> : null}
              </form>
            </section>
          ) : null}

          <section className="panel dashboard-feed">
            <div className="panel__header">
              <span className="eyebrow">Meldingen</span>
              <h2>
                <Bell size={16} />
                Jouw meldingen
              </h2>

              {unreadNotifications.length && typeof onClearNotifications === 'function' ? (
                <button className="button button--ghost button--small" type="button" onClick={onClearNotifications}>
                  Alles wissen
                </button>
              ) : null}
            </div>

            {notificationsLoading ? (
              <div className="empty-state empty-state--compact">
                <strong>Meldingen laden...</strong>
                <p>Persoonlijke updates worden opgehaald.</p>
              </div>
            ) : unreadNotifications.length ? (
              <div className="dashboard-feed__list">
                {unreadNotifications.map((notification) => (
                  <DashboardListItem
                    key={notification.id}
                    item={notification}
                    unread
                    icon={Bell}
                    nowTick={nowTick}
                    showTimestamp={false}
                    onClick={() => onOpenNotification?.(notification)}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state empty-state--compact">
                <strong>Alles rustig</strong>
                <p>Je hebt nu geen ongelezen meldingen.</p>
              </div>
            )}
          </section>

          <section className="panel dashboard-feed">
            <div className="panel__header">
              <span className="eyebrow">Activiteit</span>
              <h2>
                <Clock3 size={16} />
                Laatste gebeurtenissen
              </h2>
            </div>

            {activityLoading ? (
              <div className="empty-state empty-state--compact">
                <strong>Activiteit laden...</strong>
                <p>De nieuwste wijzigingen worden verzameld.</p>
              </div>
            ) : activity.length ? (
              <div className="dashboard-feed__list">
                {activity.map((item) => (
                  <DashboardListItem
                    key={item.id}
                    item={item}
                    icon={item.kind === 'team_message' || item.kind === 'private_message' ? Bell : Sparkles}
                    nowTick={nowTick}
                    onClick={() => {
                      if (item.link) {
                        onOpenNotification?.(item);
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state empty-state--compact">
                <strong>Nog geen activiteit</strong>
                <p>Zodra iemand iets aanpast, verschijnt het hier.</p>
              </div>
            )}
          </section>
        </aside>
      ) : null}
    </section>
  );
}
