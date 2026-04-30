import { Check, CornerUpLeft, Edit3, MessageSquarePlus, Paperclip, RefreshCw, Send, Trash2, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import SetupNotice from '../components/SetupNotice';
import UserAvatar from '../components/UserAvatar';
import UserProfileDialog from '../components/UserProfileDialog';
import { supabase } from '../utils/supabase';
import { DEFAULT_ALLOWED_USERS, findAllowedUser, normalizeUsername } from '../utils/users';
import { getAttachmentPreview, getChatLabel, getChatRoomKey } from '../utils/chat';
import { formatRelativeTime } from '../utils/dates';

function resolvePresenceStatus(user, onlineUsernames = []) {
  const onlineSet = new Set((onlineUsernames || []).map((value) => normalizeUsername(value)));
  const username = normalizeUsername(user?.username);

  if (!username) {
    return 'offline';
  }

  return onlineSet.has(username) ? 'online' : 'offline';
}

function isMissingReplyColumnError(error) {
  const message = String(error?.message || error?.details || error?.hint || '').toLowerCase();
  return message.includes('reply_to_message_id')
    || message.includes('reply_to_sender')
    || message.includes('reply_to_body')
    || message.includes('reply_to_created_at')
    || message.includes('schema cache');
}

export default function ChatPage({
  currentUser,
  loading = false,
  allowedUsers = DEFAULT_ALLOWED_USERS,
  onlineUsernames = []
}) {
  if (!supabase) {
    return <SetupNotice />;
  }

  const [scope, setScope] = useState('team');
  const [peerUsername, setPeerUsername] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [chatError, setChatError] = useState('');
  const [editingMessageId, setEditingMessageId] = useState('');
  const [editingDraft, setEditingDraft] = useState('');
  const [editingBusy, setEditingBusy] = useState(false);
  const [replyingMessageId, setReplyingMessageId] = useState('');
  const [replyingMessage, setReplyingMessage] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [selectedProfile, setSelectedProfile] = useState(null);
  const fileInputRef = useRef(null);
  const listRef = useRef(null);

  const peers = useMemo(
    () => allowedUsers.filter((user) => normalizeUsername(user.username) !== normalizeUsername(currentUser?.username)),
    [allowedUsers, currentUser?.username]
  );
  const presenceSet = useMemo(
    () => new Set((onlineUsernames || []).map((value) => normalizeUsername(value))),
    [onlineUsernames]
  );
  const onlinePeople = useMemo(
    () => allowedUsers.filter((user) => presenceSet.has(normalizeUsername(user.username))),
    [allowedUsers, presenceSet]
  );
  const offlinePeople = useMemo(
    () => allowedUsers.filter((user) => !presenceSet.has(normalizeUsername(user.username))),
    [allowedUsers, presenceSet]
  );

  useEffect(() => {
    if (scope !== 'private') {
      return;
    }

    const currentPeerIsValid = peers.some((peer) => peer.username === peerUsername);
    if (!currentPeerIsValid) {
      setPeerUsername(peers[0]?.username || '');
    }
  }, [scope, peers, peerUsername]);

  useEffect(() => {
    if (scope === 'private' && !peerUsername && peers.length) {
      setPeerUsername(peers[0].username);
    }
  }, [scope, peerUsername, peers]);

  const roomKey = useMemo(() => getChatRoomKey(scope, currentUser, peerUsername), [scope, currentUser, peerUsername]);
  const roomLabel = getChatLabel(scope, currentUser, peerUsername);

  useEffect(() => {
    if (!currentUser || !supabase) {
      return;
    }

    let cancelled = false;
    let channel = null;

    async function loadMessages() {
      setRoomLoading(true);
      const query = supabase
        .from('messages')
        .select('*')
        .eq('scope', scope)
        .eq('room_key', roomKey)
        .order('created_at', { ascending: true });

      const { data, error } = await query;

      if (cancelled) {
        return;
      }

      if (error) {
        setMessages([]);
      } else {
        setMessages(data || []);
      }

      setRoomLoading(false);
    }

    loadMessages();

    channel = supabase
      .channel(`chat-${roomKey}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `room_key=eq.${roomKey}` }, () => loadMessages())
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [currentUser, roomKey, scope, refreshTick]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setEditingMessageId('');
    setEditingDraft('');
    setEditingBusy(false);
    setReplyingMessageId('');
    setReplyingMessage(null);
    setSelectedProfile(null);
  }, [roomKey]);

  function cancelEditMessage() {
    setEditingMessageId('');
    setEditingDraft('');
    setEditingBusy(false);
  }

  function startEditMessage(message) {
    setEditingMessageId(message.id);
    setEditingDraft(message.body || '');
    setChatError('');
  }

  function startReplyMessage(message) {
    setReplyingMessageId(message.id);
    setReplyingMessage({
      id: message.id,
      sender: message.sender || '',
      body: message.body || '',
      created_at: message.created_at || '',
      attachment_url: message.attachment_url || '',
      attachment_type: message.attachment_type || ''
    });
    setChatError('');
  }

  function cancelReplyMessage() {
    setReplyingMessageId('');
    setReplyingMessage(null);
  }

  function openProfile(user) {
    setSelectedProfile(user);
    setChatError('');
  }

  async function reloadCurrentMessages() {
    setRoomLoading(true);
    const refreshed = await supabase
      .from('messages')
      .select('*')
      .eq('scope', scope)
      .eq('room_key', roomKey)
      .order('created_at', { ascending: true });

    setMessages(refreshed.data || []);
    setRoomLoading(false);
  }

  async function handleSendMessage(event) {
    event.preventDefault();
    if (!draft.trim() && !attachment) {
      return;
    }

    if (scope === 'private' && !peerUsername) {
      return;
    }

    setSending(true);
    setChatError('');

    try {
      let attachmentUrl = null;
      let attachmentType = null;

      if (attachment) {
        const safeName = `${Date.now()}-${attachment.name.replaceAll(' ', '-').replace(/[^a-zA-Z0-9._-]/g, '')}`;
        const storagePath = `chat/${roomKey}/${safeName}`;
        const { error: uploadError } = await supabase.storage.from('media').upload(storagePath, attachment, {
          contentType: attachment.type,
          upsert: false
        });

        if (uploadError) {
          throw uploadError;
        }

        attachmentUrl = supabase.storage.from('media').getPublicUrl(storagePath).data.publicUrl;
        attachmentType = attachment.type || 'application/octet-stream';
      }

      const payload = {
        scope,
        room_key: roomKey,
        sender: currentUser.username || currentUser.displayName || '',
        recipient: scope === 'private' ? peerUsername : null,
        body: draft.trim() || (attachment ? attachment.name : ''),
        attachment_url: attachmentUrl,
        attachment_type: attachmentType,
        reply_to_message_id: replyingMessage?.id || null,
        reply_to_sender: replyingMessage?.sender || null,
        reply_to_body: replyingMessage?.body || null,
        reply_to_created_at: replyingMessage?.created_at || null
      };

      const { error } = await supabase.from('messages').insert(payload);
      if (error) {
        if (!isMissingReplyColumnError(error)) {
          throw error;
        }

        const fallbackPayload = {
          scope,
          room_key: roomKey,
          sender: currentUser.username || currentUser.displayName || '',
          recipient: scope === 'private' ? peerUsername : null,
          body: draft.trim() || (attachment ? attachment.name : ''),
          attachment_url: attachmentUrl,
          attachment_type: attachmentType
        };

        const fallback = await supabase.from('messages').insert(fallbackPayload);
        if (fallback.error) {
          throw fallback.error;
        }
      }

      setDraft('');
      setAttachment(null);
      cancelReplyMessage();
      await reloadCurrentMessages();
    } catch (error) {
      console.error(error);
      setChatError(error instanceof Error ? error.message : 'Bericht versturen mislukt.');
      setRoomLoading(false);
    } finally {
      setSending(false);
    }
  }

  async function handleSaveEditedMessage(message) {
    const nextBody = editingDraft.trim();
    if (!nextBody) {
      setChatError('Bericht mag niet leeg zijn.');
      return;
    }

    setEditingBusy(true);
    setChatError('');

    try {
      const { error } = await supabase.from('messages').update({ body: nextBody }).eq('id', message.id);
      if (error) {
        throw error;
      }

      cancelEditMessage();
      await reloadCurrentMessages();
    } catch (error) {
      console.error(error);
      setChatError(error instanceof Error ? error.message : 'Bericht bijwerken mislukt.');
      setRoomLoading(false);
    } finally {
      setEditingBusy(false);
    }
  }

  async function handleDeleteMessage(message) {
    const confirmed = typeof window !== 'undefined' ? window.confirm('Weet je zeker dat je dit bericht wilt verwijderen?') : false;
    if (!confirmed) {
      return;
    }

    setEditingBusy(true);
    setChatError('');

    try {
      const { error } = await supabase.from('messages').delete().eq('id', message.id);
      if (error) {
        throw error;
      }

      if (editingMessageId === message.id) {
        cancelEditMessage();
      }

      await reloadCurrentMessages();
    } catch (error) {
      console.error(error);
      setChatError(error instanceof Error ? error.message : 'Bericht verwijderen mislukt.');
      setRoomLoading(false);
    } finally {
      setEditingBusy(false);
    }
  }

  return (
    <section className="chat-page">
      <div className="page-title">
        <div>
          <span className="eyebrow">Chat</span>
          <h1>Team chat en privéberichten</h1>
          <p>Praat samen in de crew of stuur elkaar rechtstreeks berichten met foto&apos;s, filmpjes en audio.</p>
        </div>

        <div className="page-title__actions">
          <button className="button button--secondary" type="button" onClick={() => setRefreshTick((value) => value + 1)}>
            <RefreshCw size={16} />
            Vernieuwen
          </button>
        </div>
      </div>

      <div className="chat-page__tabs panel">
        <button className={`tab-button ${scope === 'team' ? 'is-active' : ''}`} type="button" onClick={() => setScope('team')}>
          <UsersRound size={16} />
          Team
        </button>
        <button className={`tab-button ${scope === 'private' ? 'is-active' : ''}`} type="button" onClick={() => setScope('private')}>
          <MessageSquarePlus size={16} />
          Privé
        </button>

        {scope === 'private' ? (
          <select className="input chat-page__peer" value={peerUsername} onChange={(event) => setPeerUsername(event.target.value)}>
            {peers.map((peer) => (
              <option key={peer.username} value={peer.username}>
                {peer.displayName || peer.username}
              </option>
            ))}
          </select>
        ) : null}

        <div className="chat-page__room">
          <strong>{roomLabel}</strong>
          <span>{messages.length} berichten</span>
        </div>
      </div>

      <div className="chat-page__layout">
        <div className="panel chat-page__thread">
          <div className="panel__header">
            <span className="eyebrow">Gesprek</span>
            <h2>{roomLabel}</h2>
          </div>

          <div className="chat-page__messages" ref={listRef}>
            {roomLoading || loading ? (
              <div className="empty-state">
                <strong>Berichten laden...</strong>
                <p>Realtime chat wordt opgehaald uit Supabase.</p>
              </div>
            ) : messages.length ? (
              messages.map((message) => {
                const senderUser = findAllowedUser(message.sender, allowedUsers);
                const isMine =
                  normalizeUsername(message.sender) === normalizeUsername(currentUser?.username) ||
                  normalizeUsername(message.sender) === normalizeUsername(currentUser?.displayName);
                const isEditing = editingMessageId === message.id;
                const isReplyTarget = replyingMessageId === message.id;
                const attachmentPreview = getAttachmentPreview(
                  message.attachment_url,
                  message.attachment_type,
                  message.body || 'attachment'
                );
                const senderLabel = senderUser?.displayName || senderUser?.username || message.sender;

                return (
                  <article key={message.id} className={`chat-bubble ${isMine ? 'is-mine' : ''}`}>
                    {message.reply_to_message_id ? (
                      <div className="chat-bubble__reply">
                        <span>Reageert op {message.reply_to_sender || 'een bericht'}</span>
                        <p>{message.reply_to_body || 'Oud bericht'}</p>
                      </div>
                    ) : null}

                    <div className="chat-bubble__meta">
                      <div className="chat-bubble__sender">
                        <button
                          className="chat-bubble__profile-trigger"
                          type="button"
                          onClick={() => senderUser && openProfile(senderUser)}
                          disabled={!senderUser}
                          aria-label={`Open profiel van ${senderLabel}`}
                        >
                          <UserAvatar user={senderUser} name={senderLabel} src={senderUser?.avatar_url || ''} size={30} />
                          <strong>{senderLabel}</strong>
                        </button>
                      </div>
                      <div className="chat-bubble__meta-right">
                        <span>{formatRelativeTime(message.created_at, nowTick)}</span>
                        <button
                          className="icon-button icon-button--small"
                          type="button"
                          onClick={() => startReplyMessage(message)}
                          disabled={editingBusy}
                          aria-label="Reageer op bericht"
                        >
                          <CornerUpLeft size={14} />
                        </button>
                        {isMine ? (
                          <div className="chat-bubble__actions">
                            <button
                              className="icon-button icon-button--small"
                              type="button"
                              onClick={() => startEditMessage(message)}
                              disabled={editingBusy}
                              aria-label="Bewerk bericht"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              className="icon-button icon-button--small icon-button--danger"
                              type="button"
                              onClick={() => handleDeleteMessage(message)}
                              disabled={editingBusy}
                              aria-label="Verwijder bericht"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="chat-bubble__editor">
                        <textarea
                          className="input chat-bubble__editor-input"
                          value={editingDraft}
                          onChange={(event) => setEditingDraft(event.target.value)}
                        />
                        <div className="chat-bubble__editor-actions">
                          <button
                            className="button button--secondary button--small"
                            type="button"
                            onClick={cancelEditMessage}
                            disabled={editingBusy}
                          >
                            Annuleer
                          </button>
                          <button
                            className="button button--primary button--small"
                            type="button"
                            onClick={() => handleSaveEditedMessage(message)}
                            disabled={editingBusy}
                          >
                            <Check size={14} />
                            Opslaan
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p>{message.body}</p>
                    )}

                    {attachmentPreview ? (
                      <div className="chat-bubble__attachment">
                        {attachmentPreview.kind === 'image' ? <img src={attachmentPreview.url} alt={message.body} /> : null}
                        {attachmentPreview.kind === 'video' ? <video src={attachmentPreview.url} controls playsInline /> : null}
                        {attachmentPreview.kind === 'audio' ? <audio src={attachmentPreview.url} controls /> : null}
                        {attachmentPreview.kind === 'file' ? (
                          <a href={attachmentPreview.url} target="_blank" rel="noreferrer">
                            Open bestand
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <div className="empty-state">
                <strong>Nog geen berichten</strong>
                <p>Stuur het eerste bericht om de chat te starten.</p>
              </div>
            )}
          </div>

          <form className="chat-page__composer" onSubmit={handleSendMessage}>
            {replyingMessage ? (
              <div className="chat-page__replying">
                <div>
                  <strong>Reageren op {replyingMessage.sender || 'bericht'}</strong>
                  <p>{replyingMessage.body || 'Bericht zonder tekst'}</p>
                </div>
                <button className="button button--ghost button--small" type="button" onClick={cancelReplyMessage}>
                  Annuleer
                </button>
              </div>
            ) : null}
            <input
              className="input"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={scope === 'private' ? 'Typ je privébericht...' : 'Typ je teambericht...'}
            />
            <button className="icon-button" type="button" onClick={() => fileInputRef.current?.click()} aria-label="Bijlage">
              <Paperclip size={16} />
            </button>
            <button className="button button--primary" type="submit" disabled={sending || (scope === 'private' && !peerUsername)}>
              <Send size={16} />
              Versturen
            </button>
            <input
              ref={fileInputRef}
              hidden
              type="file"
              accept="image/*,video/*,audio/*"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setAttachment(file);
                event.target.value = '';
              }}
            />
          </form>

          {attachment ? <div className="chat-page__attachment-chip">Bijlage klaar: {attachment.name}</div> : null}
          {chatError ? <div className="form-error chat-page__error">{chatError}</div> : null}
        </div>

        <aside className="panel chat-page__sidebar">
          <div className="panel__header">
            <span className="eyebrow">Team</span>
          </div>

          <div className="chat-page__people">
            <div className="chat-page__presence-group">
              <div className="chat-page__presence-header">
                <strong>Wie is er online?</strong>
                <span>{onlinePeople.length}</span>
              </div>

              {onlinePeople.length ? (
                onlinePeople.map((user) => {
                  const presenceStatus = resolvePresenceStatus(user, onlineUsernames);

                  return (
                    <button
                      key={user.username}
                      type="button"
                      className={`chat-person ${user.username === currentUser?.username ? 'is-self' : ''}`}
                      onClick={() => openProfile(user)}
                    >
                      <UserAvatar
                        user={user}
                        name={user.displayName || user.username}
                        src={user.avatar_url || ''}
                        size={42}
                        showDot
                      />
                      <div>
                        <strong>{user.displayName || user.username}</strong>
                        <span className={`chat-person__status chat-person__status--${presenceStatus}`}>{presenceStatus}</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="empty-state empty-state--compact">
                  <strong>Niemand online</strong>
                  <p>Open de app op een toestel om zichtbaar te worden.</p>
                </div>
              )}
            </div>

            <div className="chat-page__presence-group">
              <div className="chat-page__presence-header">
                <strong>Wie is er offline?</strong>
                <span>{offlinePeople.length}</span>
              </div>

              {offlinePeople.length ? (
                offlinePeople.map((user) => {
                  const presenceStatus = resolvePresenceStatus(user, onlineUsernames);

                  return (
                    <button
                      key={user.username}
                      type="button"
                      className={`chat-person ${user.username === currentUser?.username ? 'is-self' : ''}`}
                      onClick={() => openProfile(user)}
                    >
                      <UserAvatar
                        user={user}
                        name={user.displayName || user.username}
                        src={user.avatar_url || ''}
                        size={42}
                        showDot={false}
                      />
                      <div>
                        <strong>{user.displayName || user.username}</strong>
                        <span className={`chat-person__status chat-person__status--${presenceStatus}`}>{presenceStatus}</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="empty-state empty-state--compact">
                  <strong>Niemand offline</strong>
                  <p>Iedereen is momenteel verbonden.</p>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      <UserProfileDialog
        open={Boolean(selectedProfile)}
        user={selectedProfile}
        onlineUsernames={onlineUsernames}
        onClose={() => setSelectedProfile(null)}
        onStartPrivateMessage={(profileUser) => {
          setScope('private');
          setPeerUsername(profileUser.username);
          setSelectedProfile(null);
        }}
      />
    </section>
  );
}
