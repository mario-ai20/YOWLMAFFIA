import { ArrowRight, RefreshCw, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import BrandMark from '../components/BrandMark';
import { publicChatSupabase, isPublicChatSupabaseConfigured } from '../utils/supabase';
import { loadPublicAllowedUsers, publicUsernameToEmail, resolvePublicUserFromSession } from '../utils/publicUsers';
import { useNavigate } from 'react-router';

function InfoBlock({ eyebrow, title, body }) {
  return (
    <article className="panel public-block">
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{body}</p>
    </article>
  );
}

export default function PublicHomePage() {
  const navigate = useNavigate();
  const [view, setView] = useState('home');
  const [infoBlock, setInfoBlock] = useState({ title: 'YOWLMAFFIA', body: 'Welkom op het publieke deel van YOWLMAFFIA.' });
  const [rulesBlock, setRulesBlock] = useState({ title: 'Regels', body: 'Wees vriendelijk, respectvol en hou de chat proper.' });
  const [publicUsers, setPublicUsers] = useState([]);
  const [loginIdentity, setLoginIdentity] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginStage, setLoginStage] = useState('credentials');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [loginHint, setLoginHint] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerBirthDate, setRegisterBirthDate] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loginFailedAttempts, setLoginFailedAttempts] = useState(0);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');

  useEffect(() => {
    if (!publicChatSupabase) {
      return undefined;
    }

    let cancelled = false;

    async function bootstrapPublicBlocks() {
      const [infoResult, rulesResult, allowedResult] = await Promise.all([
        publicChatSupabase.from('app_info_blocks').select('*').eq('id', 'current').maybeSingle(),
        publicChatSupabase.from('app_info_blocks').select('*').eq('id', 'rules').maybeSingle(),
        loadPublicAllowedUsers().catch(() => [])
      ]);

      if (cancelled) {
        return;
      }

      if (infoResult?.data) {
        setInfoBlock({
          title: String(infoResult.data.title || 'YOWLMAFFIA').trim() || 'YOWLMAFFIA',
          body: String(infoResult.data.body || '').trim() || 'Welkom op het publieke deel van YOWLMAFFIA.'
        });
      }

      if (rulesResult?.data) {
        setRulesBlock({
          title: String(rulesResult.data.title || 'Regels').trim() || 'Regels',
          body: String(rulesResult.data.body || '').trim() || 'Wees vriendelijk, respectvol en hou de chat proper.'
        });
      }

      setPublicUsers(Array.isArray(allowedResult) ? allowedResult : []);
    }

    bootstrapPublicBlocks();

    const infoChannel = publicChatSupabase
      .channel('public-home-info-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_info_blocks' }, bootstrapPublicBlocks)
      .subscribe();

    return () => {
      cancelled = true;
      publicChatSupabase.removeChannel(infoChannel);
    };
  }, []);

  useEffect(() => {
    if (!forgotOpen) {
      setForgotMessage('');
      setForgotError('');
    }
  }, [forgotOpen]);

  useEffect(() => {
    if (view !== 'login') {
      setLoginStage('credentials');
      setLoginEmail('');
      setLoginCode('');
      setLoginHint('');
    }
  }, [view]);

  function maskEmail(emailAddress = '') {
    const value = String(emailAddress || '').trim();
    if (!value.includes('@')) {
      return value;
    }

    const [local, domain] = value.split('@');
    const [host, ...rest] = domain.split('.');
    const maskedLocal = local.length <= 2 ? `${local.slice(0, 1)}*` : `${local.slice(0, 2)}***`;
    const maskedHost = host.length <= 1 ? `${host.slice(0, 1)}*` : `${host.slice(0, 1)}***`;

    return `${maskedLocal}@${maskedHost}${rest.length ? `.${rest.join('.')}` : ''}`;
  }

  function resetLoginFlow() {
    setLoginStage('credentials');
    setLoginEmail('');
    setLoginCode('');
    setLoginHint('');
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();

    if (!publicChatSupabase) {
      setError('Supabase is nog niet gekoppeld voor de public chat.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const identity = loginIdentity.trim();
      const isEmail = identity.includes('@');
      const email = isEmail ? identity : publicUsernameToEmail(identity, publicUsers);

      if (!email) {
        throw new Error('We vinden dit account niet terug.');
      }

      const result = await publicChatSupabase.auth.signInWithPassword({
        email,
        password: loginPassword
      });

      if (result.error) {
        setLoginFailedAttempts((count) => count + 1);
        throw result.error;
      }

      const resolvedUser = resolvePublicUserFromSession(result.data?.session || null, publicUsers);
      const requiresEmailMfa = resolvedUser?.email_mfa_enabled !== false;

      setLoginFailedAttempts(0);

      if (!requiresEmailMfa) {
        setMessage('Je bent ingelogd. De publieke chat opent nu.');
        setLoginPassword('');
        resetLoginFlow();
        navigate('/public/dashboard');
        return;
      }

      await publicChatSupabase.auth.signOut();

      const { error: otpError } = await publicChatSupabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false
        }
      });

      if (otpError) {
        throw otpError;
      }

      setLoginStage('otp');
      setLoginEmail(email);
      setLoginCode('');
      setLoginPassword('');
      setLoginHint(`We hebben een inlogcode gestuurd naar ${maskEmail(email)}.`);
      setMessage('');
    } catch (formError) {
      setError(formError instanceof Error ? formError.message : 'Inloggen mislukt.');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyLoginCode(event) {
    event.preventDefault();

    if (!publicChatSupabase) {
      setError('Supabase is nog niet gekoppeld voor de public chat.');
      return;
    }

    const nextCode = String(loginCode || '').trim();
    if (!nextCode) {
      setError('Vul de code in die je per mail kreeg.');
      return;
    }

    if (!loginEmail) {
      setError('We missen je e-mailadres. Log opnieuw in.');
      resetLoginFlow();
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const { data, error } = await publicChatSupabase.auth.verifyOtp({
        email: loginEmail,
        token: nextCode,
        type: 'email'
      });

      if (error) {
        throw error;
      }

      setLoginFailedAttempts(0);
      resetLoginFlow();
      navigate('/public/dashboard');
    } catch (formError) {
      setError(formError instanceof Error ? formError.message : 'De code klopt niet of is verlopen.');
    } finally {
      setBusy(false);
    }
  }

  async function handleResendLoginCode() {
    if (!publicChatSupabase) {
      setError('Supabase is nog niet gekoppeld voor de public chat.');
      return;
    }

    if (!loginEmail) {
      setError('Log eerst opnieuw in om een nieuwe code te sturen.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const { error } = await publicChatSupabase.auth.signInWithOtp({
        email: loginEmail,
        options: {
          shouldCreateUser: false
        }
      });

      if (error) {
        throw error;
      }

      setLoginHint(`We stuurden een nieuwe code naar ${maskEmail(loginEmail)}.`);
    } catch (formError) {
      setError(formError instanceof Error ? formError.message : 'We konden geen nieuwe code sturen.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();

    if (!publicChatSupabase) {
      setError('Supabase is nog niet gekoppeld voor de public chat.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      if (!registerUsername.trim() || !registerEmail.trim() || !registerBirthDate || !registerPassword || !registerConfirmPassword) {
        throw new Error('Vul alle verplichte velden in.');
      }

      if (registerPassword !== registerConfirmPassword) {
        throw new Error('Wachtwoorden komen niet overeen.');
      }

      const result = await publicChatSupabase.auth.signUp({
        email: registerEmail.trim(),
        password: registerPassword,
        options: {
          data: {
            username: registerUsername.trim(),
            display_name: registerUsername.trim(),
            birth_date: registerBirthDate
          }
        }
      });

      if (result.error) {
        throw result.error;
      }

      const nextProfile = {
        username: registerUsername.trim(),
        display_name: registerUsername.trim(),
        email: registerEmail.trim(),
        birth_date: registerBirthDate,
        bio: '',
        status_message: '',
        gender: 'zeg ik liever niet',
        theme_mode: 'system',
        email_mfa_enabled: true,
        avatar_url: '',
        updated_at: new Date().toISOString(),
        last_online_at: new Date().toISOString()
      };

      const { error: profileError } = await publicChatSupabase
        .from('allowed_users')
        .upsert(nextProfile, { onConflict: 'username' });

      if (profileError) {
        throw profileError;
      }

      setMessage('Account aangemaakt. Controleer je e-mail voor bevestiging.');
      setView('login');
      setLoginIdentity(registerEmail.trim());
      setLoginPassword('');
      resetLoginFlow();
    } catch (formError) {
      setError(formError instanceof Error ? formError.message : 'Account aanmaken mislukt.');
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotSubmit(event) {
    event?.preventDefault?.();

    if (!publicChatSupabase) {
      setError('Supabase is nog niet gekoppeld voor de public chat.');
      return;
    }

    setForgotBusy(true);
    setForgotError('');
    setForgotMessage('');

    try {
      const result = await publicChatSupabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/#/login`
      });

      if (result.error) {
        throw result.error;
      }

      setForgotMessage('We stuurden een resetmail naar je adres.');
    } catch (formError) {
      setForgotError(formError instanceof Error ? formError.message : 'Resetmail versturen mislukt.');
    } finally {
      setForgotBusy(false);
    }
  }

  return (
    <section className="public-page">
      <a className="public-page__internal-button button button--ghost" href="#/login">
        <Shield size={16} />
        Interne toegang
      </a>

      <div className="public-page__shell">
        <header className="public-page__hero panel">
          <div className="public-page__hero-brand">
            <BrandMark stacked subtitle="" />
            <div>
              <span className="eyebrow">Open community</span>
              <h1>YOWLMAFFIA</h1>
              <p>Een publieke omgeving om te praten, delen en samen muziek te volgen.</p>
            </div>
          </div>

        </header>

        <div className="public-page__grid">
          <InfoBlock
            eyebrow="Info"
            title={infoBlock.title}
            body={infoBlock.body}
          />
          <InfoBlock
            eyebrow="Regels"
            title={rulesBlock.title}
            body={rulesBlock.body}
          />
        </div>

        <section className="panel public-page__auth">
          <div className="panel__header panel__header--compact">
            <span className="eyebrow">{view === 'register' ? 'Registreren' : 'Inloggen'}</span>
            <h2>{view === 'register' ? 'Nieuw account' : 'Toegang tot de public chat'}</h2>
            <button className="button button--ghost button--small" type="button" onClick={() => setView(view === 'register' ? 'login' : 'register')}>
              <ArrowRight size={16} />
              {view === 'register' ? 'Naar inloggen' : 'Naar registreren'}
            </button>
          </div>

          {!isPublicChatSupabaseConfigured ? (
            <div className="empty-state empty-state--compact">
              <strong>Public Supabase staat nog niet klaar.</strong>
              <p>Koppel eerst je public project zodat inloggen en registreren online kunnen draaien.</p>
            </div>
          ) : null}

          {view === 'register' ? (
            <form className="public-auth-form" onSubmit={handleRegisterSubmit}>
              <div className="public-auth-form__split">
                <label className="field">
                  <span>Naam</span>
                  <input className="input" value={registerUsername} onChange={(event) => setRegisterUsername(event.target.value)} placeholder="Gebruikersnaam" required />
                </label>
                <label className="field">
                  <span>E-mailadres</span>
                  <input className="input" type="email" value={registerEmail} onChange={(event) => setRegisterEmail(event.target.value)} placeholder="jij@mail.com" required />
                </label>
              </div>

              <div className="public-auth-form__split">
                <label className="field">
                  <span>Geboortedatum</span>
                  <input className="input" type="date" value={registerBirthDate} onChange={(event) => setRegisterBirthDate(event.target.value)} required />
                </label>
                <label className="field">
                  <span>Wachtwoord</span>
                  <input className="input input--password" type="password" value={registerPassword} onChange={(event) => setRegisterPassword(event.target.value)} placeholder="••••••••" required />
                </label>
              </div>

              <label className="field">
                <span>Herhaal wachtwoord</span>
                <input className="input input--password" type="password" value={registerConfirmPassword} onChange={(event) => setRegisterConfirmPassword(event.target.value)} placeholder="••••••••" required />
              </label>

              <button className="button button--primary button--full" type="submit" disabled={busy}>
                {busy ? 'Account maken...' : 'Account aanmaken'}
              </button>
            </form>
          ) : (
            <form className="public-auth-form" onSubmit={handleLoginSubmit}>
              {loginStage === 'otp' ? (
                <div className="public-auth-form__forgot">
                  <p className="muted-copy">{loginHint || `We hebben een inlogcode gestuurd naar ${maskEmail(loginEmail)}.`}</p>
                  <label className="field">
                    <span>Inlogcode</span>
                    <input
                      className="input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={loginCode}
                      onChange={(event) => setLoginCode(event.target.value)}
                      placeholder="Typ de code uit je e-mail"
                      required
                    />
                  </label>
                  <div className="login-form__actions login-reset__actions">
                    <button className="button button--ghost" type="button" disabled={busy} onClick={resetLoginFlow}>
                      Terug
                    </button>
                    <button className="button button--ghost" type="button" disabled={busy} onClick={() => void handleResendLoginCode()}>
                      <RefreshCw size={16} />
                      Code opnieuw sturen
                    </button>
                  </div>
                  <button className="button button--primary button--full" type="button" onClick={(event) => void handleVerifyLoginCode(event)} disabled={busy}>
                    {busy ? 'Verifiëren...' : 'Code verifiëren'}
                  </button>
                </div>
              ) : (
                <>
              <label className="field">
                <span>E-mail of username</span>
                <input className="input" value={loginIdentity} onChange={(event) => setLoginIdentity(event.target.value)} placeholder="Typ je e-mail of username" required />
              </label>

              <label className="field">
                <span>Wachtwoord</span>
                <input className="input input--password" type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} placeholder="••••••••" required />
              </label>

              {loginFailedAttempts >= 3 ? (
                <button className="button button--secondary button--full" type="button" onClick={() => setForgotOpen((value) => !value)}>
                  <RefreshCw size={16} />
                  Wachtwoord vergeten?
                </button>
              ) : null}

              {forgotOpen ? (
                <div className="public-auth-form__forgot">
                  <p className="muted-copy">Vul je e-mailadres in en we sturen een resetlink naar je public account.</p>
                  <label className="field">
                    <span>E-mailadres</span>
                    <input className="input" type="email" value={forgotEmail} onChange={(event) => setForgotEmail(event.target.value)} placeholder="jouw@mailadres.be" required />
                  </label>
                  <div className="login-form__actions login-reset__actions">
                    <button className="button button--ghost" type="button" disabled={forgotBusy} onClick={() => setForgotOpen(false)}>
                      Terug
                    </button>
                    <button className="button button--primary" type="button" onClick={() => void handleForgotSubmit()} disabled={forgotBusy}>
                      {forgotBusy ? 'Versturen...' : 'Stuur resetmail'}
                    </button>
                  </div>
                </div>
              ) : null}

              <button className="button button--primary button--full" type="submit" disabled={busy}>
                {busy ? 'Inloggen...' : 'Inloggen'}
              </button>
                </>
              )}
            </form>
          )}

          {message ? <p className="form-hint">{message}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          {forgotMessage ? <p className="form-hint">{forgotMessage}</p> : null}
          {forgotError ? <p className="form-error">{forgotError}</p> : null}
        </section>

      </div>
    </section>
  );
}
