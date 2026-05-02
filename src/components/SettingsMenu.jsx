import { Check, Camera, Mail, MonitorSmartphone, MoonStar, PencilLine, Settings2, SunMedium } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  onEmailChange
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
  const [emailMfaEnabled, setEmailMfaEnabled] = useState(user?.email_mfa_enabled !== false);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    setThemeDraft(themeMode);
  }, [themeMode, open]);

  useEffect(() => {
    setBio(user?.bio || '');
    setStatusMessage(user?.status_message || '');
    setAvatarUrl(user?.avatar_url || '');
    setAvatarPreview(user?.avatar_url || '');
    setEmailDraft(user?.email || '');
    setEmailMfaEnabled(user?.email_mfa_enabled !== false);
    setAvatarFile(null);
  }, [user?.bio, user?.status_message, user?.avatar_url, user?.username, user?.email_mfa_enabled]);

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

    return () => URL.revokeObjectURL(nextPreview);
  }, [avatarFile]);

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
        theme_mode: themeDraft,
        email_mfa_enabled: emailMfaEnabled
      });
      onThemeModeChange(themeDraft);

      if (avatarUploadError) {
        setProfileMessage(
          avatarUploadError && typeof avatarUploadError === 'object' && ('message' in avatarUploadError || 'error_description' in avatarUploadError)
            ? `Bio en status opgeslagen, maar profielfoto upload mislukt: ${String(avatarUploadError.message || avatarUploadError.error_description)}`
            : 'Bio en status opgeslagen, maar profielfoto upload mislukt.'
        );
        return;
      }

      setProfileMessage('Profiel opgeslagen.');
      setOpen(false);
    } catch (error) {
      setProfileMessage(
        error && typeof error === 'object' && ('message' in error || 'error_description' in error)
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
      const result = await onEmailChange({ email: emailDraft });
      setEmailMessage(result?.message || 'Bevestigingsmail verstuurd.');
      setEmailEditOpen(false);
    } catch (error) {
      setEmailMessage(
        error && typeof error === 'object' && ('message' in error || 'error_description' in error)
          ? String(error.message || error.error_description)
          : 'E-mailadres wijzigen mislukt.'
      );
    } finally {
      setEmailBusy(false);
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
        error && typeof error === 'object' && ('message' in error || 'error_description' in error)
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

                <div className="settings-menu__status">{statusMessage || bio || 'Beschikbaar'}</div>
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
                    <button className="button button--secondary" type="button" onClick={() => setEmailEditOpen((value) => !value)}>
                      <Mail size={16} />
                      Wijzig e-mailadres
                    </button>
                  </div>

                  <div className={`settings-menu__toggle ${emailMfaEnabled ? 'is-active' : ''}`}>
                    <div className="settings-menu__toggle-copy">
                      <strong>MFA via mail</strong>
                      <span>Vraag na je wachtwoord nog een e-mailcode bij het inloggen.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailMfaEnabled}
                      onChange={(event) => setEmailMfaEnabled(event.target.checked)}
                      aria-label="MFA via mail aan of uit zetten"
                    />
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
                        <button className="button button--ghost" type="button" disabled={emailBusy} onClick={() => setEmailEditOpen(false)}>
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
