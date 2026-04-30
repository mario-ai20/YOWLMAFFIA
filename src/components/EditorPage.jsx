import { useEffect, useRef, useState } from 'react';
import { CirclePlus, ImageUp, Music4, RefreshCw } from 'lucide-react';
import LyricsEditor from './LyricsEditor';
import SongInfoPanel from './SongInfoPanel';
import UserProfileDialog from './UserProfileDialog';
import { extractThemeFromImage } from '../utils/color';
import { applyThemeVariables, resetThemeVariables } from '../utils/theme';
import { createDefaultCoverDataUrl } from '../utils/defaultCover';
import { importYowlFile, exportYowlFile } from '../utils/yowl';
import { supabase } from '../utils/supabase';
import { normalizeSongStatus } from '../utils/songStatus';

function insertTextAtCursor(textarea, currentValue, insertText) {
  if (!textarea) {
    return `${currentValue}${insertText}`;
  }

  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const nextValue = `${currentValue.slice(0, start)}${insertText}${currentValue.slice(end)}`;
  const nextCursor = start + insertText.length;

  window.requestAnimationFrame(() => {
    textarea.selectionStart = nextCursor;
    textarea.selectionEnd = nextCursor;
    textarea.focus();
  });

  return nextValue;
}

function captureSelection(element) {
  if (!element) {
    return null;
  }

  return {
    start: element.selectionStart || 0,
    end: element.selectionEnd || 0
  };
}

function restoreSelection(element, selection) {
  if (!element || !selection) {
    return;
  }

  window.requestAnimationFrame(() => {
    try {
      element.selectionStart = selection.start;
      element.selectionEnd = selection.end;
      element.focus();
    } catch (error) {
      // Ignore selection restore issues during remote sync.
    }
  });
}

function getCollaboratorStatus(entry) {
  const now = Date.now();
  const typingAt = Number(entry?.typingAt || 0);
  const focusField = String(entry?.focusField || '').trim();

  if (focusField && typingAt && now - typingAt < 2200) {
    return focusField === 'lyrics' ? 'typing' : 'editing';
  }

  if (focusField) {
    return 'editing';
  }

  return 'online';
}

function resolvePresencePriority(status) {
  if (status === 'typing') {
    return 3;
  }

  if (status === 'editing') {
    return 2;
  }

  if (status === 'online') {
    return 1;
  }

  return 0;
}

function getSongSnapshot(song) {
  return {
    title: song?.title || '',
    lyrics: song?.lyrics || '',
    coverUrl: song?.cover_url || '',
    status: normalizeSongStatus(song?.status)
  };
}

export default function EditorPage({
  song,
  songs = [],
  currentUser,
  allowedUsers = [],
  savingState = 'Klaar',
  activeEditors = [],
  onSaveSong,
  onDeleteSong,
  onReloadSongs,
  onUploadAsset,
  onUploadTrack,
  onOpenSongPicker,
  onSongImported
}) {
  const [title, setTitle] = useState(song?.title || '');
  const [lyrics, setLyrics] = useState(song?.lyrics || '');
  const [coverUrl, setCoverUrl] = useState(song?.cover_url || '');
  const [status, setStatus] = useState(normalizeSongStatus(song?.status));
  const [isDirty, setIsDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [liveEditors, setLiveEditors] = useState(activeEditors || []);
  const [pendingInsert, setPendingInsert] = useState(null);
  const [collabMessage, setCollabMessage] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const textareaRef = useRef(null);
  const titleInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const mediaInputRef = useRef(null);
  const trackInputRef = useRef(null);
  const collaborationChannelRef = useRef(null);
  const broadcastTimerRef = useRef(null);
  const focusFieldRef = useRef(null);
  const isApplyingRemoteRef = useRef(false);
  const lastRemoteSyncRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const snapshot = getSongSnapshot(song);

    setTitle(snapshot.title);
    setLyrics(snapshot.lyrics);
    setCoverUrl(snapshot.coverUrl);
    setStatus(snapshot.status);
    setIsDirty(false);
    setBusy(false);
    setCollabMessage('');
    setSelectedProfile(null);
    lastRemoteSyncRef.current = Number(song?.updated_at ? new Date(song.updated_at).getTime() : Date.now()) || Date.now();

    async function syncTheme() {
      const nextTheme = await extractThemeFromImage(
        song?.cover_url || createDefaultCoverDataUrl(song?.title || 'YOWLMAFFIA'),
        song?.title || 'YOWLMAFFIA'
      );

      if (!cancelled) {
        applyThemeVariables(nextTheme);
      }
    }

    syncTheme();

    return () => {
      cancelled = true;
      resetThemeVariables();
    };
  }, [song?.id]);

  useEffect(() => {
    if (!song || isDirty || isApplyingRemoteRef.current) {
      return;
    }

    const snapshot = getSongSnapshot(song);
    setTitle(snapshot.title);
    setLyrics(snapshot.lyrics);
    setCoverUrl(snapshot.coverUrl);
    setStatus(snapshot.status);
    lastRemoteSyncRef.current = Number(song?.updated_at ? new Date(song.updated_at).getTime() : Date.now()) || Date.now();
    setSelectedProfile(null);
  }, [song?.updated_at, song?.title, song?.lyrics, song?.cover_url, song?.id, isDirty]);

  useEffect(() => {
    let cancelled = false;

    async function syncTheme() {
      const nextTheme = await extractThemeFromImage(
        coverUrl || song?.cover_url || createDefaultCoverDataUrl(title || song?.title || 'YOWLMAFFIA'),
        title || song?.title || 'YOWLMAFFIA'
      );

      if (!cancelled) {
        applyThemeVariables(nextTheme);
      }
    }

    syncTheme();

    return () => {
      cancelled = true;
    };
  }, [coverUrl, title, song?.id, song?.title, song?.cover_url]);

  useEffect(() => {
    if (!song) {
      setLiveEditors(activeEditors || []);
      return undefined;
    }

    if (!supabase) {
      setLiveEditors(
        currentUser
          ? [
              {
                id: currentUser.username,
                username: currentUser.username,
                name: currentUser.displayName || currentUser.username,
                status: 'online',
                avatar_url: currentUser.avatar_url || ''
              }
            ]
          : []
      );
      return undefined;
    }

    let cancelled = false;
    const channel = supabase.channel(`song-collab-${song.id}`);
    collaborationChannelRef.current = channel;

    const syncPresence = async (extra = {}) => {
      if (cancelled || !currentUser) {
        return;
      }

      await channel.track({
        id: currentUser.username,
        username: currentUser.username,
        name: currentUser.displayName,
        avatar_url: currentUser.avatar_url || '',
        email: currentUser.email,
        songId: song.id,
        focusField: focusFieldRef.current || null,
        typingAt: focusFieldRef.current ? Date.now() : null,
        updatedAt: Date.now(),
        ...extra
      });
    };

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const mergedEditors = new Map();

      Object.values(state)
        .flat()
        .forEach((entry) => {
          const username = String(entry.username || entry.id || entry.userId || entry.email || '').trim().toLowerCase();
          const fallbackId = entry.id || entry.username || entry.userId || entry.email || crypto.randomUUID();
          const key = username || String(fallbackId).toLowerCase();
          const status = getCollaboratorStatus(entry);
          const current = mergedEditors.get(key);

          if (!current || resolvePresencePriority(status) >= resolvePresencePriority(current.status)) {
            mergedEditors.set(key, {
              id: fallbackId,
              username: entry.username || entry.id || entry.userId || entry.email || '',
              name: entry.name || entry.displayName || entry.username || 'Onbekend',
              avatar_url: entry.avatar_url || '',
              status
            });
          }
        });

      setLiveEditors(Array.from(mergedEditors.values()));
    });

    channel.on('broadcast', { event: 'song-state' }, ({ payload }) => {
      if (!payload || payload.songId !== song.id || payload.sourceUsername === currentUser.username) {
        return;
      }

      const incomingStamp = Number(payload.updatedAt || Date.now());
      if (incomingStamp <= lastRemoteSyncRef.current) {
        return;
      }

      lastRemoteSyncRef.current = incomingStamp;
      isApplyingRemoteRef.current = true;
      setCollabMessage(`${payload.sourceName || 'Iemand anders'} werkt live mee`);

      const titleSelection = captureSelection(titleInputRef.current);
      const lyricsSelection = captureSelection(textareaRef.current);

      setTitle(typeof payload.title === 'string' ? payload.title : '');
      setLyrics(typeof payload.lyrics === 'string' ? payload.lyrics : '');
      setCoverUrl(typeof payload.coverUrl === 'string' ? payload.coverUrl : '');
      setIsDirty(false);
      setBusy(false);

      window.setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 0);

      if (focusFieldRef.current === 'title') {
        restoreSelection(titleInputRef.current, titleSelection);
      }

      if (focusFieldRef.current === 'lyrics') {
        restoreSelection(textareaRef.current, lyricsSelection);
      }

      syncPresence({ status: focusFieldRef.current ? 'typing' : 'online' }).catch((error) => {
        console.error(error);
      });
    });

    channel
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setCollabMessage('Realtime samenwerking actief');
          await syncPresence({ status: focusFieldRef.current ? 'typing' : 'online' });
        }
      });

    return () => {
      cancelled = true;
      if (broadcastTimerRef.current) {
        window.clearTimeout(broadcastTimerRef.current);
        broadcastTimerRef.current = null;
      }
      supabase.removeChannel(channel);
      if (collaborationChannelRef.current === channel) {
        collaborationChannelRef.current = null;
      }
    };
  }, [song?.id, currentUser?.username, currentUser?.displayName, currentUser?.email]);

  useEffect(() => {
    if (!song || !currentUser || !supabase || isApplyingRemoteRef.current) {
      return undefined;
    }

    if (broadcastTimerRef.current) {
      window.clearTimeout(broadcastTimerRef.current);
    }

    broadcastTimerRef.current = window.setTimeout(async () => {
      const channel = collaborationChannelRef.current;
      if (!channel) {
        return;
      }

      const updatedAt = Date.now();
      const payload = {
        songId: song.id,
        title,
        lyrics,
        coverUrl,
        status,
        sourceUsername: currentUser.username,
        sourceName: currentUser.displayName,
        sourceAvatarUrl: currentUser.avatar_url || '',
        focusField: focusFieldRef.current || null,
        typingAt: focusFieldRef.current ? updatedAt : null,
        updatedAt
      };

      lastRemoteSyncRef.current = Math.max(lastRemoteSyncRef.current, updatedAt);

      try {
        await channel.send({
          type: 'broadcast',
          event: 'song-state',
          payload
        });

        await channel.track({
          id: currentUser.username,
          username: currentUser.username,
          name: currentUser.displayName,
          email: currentUser.email,
          songId: song.id,
          focusField: focusFieldRef.current || null,
          typingAt: focusFieldRef.current ? updatedAt : null,
          updatedAt
        });

        setCollabMessage(focusFieldRef.current ? 'Wijzigingen worden live gedeeld' : 'Realtime gesynchroniseerd');
      } catch (error) {
        console.error(error);
      }
    }, 160);

    return () => {
      if (broadcastTimerRef.current) {
        window.clearTimeout(broadcastTimerRef.current);
        broadcastTimerRef.current = null;
      }
    };
  }, [song?.id, title, lyrics, coverUrl, status, currentUser?.username, currentUser?.displayName, currentUser?.email]);

  useEffect(() => {
    if (!song || !isDirty || !supabase) {
      return undefined;
    }

    const timeout = window.setTimeout(async () => {
      setBusy(true);
      try {
        await onSaveSong(song.id, {
          title,
          lyrics,
          cover_url: coverUrl || '',
          status,
          last_edited_by: currentUser?.displayName || 'Onbekend'
        });
        setIsDirty(false);
      } finally {
        setBusy(false);
      }
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [song?.id, title, lyrics, coverUrl, status, isDirty, currentUser, onSaveSong]);

  useEffect(() => {
    if (!pendingInsert) {
      return;
    }

    setLyrics((current) => insertTextAtCursor(textareaRef.current, current, pendingInsert));
    setIsDirty(true);
    setPendingInsert(null);
  }, [pendingInsert]);

  if (!song) {
    return (
      <div className="empty-state">
        <strong>Kies een song om te bewerken</strong>
        <p>Ga terug naar het dashboard of maak een nieuw nummer aan.</p>
        <button className="button button--primary" type="button" onClick={onOpenSongPicker}>
          <CirclePlus size={16} />
          Song kiezen
        </button>
      </div>
    );
  }

  async function handleExport() {
    await exportYowlFile({
      title,
      lyrics,
      coverUrl,
      status,
      songId: song.id,
      author: currentUser?.displayName || 'Onbekend'
    });
  }

  async function handleImport() {
    const result = await importYowlFile();
    if (result?.canceled || !result?.payload) {
      return;
    }

    const payload = result.payload;
    if (payload.title) {
      setTitle(payload.title);
    }
    if (payload.lyrics) {
      setLyrics(payload.lyrics);
    }
    if (payload.coverUrl) {
      setCoverUrl(payload.coverUrl);
    }
    if (payload.status) {
      setStatus(normalizeSongStatus(payload.status));
    }

    setIsDirty(true);
    onSongImported?.(payload);
  }

  async function handleAssetUpload(file, mode = 'media') {
    if (!file) {
      return;
    }

    setBusy(true);
    try {
      const uploaded = await onUploadAsset(file, mode, song);
      if (!uploaded?.url) {
        return;
      }

      if (file.type.startsWith('image/')) {
        setCoverUrl(uploaded.url);
      } else {
        const embed = file.type.startsWith('video/')
          ? `\n\n[Video: ${file.name}](${uploaded.url})\n`
          : `\n\n[Audio: ${file.name}](${uploaded.url})\n`;
        setPendingInsert(embed);
      }

      setIsDirty(true);
    } finally {
      setBusy(false);
    }
  }

  async function handleTrackUpload(file) {
    if (!file) {
      return;
    }

    setBusy(true);
    try {
      await onUploadTrack(file, song);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="editor-page">
      <div className="page-title">
        <div>
          <span className="eyebrow">Editor</span>
          <h1>{title || song.title}</h1>
          <p>Schrijf de song hier, werk realtime samen en bewaar alles als een versleuteld .yowl-bestand.</p>
        </div>

        <div className="page-title__actions">
          <button className="button button--secondary" type="button" onClick={onReloadSongs}>
            <RefreshCw size={16} />
            Songs herladen
          </button>
          <button className="button button--secondary" type="button" onClick={handleImport}>
            <Music4 size={16} />
            Open .yowl
          </button>
          <button className="button button--primary" type="button" onClick={handleExport}>
            <ImageUp size={16} />
            Sla op als .yowl
          </button>
        </div>
      </div>

      <div className="editor-page__layout">
        <SongInfoPanel
          song={{
            ...song,
            title,
            cover_url: coverUrl || song.cover_url,
            status
          }}
          title={title}
          titleInputRef={titleInputRef}
          onTitleChange={(nextTitle) => {
            setTitle(nextTitle);
            setIsDirty(true);
          }}
          onTitleFocus={() => {
            focusFieldRef.current = 'title';
            collaborationChannelRef.current?.track({
          id: currentUser?.username,
          username: currentUser?.username,
          name: currentUser?.displayName,
          avatar_url: currentUser?.avatar_url || '',
          email: currentUser?.email,
          songId: song.id,
              focusField: 'title',
              typingAt: Date.now(),
              updatedAt: Date.now()
            });
          }}
          onTitleBlur={() => {
            if (focusFieldRef.current === 'title') {
              focusFieldRef.current = null;
            }
            collaborationChannelRef.current?.track({
          id: currentUser?.username,
          username: currentUser?.username,
          name: currentUser?.displayName,
          avatar_url: currentUser?.avatar_url || '',
          email: currentUser?.email,
          songId: song.id,
              focusField: null,
              typingAt: null,
              updatedAt: Date.now()
            });
          }}
          onExport={handleExport}
          onImport={handleImport}
          onUploadCover={() => coverInputRef.current?.click()}
          onUploadMedia={() => mediaInputRef.current?.click()}
          onUploadTrack={() => trackInputRef.current?.click()}
          onStatusChange={(nextStatus) => {
            setStatus(normalizeSongStatus(nextStatus));
            setIsDirty(true);
          }}
          onClearLyrics={() => {
            setLyrics('');
            setIsDirty(true);
          }}
          onOpenProfile={(profileUser) => setSelectedProfile(profileUser)}
          savingState={busy ? 'Bezig...' : isDirty ? 'Wijzigingen klaar om op te slaan' : savingState}
          activeEditors={liveEditors}
          allowedUsers={allowedUsers}
          collabMessage={collabMessage}
          onDeleteSong={async () => {
            const confirmDelete = window.confirm(`Weet je zeker dat je "${song.title || title || 'dit nummer'}" volledig wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.`);

            if (!confirmDelete) {
              return;
            }

            setBusy(true);
            try {
              await onDeleteSong?.(song.id);
            } finally {
              setBusy(false);
            }
          }}
        />

        <LyricsEditor
          value={lyrics}
          onChange={(nextLyrics) => {
            setLyrics(nextLyrics);
            setIsDirty(true);
          }}
          placeholder="Schrijf hier de lyrics..."
          disabled={busy}
          ref={textareaRef}
          onFocus={() => {
            focusFieldRef.current = 'lyrics';
            collaborationChannelRef.current?.track({
          id: currentUser?.username,
          username: currentUser?.username,
          name: currentUser?.displayName,
          avatar_url: currentUser?.avatar_url || '',
          email: currentUser?.email,
          songId: song.id,
              focusField: 'lyrics',
              typingAt: Date.now(),
              updatedAt: Date.now()
            });
          }}
          onBlur={() => {
            if (focusFieldRef.current === 'lyrics') {
              focusFieldRef.current = null;
            }
            collaborationChannelRef.current?.track({
          id: currentUser?.username,
          username: currentUser?.username,
          name: currentUser?.displayName,
          avatar_url: currentUser?.avatar_url || '',
          email: currentUser?.email,
          songId: song.id,
              focusField: null,
              typingAt: null,
              updatedAt: Date.now()
            });
          }}
        />
      </div>

      <UserProfileDialog
        open={Boolean(selectedProfile)}
        user={selectedProfile}
        onlineUsernames={liveEditors.filter((editor) => editor.status !== 'offline').map((editor) => editor.username)}
        onClose={() => setSelectedProfile(null)}
      />

      <input
        ref={coverInputRef}
        hidden
        type="file"
        accept="image/*"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) {
            await handleAssetUpload(file, 'cover');
          }
        }}
      />
      <input
        ref={mediaInputRef}
        hidden
        type="file"
        accept="image/*,video/*"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) {
            await handleAssetUpload(file, 'media');
          }
        }}
      />
      <input
        ref={trackInputRef}
        hidden
        type="file"
        accept="audio/*,video/mp4"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) {
            await handleTrackUpload(file);
          }
        }}
      />
    </section>
  );
}
