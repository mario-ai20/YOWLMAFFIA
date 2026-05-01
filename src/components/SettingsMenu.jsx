import {
  Check,
  CloudDownload,
  Mail,
  MonitorSmartphone,
  MoonStar,
  PencilLine,
  RefreshCw,
  Settings2,
  SunMedium,
  Upload,
  Camera
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { checkForUpdates, downloadUpdate, getUpdateState, installUpdate, subscribeToUpdateState } from '../utils/updates';
import { getInfoState, subscribeToInfoState } from '../utils/infoNotice';
import { normalizeUsername } from '../utils/users';
import { suggestNextVersion } from '../utils/version';
import InfoNoticeCard from './InfoNoticeCard';
import UpdateNoticeCard from './UpdateNoticeCard';
import UserAvatar from './UserAvatar';

const THEME_OPTIONS = [
  {
    value: 'system',
    label: 'Systeem',
    description: 'Volg je Windows-instelling',
    icon: MonitorSmartphone
  },
  {
    value: 'light',
    label: 'Wit',
    description: 'Lichte werkruimte',
    icon: SunMedium
  },
  {
    value: 'dark',
    label: 'Zwart',
    description: 'Donkere studio-look',
    icon: MoonStar
  }
];

export default function SettingsMenu({
  user,
  themeMode,
  onThemeModeChange,
  onProfileSave,
  onAvatarUpload,
  onAvatarDelete,
  onEmailChange,
  onPublishInfo,
  onPublishUpdate
}) {
  const [open, setOpen] = useState(false);
  const [themeDraft, setThemeDraft] = useState(themeMode);
  const [bio, setBio] = useState(user?.bio || '');
  const [statusMessage, setStatusMessage] = useState(user?.status_message || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || '');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [emailDraft, setEmailDraft] = useState(user?.email || '');
  const [emailEditOpen, setEmailEditOpen] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [updateState, setUpdateState] = useState(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const [infoTitle, setInfoTitle] = useState('');
  const [infoBody, setInfoBody] = useState('');
  const [infoActive, setInfoActive] = useState(true);
  const [infoBusy, setInfoBusy] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const [releaseVersion, setReleaseVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [releaseDownloadUrl, setReleaseDownloadUrl] = useState('');
  const [releaseFile, setReleaseFile] = useState(null);
  const [releaseFileName, setReleaseFileName] = useState('');
  const [releaseRequired, setReleaseRequired] = useState(false);
  const [releaseBusy, setReleaseBusy] = useState(false);
  const [releaseMessage, setReleaseMessage] = useState('');
  const avatarInputRef = useRef(null);
  const releaseInputRef = useRef(null);
  const canPublishUpdates = normalizeUsername(user?.username) === 'mattiz';
  const canPublishInfo = normalizeUsername(user?.username) === 'mattiz' && typeof onPublishInfo === 'function';

  useEffect(() => {
    setThemeDraft(themeMode);
  }, [themeMode, open]);

  useEffect(() => {
    setBio(user?.bio || '');
    setStatusMessage(user?.status_message || '');
    setAvatarUrl(user?.avatar_url || '');
    setAvatarPreview(user?.avatar_url || '');
    setEmailDraft(user?.email || '');
    setAvatarFile(null);
  }, [user?.bio, user?.status_message, user?.avatar_url, user?.username]);

  useEffect(() => {
    if (!emailEditOpen) {
      setEmailMessage('');
    }
  }, [emailEditOpen]);

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

  useEffect(() => {
    if (!open || releaseVersion || !updateState?.currentVersion) {
      return;
    }

    setReleaseVersion(suggestNextVersion(updateState.currentVersion));
  }, [open, releaseVersion, updateState?.currentVersion]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapUpdateState() {
      const initial = await getUpdateState();
      if (!cancelled && initial) {
        setUpdateState(initial);
        setUpdateMessage(initial.message || '');
      }
    }

    bootstrapUpdateState();

    const unsubscribe = subscribeToUpdateState((nextState) => {
      if (!cancelled) {
        setUpdateState(nextState);
        setUpdateMessage(nextState?.message || '');
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapInfoState() {
      const initial = await getInfoState();
      if (!cancelled && initial) {
        setInfoTitle(initial.title || '');
        setInfoBody(initial.body || '');
        setInfoActive(Boolean(initial.isActive));
      }
    }

    bootstrapInfoState();

    const unsubscribe = subscribeToInfoState((nextState) => {
      if (!cancelled && nextState) {
        setInfoTitle(nextState.title || '');
        setInfoBody(nextState.body || '');
        setInfoActive(Boolean(nextState.isActive));
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  async function handleSaveProfile() {
    setProfileBusy(true);
    setProfileMessage('');

    try {
      let nextAvatarUrl = avatarUrl;
      let avatarUploadError = null;

      if (avatarFile) {
        try {
          const uploaded = onAvatarUpload ? await onAvatarUpload(avatarFile) : null;
          nextAvatarUrl = uploaded?.url || uploaded || avatarUrl || user?.avatar_url || '';
          setAvatarUrl(nextAvatarUrl);
          setAvatarPreview(nextAvatarUrl);
          setAvatarFile(null);
        } catch (error) {
          avatarUploadError = error;
          nextAvatarUrl = avatarUrl || user?.avatar_url || '';
        }
      }

      await onProfileSave?.({
        bio,
        status_message: statusMessage,
        avatar_url: nextAvatarUrl,
        theme_mode: themeDraft
      });
      onThemeModeChange(themeDraft);
      if (avatarUploadError) {
        setProfileMessage(
          (avatarUploadError && typeof avatarUploadError === 'object' && ('message' in avatarUploadError || 'error_description' in avatarUploadError))
            ? `Bio en status opgeslagen, maar profielfoto upload mislukt: ${String(avatarUploadError.message || avatarUploadError.error_description)}`
            : 'Bio en status opgeslagen, maar profielfoto upload mislukt.'
        );
        return;
      }

      setProfileMessage('Profiel opgeslagen.');
      setOpen(false);
    } catch (error) {
      setProfileMessage(
        (error && typeof error === 'object' && ('message' in error || 'error_description' in error))
          ? String(error.message || error.error_description)
          : 'Opslaan mislukt.'
      );
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleChangeEmail(event) {
    event.preventDefault();

    if (!onEmailChange) {
      return;
    }

    setEmailBusy(true);
    setEmailMessage('');

    try {
      const result = await onEmailChange({
        email: emailDraft
      });

      setEmailMessage(result?.message || 'Bevestigingsmail verstuurd.');
      setEmailEditOpen(false);
    } catch (error) {
      setEmailMessage(
        (error && typeof error === 'object' && ('message' in error || 'error_description' in error))
          ? String(error.message || error.error_description)
          : 'E-mailadres wijzigen mislukt.'
      );
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleCheckUpdates() {
    setUpdateBusy(true);
    setUpdateMessage('');
    try {
      const result = await checkForUpdates();
      setUpdateState(result || null);
      setUpdateMessage(result?.message || 'Updatecontrole uitgevoerd.');
      if (!result) {
        setUpdateMessage('Updates werken alleen in de desktop-app.');
      }
    } catch (error) {
      setUpdateMessage(error instanceof Error ? error.message : 'Updatecontrole mislukt.');
    } finally {
      setUpdateBusy(false);
    }
  }

  async function handleDownloadUpdate() {
    setUpdateBusy(true);
    setUpdateMessage('');
    try {
      const result = await downloadUpdate();
      setUpdateState(result || null);
      setUpdateMessage(result?.message || 'Download gestart.');
      if (!result) {
        setUpdateMessage('Updates werken alleen in de desktop-app.');
      }
    } catch (error) {
      setUpdateMessage(error instanceof Error ? error.message : 'Download mislukt.');
    } finally {
      setUpdateBusy(false);
    }
  }

  async function handleInstallUpdate() {
    setUpdateBusy(true);
    setUpdateMessage('');
    try {
      const result = await installUpdate();
      setUpdateState((previous) => ({ ...(previous || {}), ...(result || {}) }));
      setUpdateMessage(result ? 'Installer gestart.' : 'Updates werken alleen in de desktop-app.');
    } catch (error) {
      setUpdateMessage(error instanceof Error ? error.message : 'Installatie mislukt.');
    } finally {
      setUpdateBusy(false);
    }
  }

  function handleChooseReleaseFile() {
    if (releaseInputRef.current) {
      releaseInputRef.current.value = '';
      releaseInputRef.current.click();
    }
  }

  async function handlePublishRelease(event) {
    event.preventDefault();

    if (!canPublishUpdates || releaseBusy) {
      return;
    }

    setReleaseBusy(true);
    setReleaseMessage('');

    try {
      const result = await onPublishUpdate?.({
        version: releaseVersion,
        notes: releaseNotes,
        downloadUrl: releaseDownloadUrl,
        file: releaseFile,
        isRequired: releaseRequired
      });

      setReleaseMessage(result?.message || 'Update gepubliceerd.');
      setReleaseNotes('');
      setReleaseDownloadUrl('');
      setReleaseFile(null);
      setReleaseFileName('');
    } catch (error) {
      setReleaseMessage(
        (error && typeof error === 'object' && ('message' in error || 'error_description' in error))
          ? String(error.message || error.error_description)
          : 'Publiceren mislukt.'
      );
    } finally {
      setReleaseBusy(false);
    }
  }

  async function handlePublishInfo(event) {
    event.preventDefault();

    if (!canPublishInfo || infoBusy) {
      return;
    }

    setInfoBusy(true);
    setInfoMessage('');

    try {
      const result = await onPublishInfo?.({
        title: infoTitle,
        body: infoBody,
        isActive: infoActive
      });

      setInfoMessage(result?.message || 'Info gepubliceerd.');
    } catch (error) {
      setInfoMessage(
        (error && typeof error === 'object' && ('message' in error || 'error_description' in error))
          ? String(error.message || error.error_description)
          : 'Publiceren mislukt.'
      );
    } finally {
      setInfoBusy(false);
    }
  }

  function handleChooseAvatar() {
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
      avatarInputRef.current.click();
    }
  }

  async function handleRemoveAvatar() {
    setProfileBusy(true);
    setProfileMessage('');

    try {
      if (onAvatarDelete) {
        await onAvatarDelete();
      }

      setAvatarFile(null);
      setAvatarUrl('');
      setAvatarPreview('');

      await onProfileSave?.({
        bio,
        status_message: statusMessage,
        avatar_url: '',
        theme_mode: themeDraft
      });

      onThemeModeChange(themeDraft);
      setProfileMessage('Profielfoto verwijderd.');
    } catch (error) {
      setProfileMessage(
        (error && typeof error === 'object' && ('message' in error || 'error_description' in error))
          ? String(error.message || error.error_description)
          : 'Profielfoto verwijderen mislukt.'
      );
    } finally {
      setProfileBusy(false);
    }
  }

  const overlay =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div className="settings-menu__overlay" role="dialog" aria-modal="true" aria-label="Instellingen">
            <button className="settings-menu__backdrop" type="button" aria-label="Sluit instellingen" onClick={() => setOpen(false)} />

            <div className="settings-menu__panel panel" role="document">
              <div className="settings-menu__header">
                <div className="settings-menu__identity">
                  <UserAvatar user={user} name={user?.displayName || user?.username} src={avatarPreview || user?.avatar_url} size={58} />
                  <div className="settings-menu__identity-copy">
                    <span className="eyebrow">Persoonlijk</span>
                    <strong>{user?.displayName || user?.username || 'Onbekend'}</strong>
                    <p>{user?.email || 'Geen e-mail gekoppeld'}</p>
                  </div>
                </div>
                <div className="settings-menu__status">
                  {statusMessage || bio || 'Beschikbaar'}
                </div>
              </div>

              <div className="settings-menu__group">
                <span className="settings-menu__label">Uiterlijk</span>
                <div className="settings-menu__options">
                  {THEME_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isActive = themeDraft === option.value;

                    return (
                      <button
                        key={option.value}
                        className={`settings-menu__option ${isActive ? 'is-active' : ''}`}
                        type="button"
                        onClick={() => setThemeDraft(option.value)}
                      >
                        <span className="settings-menu__option-icon">
                          <Icon size={16} />
                        </span>
                        <span className="settings-menu__option-copy">
                          <strong>{option.label}</strong>
                          <span>{option.description}</span>
                        </span>
                        {isActive ? <Check size={16} /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="settings-menu__body">
                <div className="settings-menu__group">
                  <span className="settings-menu__label">Info</span>
                  <InfoNoticeCard compact showActions={false} className="settings-menu__info" />

                  {canPublishInfo ? (
                    <form className="settings-menu__publish" onSubmit={handlePublishInfo}>
                      <label className="field settings-menu__field">
                        <span>Titel</span>
                        <input
                          className="input"
                          value={infoTitle}
                          onChange={(event) => setInfoTitle(event.target.value)}
                          placeholder="Bijvoorbeeld: Nieuwe crew-info"
                        />
                      </label>

                      <label className="field settings-menu__field">
                        <span>Bericht</span>
                        <textarea
                          className="input settings-menu__textarea"
                          value={infoBody}
                          onChange={(event) => setInfoBody(event.target.value)}
                          placeholder="Schrijf hier wat de crew moet zien op login en dashboard..."
                        />
                      </label>

                      <label className="settings-menu__toggle settings-menu__toggle--full">
                        <input
                          type="checkbox"
                          checked={infoActive}
                          onChange={(event) => setInfoActive(event.target.checked)}
                        />
                        <span>Toon info op login en dashboard</span>
                      </label>

                      <button className="button button--primary button--full" type="submit" disabled={infoBusy}>
                        <PencilLine size={16} />
                        {infoBusy ? 'Opslaan...' : 'Info opslaan'}
                      </button>

                      {infoMessage ? <p className="settings-menu__message">{infoMessage}</p> : null}
                    </form>
                  ) : (
                    <p className="settings-menu__hint">
                      Alleen Mattiz kan deze info beheren. Wat hier staat verschijnt exact hetzelfde op het login-scherm en in het dashboard.
                    </p>
                  )}
                </div>

                <div className="settings-menu__group">
                  <span className="settings-menu__label">Account</span>
                  <div className="settings-menu__upload">
                    <UserAvatar user={user} name={user?.displayName || user?.username} src={avatarPreview || user?.avatar_url} size={86} />
                    <div className="settings-menu__upload-copy">
                      <strong>Profielfoto</strong>
                      <span>Kies een afbeelding voor jouw account.</span>
                      <div className="settings-menu__upload-actions">
                        <button className="button button--secondary" type="button" onClick={handleChooseAvatar}>
                          <Camera size={16} />
                          Wijzig foto
                        </button>
                        <button className="button button--ghost" type="button" onClick={handleRemoveAvatar} disabled={profileBusy}>
                          Verwijder foto
                        </button>
                      </div>
                    </div>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setAvatarFile(file);
                        event.target.value = '';
                      }}
                    />
                  </div>

                  <div className="settings-menu__email-box">
                    <div className="settings-menu__email-copy">
                      <strong>E-mailadres</strong>
                      <span>{user?.email || 'Geen e-mail gekoppeld'}</span>
                    </div>
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => setEmailEditOpen((value) => !value)}
                    >
                      <Mail size={16} />
                      Wijzig e-mailadres
                    </button>
                  </div>

                  {emailEditOpen ? (
                    <form className="settings-menu__email-form" onSubmit={handleChangeEmail}>
                      <label className="field settings-menu__field">
                        <span>Nieuw e-mailadres</span>
                        <input
                          className="input"
                          type="email"
                          value={emailDraft}
                          onChange={(event) => setEmailDraft(event.target.value)}
                          placeholder="jouw@nieuwadres.be"
                          autoComplete="email"
                          required
                        />
                      </label>

                      <div className="login-form__actions settings-menu__email-actions">
                        <button
                          className="button button--ghost"
                          type="button"
                          disabled={emailBusy}
                          onClick={() => setEmailEditOpen(false)}
                        >
                          Terug
                        </button>

                        <button className="button button--primary" type="submit" disabled={emailBusy}>
                          {emailBusy ? 'Versturen...' : 'Stuur bevestiging'}
                        </button>
                      </div>
                    </form>
                  ) : null}

                  <label className="field settings-menu__field">
                    <span>Bio</span>
                    <textarea
                      className="input settings-menu__textarea"
                      value={bio}
                      onChange={(event) => setBio(event.target.value)}
                      placeholder="Schrijf iets over jezelf of je rol in de crew..."
                    />
                  </label>

                  <label className="field settings-menu__field">
                    <span>Statusbericht</span>
                    <input
                      className="input"
                      value={statusMessage}
                      onChange={(event) => setStatusMessage(event.target.value)}
                      placeholder="Bijvoorbeeld: aan het schrijven"
                    />
                  </label>

                  <button className="button button--primary button--full" type="button" onClick={handleSaveProfile} disabled={profileBusy}>
                    <PencilLine size={16} />
                    {profileBusy ? 'Opslaan...' : 'Opslaan en toepassen'}
                  </button>

                  {profileMessage ? <p className="settings-menu__message">{profileMessage}</p> : null}
                  {emailMessage ? <p className="settings-menu__message">{emailMessage}</p> : null}
                </div>

                <div className="settings-menu__group">
                  <span className="settings-menu__label">Updates</span>
                  <UpdateNoticeCard compact showActions={false} className="settings-menu__update" />
                  <button className="button button--secondary button--full" type="button" onClick={handleCheckUpdates} disabled={updateBusy}>
                    <RefreshCw size={16} />
                    Controleer updates
                  </button>

                  {updateState?.status === 'available' ? (
                    <button className="button button--primary button--full" type="button" onClick={handleDownloadUpdate} disabled={updateBusy}>
                      <CloudDownload size={16} />
                      Download update
                    </button>
                  ) : null}

                  {updateState?.status === 'ready' ? (
                    <button className="button button--primary button--full" type="button" onClick={handleInstallUpdate} disabled={updateBusy}>
                      <Upload size={16} />
                      Installeer update
                    </button>
                  ) : null}

                {updateMessage ? <p className="settings-menu__message">{updateMessage}</p> : null}

                  {canPublishUpdates ? (
                    <form className="settings-menu__publish" onSubmit={handlePublishRelease}>
                      <span className="settings-menu__label">Publiceer update</span>

                        <label className="field settings-menu__field">
                          <span>Versie</span>
                          <input
                            className="input"
                            value={releaseVersion}
                            onChange={(event) => setReleaseVersion(event.target.value)}
                            placeholder="Bijvoorbeeld 2.0.1"
                          />
                          <small className="settings-menu__hint">
                            Aanbevolen nieuwe versie: {suggestNextVersion(updateState?.currentVersion)}
                          </small>
                        </label>

                      <label className="field settings-menu__field">
                        <span>Opmerking</span>
                        <textarea
                          className="input settings-menu__textarea"
                          value={releaseNotes}
                          onChange={(event) => setReleaseNotes(event.target.value)}
                          placeholder="Wat is er nieuw in deze update?"
                        />
                      </label>

                      <label className="field settings-menu__field">
                        <span>GitHub download-URL (optioneel)</span>
                        <input
                          className="input"
                          value={releaseDownloadUrl}
                          onChange={(event) => setReleaseDownloadUrl(event.target.value)}
                          placeholder="Plak hier de GitHub release-link of directe .exe-link"
                        />
                      </label>

                      <label className="field settings-menu__field">
                        <span>Updatebestand</span>
                        <div className="settings-menu__upload settings-menu__upload--compact">
                          <div className="settings-menu__upload-copy">
                            <strong>{releaseFileName || 'Kies de .exe van de update'}</strong>
                            <span>Gebruik bij voorkeur een GitHub Release-link of een directe .exe-link. Bestanden boven 50 MB werken op Supabase Free niet als upload.</span>
                            <div className="settings-menu__upload-actions">
                              <button className="button button--secondary" type="button" onClick={handleChooseReleaseFile}>
                                <Upload size={16} />
                                Kies .exe
                              </button>
                              <label className="settings-menu__toggle">
                                <input
                                  type="checkbox"
                                  checked={releaseRequired}
                                  onChange={(event) => setReleaseRequired(event.target.checked)}
                                />
                                <span>Verplichte update</span>
                              </label>
                            </div>
                          </div>
                          <input
                            ref={releaseInputRef}
                            type="file"
                            hidden
                            accept=".exe,application/vnd.microsoft.portable-executable"
                            onChange={(event) => {
                              const file = event.target.files?.[0] || null;
                              setReleaseFile(file);
                              setReleaseFileName(file?.name || '');
                              event.target.value = '';
                            }}
                          />
                        </div>
                      </label>

                      <button className="button button--primary button--full" type="submit" disabled={releaseBusy}>
                        <CloudDownload size={16} />
                        {releaseBusy ? 'Publiceren...' : 'Publiceer update'}
                      </button>

                      {releaseMessage ? <p className="settings-menu__message">{releaseMessage}</p> : null}
                    </form>
                  ) : null}
                </div>
              </div>

              <p className="settings-menu__hint">Je wijzigingen worden pas toegepast zodra je opslaat.</p>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        className="icon-text-button settings-menu__trigger"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Settings2 size={16} />
        Instellingen
      </button>
      {overlay}
    </>
  );
}
