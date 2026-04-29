import { ArrowLeft, LockKeyhole, LogIn, MailCheck, RefreshCcw, ShieldCheck } from 'lucide-react';
import BrandMark from '../components/BrandMark';

export default function LoginPage({
  stage = 'credentials',
  codeTarget = '',
  identityLabel = '',
  hint = '',
  onLogin,
  onVerifyCode,
  onResendCode,
  onBack,
  loading = false,
  error = ''
}) {
  const isOtpStage = stage === 'otp';

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

            onLogin?.({
              username: String(formData.get('username') || ''),
              password: String(formData.get('password') || '')
            });
          }}
        >
          <div className="login-form__intro">
            <span className="eyebrow">Alleen voor interne toegang</span>
            <h1>{isOtpStage ? "YOWL's Authenticator" : 'Log in op YOWLMAFFIA'}</h1>
            <p>
              {isOtpStage
                ? 'We sturen een eenmalige code naar je mailbox. Die moet je invullen voordat je de app mag openen.'
                : 'Werk samen aan songs, lyrics en tracks in één online omgeving.'}
            </p>
            <p className="login-form__lead">
              {isOtpStage
                ? 'Dit is extra beveiliging naast je e-mail en wachtwoord.'
                : 'Gebruik je e-mail en wachtwoord om te starten. Daarna sturen we je een code per mail.'}
            </p>
          </div>

          {isOtpStage ? (
            <div className="login-authenticator">
              <div className="login-authenticator__icon">
                <ShieldCheck size={22} />
              </div>
              <div className="login-authenticator__copy">
                <strong>Code naar {codeTarget || 'je e-mailadres'}</strong>
                <span>{identityLabel || 'YOWLMAFFIA account'}</span>
              </div>
            </div>
          ) : null}

          {!isOtpStage ? (
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
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </label>
            </>
          ) : (
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
          )}

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

          <div className="login-form__actions">
            {isOtpStage ? (
              <button
                className="button button--ghost"
                type="button"
                disabled={loading}
                onClick={onBack}
                title="Terug naar e-mail en wachtwoord"
              >
                <ArrowLeft size={16} />
                Terug
              </button>
            ) : null}

            <button className="button button--primary" type="submit" disabled={loading}>
              {isOtpStage ? <MailCheck size={16} /> : <LogIn size={16} />}
              {loading ? (isOtpStage ? 'Code controleren...' : 'Inloggen en code sturen...') : isOtpStage ? 'Code verifiëren' : 'Inloggen'}
            </button>
          </div>

          {isOtpStage ? (
            <button className="button button--secondary button--full" type="button" disabled={loading} onClick={onResendCode}>
              <RefreshCcw size={16} />
              Stuur code opnieuw
            </button>
          ) : null}
        </form>
      </div>
    </section>
  );
}
