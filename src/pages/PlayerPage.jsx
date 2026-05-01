import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, RefreshCw, Search, Upload } from 'lucide-react';
import { useNavigate } from 'react-router';
import MiniPlayer from '../components/MiniPlayer';
import TrackBrowser from '../components/TrackBrowser';
import { usePlayer } from '../components/PlayerProvider';
import { getDemoLibrary } from '../utils/demoMedia';

export default function PlayerPage({ tracks = [], loading = false, onUploadTrack, onRefreshTracks }) {
  const [query, setQuery] = useState('');
  const fileInputRef = useRef(null);
  const { playFromQueue, currentTrack } = usePlayer();
  const navigate = useNavigate();
  const displayedTracks = tracks.length ? tracks : getDemoLibrary();

  useEffect(() => {
    if (!tracks.length) {
      playFromQueue(getDemoLibrary(), 0, false);
    }
  }, [tracks, playFromQueue]);

  const filteredTracks = displayedTracks.filter((track) =>
    `${track.title} ${track.name}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <section className="player-page">
      <div className="page-title">
        <div>
          <span className="eyebrow">Player</span>
          <h1>Spotify-achtige bibliotheek</h1>
          <p>Zoek tracks, upload nieuwe media en speel alles hier af.</p>
        </div>

        <div className="page-title__actions">
          <button className="button button--secondary" type="button" onClick={() => navigate('/dashboard')}>
            Dashboard
          </button>
          <button className="button button--secondary" type="button" onClick={onRefreshTracks}>
            <RefreshCw size={16} />
            Herladen
          </button>
          <button className="button button--primary" type="button" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} />
            Upload track
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/mp4"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) {
                await onUploadTrack(file);
              }
            }}
          />
        </div>
      </div>

      <div className="player-page__search panel">
        <Search size={16} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek op tracknaam..." />
      </div>

      <div className="player-page__layout">
        <div className="panel player-page__library">
          <div className="panel__header">
            <span className="eyebrow">Tracks</span>
            <h2>{filteredTracks.length} items</h2>
          </div>

          {loading ? (
            <div className="empty-state">
              <strong>Bibliotheek laden...</strong>
              <p>We lezen Supabase Storage in.</p>
            </div>
          ) : (
            <TrackBrowser
              tracks={filteredTracks}
              activeTrackId={currentTrack?.id || null}
              onPlay={(track) => playFromQueue(filteredTracks, filteredTracks.findIndex((item) => item.id === track.id), true)}
            />
          )}
        </div>

        <aside className="player-page__sidebar panel">
          <div className="panel__header">
            <span className="eyebrow">Info</span>
            <h2>Live status</h2>
          </div>

          <div className="insight-card">
            <strong>Supabase Storage</strong>
            <p>Audio files komen rechtstreeks uit de cloud bucket.</p>
          </div>

          <div className="insight-card">
            <strong>Built-in demo songs</strong>
            <p>De mp4&apos;s van YOWLMAFFIA zitten standaard in de app als fallback en demo-materiaal.</p>
            <a href="demo-media/4AD.mp4" target="_blank" rel="noreferrer">
              Bekijk een track <ArrowUpRight size={14} />
            </a>
          </div>
        </aside>
      </div>

      <div className="player-page__dock">
        <MiniPlayer />
      </div>
    </section>
  );
}
