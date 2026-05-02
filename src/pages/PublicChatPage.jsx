import { ArrowRight, CornerUpLeft, Edit3, MessageSquarePlus, RefreshCw, Send, Trash2, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import PublicShell from '../components/PublicShell';
import PublicUserProfileDialog from '../components/PublicUserProfileDialog';
import UserAvatar from '../components/UserAvatar';
import { publicChatSupabase, isPublicChatSupabaseConfigured } from '../utils/supabase';
import {
  DEFAULT_PUBLIC_USERS,
  findPublicAllowedUser,
  loadPublicAllowedUsers,
  normalizePublicUsername,
  resolvePublicPresenceLabel,
  resolvePublicUserAvatar,
  resolvePublicUserDisplayName,
  resolvePublicUserFromSession
} from '../utils/publicUsers';
import { formatRelativeTime } from '../utils/dates';

export default function PublicChatPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [allowedUsers, setAllowedUsers] = useState(DEFAULT_PUBLIC_USERS);
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [replyingMessage, setReplyingMessage] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState('');
  const [editingDraft, setEditingDraft] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const listRef = useRef(null);

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

  const onlinePeople = useMemo(() => {
    return allowedUsers.filter((user) => resolvePublicPresenceLabel(user, nowTick) === 'online');
  }, [allowedUsers, nowTick]);

  const offlinePeople = useMemo(() => {
    return allowedUsers.filter((user) => resolvePublicPresenceLabel(user, nowTick) === 'offline');
  }, [allowedUsers, nowTick]);

  useEffect(() => {
    if (!publicChatSupabase || !currentUser) {
      setMessages([]);
      setMessagesLoading(false);
      return undefined;
    }

    let cancelled = false;

    async function loadMessages() {
      setMessagesLoading(true);
      const { data, error } = await publicChatSupabase
        .from('messages')
        .select('*')
        .eq('room_key', 'public')
        .order('created_at', { ascending: true });

      if (!cancelled) {
        if (error) {
          console.error(error);
          setMessages([]);
        } else {
          setMessages(data || []);
        }
        setMessagesLoading(false);
      }
    }

    loadMessages();

    const channel = publicChatSupabase
      .channel('public-chat-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: 'room_key=eq.public' }, loadMessages)
      .subscribe();

    return () => {
      cancelled = true;
      publicChatSupabase.removeChannel(channel);
    };
  }, [currentUser]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setReplyingMessage(null);
    setEditingMessageId('');
    setEditingDraft('');
    setSelectedProfile(null);
  }, [currentUser?.username]);

  async function reloadMessages() {
    if (!publicChatSupabase || !currentUser) {
      return;
    }

    const { data, error } = await publicChatSupabase
      .from('messages')
      .select('*')
      .eq('room_key', 'public')
      .order('created_at', { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setMessages(data || []);
  }

  function openProfile(user) {
    setSelectedProfile(user);
  }

  function startReplyMessage(message) {
    setReplyingMessage({
      id: message.id,
      sender: message.sender || '',
      body: message.body || '',
      created_at: message.created_at || ''
    });
    setEditingMessageId('');
    setEditingDraft('');
    setChatError('');
  }

  function cancelReplyMessage() {
    setReplyingMessage(null);
  }

  function startEditMessage(message) {
    setEditingMessageId(message.id);
    setEditingDraft(message.body || '');
    setReplyingMessage(null);
    setChatError('');
  }

  function cancelEditMessage() {
    setEditingMessageId('');
    setEditingDraft('');
  }

  async function handleSendMessage(event) {
    event.preventDefault();

    if (!publicChatSupabase || !currentUser) {
      return;
    }

    const nextBody = draft.trim();
    if (!nextBody) {
      return;
    }

    setSending(true);
    setChatError('');

    try {
      const senderName = currentUser.displayName || currentUser.username || 'Onbekend';
      const payload = {
        scope: 'public',
        room_key: 'public',
        sender: senderName,
        recipient: null,
        body: nextBody,
        reply_to_message_id: replyingMessage?.id || null,
        reply_to_sender: replyingMessage?.sender || null,
        reply_to_body: replyingMessage?.body || null,
        reply_to_created_at: replyingMessage?.created_at || null
      };

      const { error } = await publicChatSupabase.from('messages').insert(payload);
      if (error) {
        throw error;
      }

      const nextOnlineAt = new Date().toISOString();
      await publicChatSupabase
        .from('allowed_users')
        .update({ last_online_at: nextOnlineAt, updated_at: nextOnlineAt })
        .eq('username', currentUser.username);

      setDraft('');
      cancelReplyMessage();
      await reloadMessages();
    } catch (error) {
      console.error(error);
      setChatError(error instanceof Error ? error.message : 'Bericht versturen mislukt.');
    } finally {
      setSending(false);
    }
  }

  async function handleSaveEditedMessage(message) {
    if (!publicChatSupabase || !currentUser) {
      return;
    }

    const nextBody = editingDraft.trim();
    if (!nextBody) {
      setChatError('Bericht mag niet leeg zijn.');
      return;
    }

    try {
      const { error } = await publicChatSupabase.from('messages').update({ body: nextBody }).eq('id', message.id);
      if (error) {
        throw error;
      }

      cancelEditMessage();
      await reloadMessages();
    } catch (error) {
      console.error(error);
      setChatError(error instanceof Error ? error.message : 'Bericht bijwerken mislukt.');
    }
  }

  async function handleDeleteMessage(message) {
    const confirmed = typeof window !== 'undefined' ? window.confirm('Weet je zeker dat je dit bericht wilt verwijderen?') : false;
    if (!confirmed || !publicChatSupabase || !currentUser) {
      return;
    }

    try {
      const { error } = await publicChatSupabase.from('messages').delete().eq('id', message.id);
      if (error) {
        throw error;
      }

      if (editingMessageId === message.id) {
        cancelEditMessage();
      }

      await reloadMessages();
    } catch (error) {
      console.error(error);
      setChatError(error instanceof Error ? error.message : 'Bericht verwijderen mislukt.');
    }
  }

  async function handleSignOut() {
    if (!publicChatSupabase) {
      navigate('/');
      return;
    }

    await publicChatSupabase.auth.signOut();
    navigate('/');
  }

  const statusText = onlinePeople.length ? `${onlinePeople.length} online` : 'Alles bijgewerkt';

  if (loadingAuth) {
    return (
      <section className="public-page">
        <div className="public-page__shell">
          <div className="empty-state empty-state--compact">
            <strong>Public chat laden...</strong>
            <p>We openen de publieke omgeving veilig.</p>
          </div>
        </div>
      </section>
    );
  }

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <PublicShell user={currentUser} onSignOut={handleSignOut} statusText={statusText}>
      <section className="public-chat">
        <div className="public-chat__layout">
          <div className="panel public-chat__main">
            <div className="panel__header panel__header--compact public-chat__header">
              <div>
                <span className="eyebrow">Public chat</span>
                <h2>Chat met de community</h2>
              </div>
              <button className="button button--ghost button--compact" type="button" onClick={() => void reloadMessages()}>
                <RefreshCw size={16} />
                Herladen
              </button>
            </div>

            <div className="public-chat__messages" ref={listRef}>
              {messagesLoading ? (
                <div className="empty-state empty-state--compact">
                  <strong>Berichten laden...</strong>
                  <p>We halen de publieke chat uit Supabase.</p>
                </div>
              ) : messages.length ? (
                messages.map((message) => {
                  const senderUser = findPublicAllowedUser(message.sender, allowedUsers) || null;
                  const isOwnMessage =
                    normalizePublicUsername(message.sender) === normalizePublicUsername(currentUser.username)
                    || normalizePublicUsername(message.sender) === normalizePublicUsername(currentUser.displayName);
                  const replySource = message.reply_to_sender || '';

                  return (
                    <article key={message.id} className={`public-chat__message ${isOwnMessage ? 'is-own' : ''}`}>
                      <button className="public-chat__message-avatar" type="button" onClick={() => openProfile(senderUser || currentUser)}>
                        <UserAvatar user={senderUser || currentUser} name={message.sender} size={40} showDot />
                      </button>

                      <div className="public-chat__message-body">
                        <div className="public-chat__message-meta">
                          <button className="public-chat__message-name" type="button" onClick={() => openProfile(senderUser || currentUser)}>
                            {resolvePublicUserDisplayName(message.sender, allowedUsers) || message.sender || 'Onbekend'}
                          </button>
                          <span className="public-chat__message-time">
                            {message.created_at ? formatRelativeTime(message.created_at, nowTick) : 'zojuist'}
                          </span>
                        </div>

                        {replySource ? (
                          <div className="public-chat__reply-preview">
                            <span>Antwoord op {replySource}</span>
                            <p>{message.reply_to_body || 'Verwijderd bericht'}</p>
                          </div>
                        ) : null}

                        {editingMessageId === message.id ? (
                          <div className="public-chat__edit">
                            <textarea
                              className="input public-chat__textarea"
                              rows={3}
                              value={editingDraft}
                              onChange={(event) => setEditingDraft(event.target.value)}
                            />
                            <div className="public-chat__actions">
                              <button className="button button--ghost button--compact" type="button" onClick={cancelEditMessage}>
                                Annuleren
                              </button>
                              <button className="button button--primary button--compact" type="button" onClick={() => void handleSaveEditedMessage(message)}>
                                Opslaan
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="public-chat__message-text">{message.body || 'Geen berichttekst.'}</p>
                        )}

                        <div className="public-chat__actions">
                          <button className="button button--ghost button--compact" type="button" onClick={() => startReplyMessage(message)}>
                            <CornerUpLeft size={16} />
                            Reageer
                          </button>

                          {isOwnMessage ? (
                            <>
                              <button className="button button--ghost button--compact" type="button" onClick={() => startEditMessage(message)}>
                                <Edit3 size={16} />
                                Bewerken
                              </button>
                              <button className="button button--danger button--compact" type="button" onClick={() => void handleDeleteMessage(message)}>
                                <Trash2 size={16} />
                                Verwijder
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="empty-state empty-state--compact">
                  <strong>Nog geen berichten</strong>
                  <p>Wees de eerste die iets in de public chat zet.</p>
                </div>
              )}
            </div>

            <form className="public-chat__composer" onSubmit={handleSendMessage}>
              {replyingMessage ? (
                <div className="public-chat__replying">
                  <span>Je antwoordt op {replyingMessage.sender || 'iemand'}</span>
                  <p>{replyingMessage.body || 'Verwijderd bericht'}</p>
                  <button className="button button--ghost button--compact" type="button" onClick={cancelReplyMessage}>
                    Annuleren
                  </button>
                </div>
              ) : null}

              <label className="field">
                <span>Bericht</span>
                <textarea
                  className="input public-chat__composer-input"
                  rows={4}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Typ hier je bericht..."
                />
              </label>

              <div className="public-chat__composer-actions">
                <button className="button button--secondary" type="button" onClick={() => navigate('/public/dashboard')}>
                  <ArrowRight size={16} />
                  Naar dashboard
                </button>
                <button className="button button--primary" type="submit" disabled={sending}>
                  <Send size={16} />
                  {sending ? 'Versturen...' : 'Bericht sturen'}
                </button>
              </div>

              {chatError ? <p className="form-error">{chatError}</p> : null}
            </form>
          </div>

          <aside className="panel public-chat__sidebar">
            <div className="panel__header panel__header--compact">
              <span className="eyebrow">Leden</span>
              <h2>Wie is er online?</h2>
            </div>

            <div className="public-chat__people">
              {onlinePeople.length ? (
                onlinePeople.map((user) => (
                  <button className="public-chat__person" type="button" key={user.username} onClick={() => openProfile(user)}>
                    <UserAvatar user={user} name={user.displayName || user.username} size={42} showDot />
                    <div>
                      <strong>{user.displayName || user.username}</strong>
                      <span>online</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="empty-state empty-state--compact">
                  <strong>Niemand online</strong>
                  <p>De online status wordt live bijgewerkt vanuit Supabase.</p>
                </div>
              )}
            </div>

            <div className="panel__header panel__header--compact public-chat__offline-heading">
              <span className="eyebrow">Offline</span>
              <h2>Wie is er offline?</h2>
            </div>

            <div className="public-chat__people">
              {offlinePeople.length ? (
                offlinePeople.map((user) => (
                  <button className="public-chat__person is-offline" type="button" key={user.username} onClick={() => openProfile(user)}>
                    <UserAvatar user={user} name={user.displayName || user.username} size={42} />
                    <div>
                      <strong>{user.displayName || user.username}</strong>
                      <span>{user.last_online_at ? `${formatRelativeTime(user.last_online_at, nowTick)} online` : 'offline'}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="empty-state empty-state--compact">
                  <strong>Iedereen online</strong>
                  <p>Er zijn momenteel geen offline leden.</p>
                </div>
              )}
            </div>
          </aside>
        </div>

        <PublicUserProfileDialog
          open={Boolean(selectedProfile)}
          user={selectedProfile}
          onClose={() => setSelectedProfile(null)}
          onStartMessage={(user) => {
            setReplyingMessage({
              id: `profile-${user.username}`,
              sender: user.displayName || user.username || '',
              body: '',
              created_at: ''
            });
            setSelectedProfile(null);
          }}
        />
      </section>
    </PublicShell>
  );
}
