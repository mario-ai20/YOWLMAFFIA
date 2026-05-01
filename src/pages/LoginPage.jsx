import { ArrowLeft, KeyRound, LockKeyhole, LogIn, MailCheck, RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import BrandMark from '../components/BrandMark';
import InfoNoticeCard from '../components/InfoNoticeCard';
import UpdateNoticeCard from '../components/UpdateNoticeCard';

export default function LoginPage({
  stage = 'credentials',
  hint = '',
  onLogin,
  onVerifyCode,
  onResendCode,
  onRequestPasswordReset,
  onRecoverPassword,
  onBack,
  forgotPasswordEnabled = false,
  loading = false,
  error = ''
}) {
  const isOtpStage = stage === 'otp';
  const isRecoveryStage = stage === 'recovery';
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState('');
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [recoveryError, setRecoveryError] = useState('');

  useEffect(() => {
    if (!forgotPasswordEnabled || isOtpStage || isRecoveryStage) {
      setForgotOpen(false);
    }
  }, [forgotPasswordEnabled, isOtpStage, isRecoveryStage]);

  useEffect(() => {
    if (!isRecoveryStage) {
      setRecoveryPassword('');
      setRecoveryConfirmPassword('');
      setRecoveryMessage('');
      setRecoveryError('');
    }
  }, [isRecoveryStage]);

  useEffect(() => {
    if (!forgotOpen) {
      setForgotMessage('');
      setForgotError('');
    }
  }, [forgotOpen]);

  async function handleForgotPasswordSubmit(event) {
    event.preventDefault();
    setForgotBusy(true);
    setForgotMessage('');
    setForgotError('');

    try {
      const result = await onRequestPasswordReset?.({
        email: forgotEmail
      });

      setForgotMessage(result?.message || 'We stuurden een resetmail.');
    } catch (formError) {
      setForgotError(
        formError instanceof Error
          ? formError.message
          : 'Resetmail versturen mislukt.'
      );
    } finally {
      setForgotBusy(false);
    }
  }

  async function handleRecoverySubmit(event) {
    event.preventDefault();
    setRecoveryBusy(true);
    setRecoveryMessage('');
    setRecoveryError('');

    try {
      if (recoveryPassword !== recoveryConfirmPassword) {
        throw new Error('De wachtwoorden komen niet overeen.');
      }

      const result = await onRecoverPassword?.({
        password: recoveryPassword,
        confirmPassword: recoveryConfirmPassword
      });

      setRecoveryMessage(result?.message || 'Wachtwoord bijgewerkt.');
      setRecoveryPassword('');
      setRecoveryConfirmPassword('');
    } catch (formError) {
      setRecoveryError(
        formError instanceof Error
          ? formError.message
          : 'Wachtwoord wijzigen mislukt.'
      );
    } finally {
      setRecoveryBusy(false);
    }
  }

  return (
    <section className="login-page">
      <div className="login-page__panel">
        <div className="login-page__hero">
          <BrandMark stacked />
        </div>

        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);

            if (isOtpStage) {
              onVerifyCode?.({
                code: String(formData.get('code') || '')
              });
              return;
            }

            if (isRecoveryStage) {
              void handleRecoverySubmit(event);
              return;
            }

            onLogin?.({
              username: String(formData.get('username') || ''),
              password: String(formData.get('password') || '')
            });
          }}
        >
          <div className="login-form__intro">
            <span className="eyebrow">Alleen voor interne toegang</span>
            <h1>
              {isOtpStage
                ? "Yowl's Authenticator"
                : isRecoveryStage
                  ? 'Nieuw wachtwoord instellen'
                  : 'Log in op YOWLMAFFIA'}
            </h1>
            <p>
              {isOtpStage
                ? 'We sturen een eenmalige code naar je mailbox. Die moet je invullen voordat je de app mag openen.'
                : isRecoveryStage
                  ? 'Kies een nieuw wachtwoord voor je YOWLMAFFIA-account.'
                  : 'Werk samen aan songs, lyrics en tracks in ??n online omgeving.'}
            </p>
            <p className="login-form__lead">
              {isOtpStage
                ? 'Dit is extra beveiliging naast je e-mail en wachtwoord.'
                : isRecoveryStage
                  ? 'Daarna kan je opnieuw inloggen met je nieuwe wachtwoord.'
                  : 'Gebruik je e-mail en wachtwoord om te starten. Daarna sturen we je een code per mail.'}
            </p>
          </div>

          <InfoNoticeCard compact className="login-page__info" />
          <UpdateNoticeCard compact className="login-page__update" />

          {!isOtpStage && !isRecoveryStage ? (
            <>
              <label className="field">
                <span>E-mail of username</span>
                <input
                  className="input"
                  name="username"
                  placeholder="Typ je e-mail of username"
                  autoComplete="off"
                  spellCheck="false"
                  required
                />
              </label>

              <label className="field">
                <span>Wachtwoord</span>
                <input
                  className="input"
                  name="password"
                  type="password"
                  placeholder="????????"
                  autoComplete="current-password"
                  required
                />
              </label>
            </>
          ) : null}

          {isOtpStage ? (
            <label className="field">
              <span>Inlogcode</span>
              <input
                className="input input--auth-code"
                name="code"
                inputMode="numeric"
                placeholder="Typ de code uit je e-mail"
                autoComplete="one-time-code"
                spellCheck="false"
                required
              />
            </label>
          ) : null}

          {isRecoveryStage ? (
            <>
              <label className="field">
                <span>Nieuw wachtwoord</span>
                <input
                  className="input"
                  name="newPassword"
                  type="password"
                  placeholder="Kies een nieuw wachtwoord"
                  autoComplete="new-password"
                  required
                  value={recoveryPassword}
                  onChange={(event) => setRecoveryPassword(event.target.value)}
                />
              </label>

              <label className="field">
                <span>Herhaal wachtwoord</span>
                <input
                  className="input"
                  name="confirmPassword"
                  type="password"
                  placeholder="Herhaal je nieuwe wachtwoord"
                  autoComplete="new-password"
                  required
                  value={recoveryConfirmPassword}
                  onChange={(event) => setRecoveryConfirmPassword(event.target.value)}
                />
              </label>
            </>
          ) : null}

          {hint ? (
            <div className="form-hint">
              <MailCheck size={16} />
              <span>{hint}</span>
            </div>
          ) : null}

          {error ? (
            <div className="form-error">
              <LockKeyhole size={16} />
              <span>{error}</span>
            </div>
          ) : null}

          {recoveryMessage ? (
            <div className="form-hint">
              <KeyRound size={16} />
              <span>{recoveryMessage}</span>
            </div>
          ) : null}

          {recoveryError ? (
            <div className="form-error">
              <LockKeyhole size={16} />
              <span>{recoveryError}</span>
            </div>
          ) : null}

          <div className="login-form__actions">
            {isOtpStage || isRecoveryStage ? (
              <button
                className="button button--ghost"
                type="button"
                disabled={loading || recoveryBusy}
                onClick={onBack}
                title="Terug naar e-mail en wachtwoord"
              >
                <ArrowLeft size={16} />
                Terug
              </button>
            ) : null}

            <button
              className="button button--primary"
              type="submit"
              disabled={loading || recoveryBusy || forgotBusy}
            >
              {isOtpStage || isRecoveryStage ? <MailCheck size={16} /> : <LogIn size={16} />}
              {loading || recoveryBusy
                ? isOtpStage
                  ? 'Code controleren...'
                  : isRecoveryStage
                    ? 'Wachtwoord opslaan...'
                    : 'Inloggen...'
                : isOtpStage
                  ? 'Code verifiëren'
                  : isRecoveryStage
                    ? 'Wachtwoord opslaan'
                    : 'Inloggen'}
            </button>
          </div>
        </form>

        {!isOtpStage && !isRecoveryStage && forgotPasswordEnabled ? (
          <div className="login-reset">
            <button
              className="button button--secondary button--full login-reset__toggle"
              type="button"
              onClick={() => setForgotOpen((value) => !value)}
            >
              <RefreshCcw size={16} />
              Wachtwoord vergeten?
            </button>

            {forgotOpen ? (
              <form className="login-reset__form" onSubmit={handleForgotPasswordSubmit}>
                <p className="login-reset__text">
                  Vul je e-mailadres in. We sturen een resetmail naar het juiste YOWLMAFFIA-account.
                </p>

                <label className="field">
                  <span>E-mailadres</span>
                  <input
                    className="input"
                    name="forgotEmail"
                    type="email"
                    placeholder="jouw@mailadres.be"
                    autoComplete="email"
                    spellCheck="false"
                    value={forgotEmail}
                    onChange={(event) => setForgotEmail(event.target.value)}
                    required
                  />
                </label>

                <div className="login-form__actions login-reset__actions">
                  <button
                    className="button button--ghost"
                    type="button"
                    disabled={forgotBusy}
                    onClick={() => {
                      setForgotOpen(false);
                    }}
                  >
                    Terug
                  </button>

                  <button className="button button--primary" type="submit" disabled={forgotBusy}>
                    {forgotBusy ? 'Versturen...' : 'Stuur resetmail'}
                  </button>
                </div>

                {forgotMessage ? (
                  <div className="form-hint">
                    <MailCheck size={16} />
                    <span>{forgotMessage}</span>
                  </div>
                ) : null}

                {forgotError ? (
                  <div className="form-error">
                    <LockKeyhole size={16} />
                    <span>{forgotError}</span>
                  </div>
                ) : null}
              </form>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
