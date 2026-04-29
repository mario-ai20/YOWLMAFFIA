import { Pause, Play, SkipBack, SkipForward, Volume2 } from 'lucide-react';
import { formatDuration } from '../utils/dates';
import { usePlayer } from './PlayerProvider';

export default function MiniPlayer() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    togglePlay,
    goToNextTrack,
    goToPreviousTrack,
    seekTo,
    setVolume
  } = usePlayer();

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <footer className="mini-player">
      {currentTrack ? (
        <>
          <div className="mini-player__track">
            <img src={currentTrack.coverUrl} alt={currentTrack.title} className="mini-player__cover" />
            <div>
              <span className="eyebrow">Nu aan het spelen</span>
              <strong>{currentTrack.title}</strong>
              <p>{currentTrack.name}</p>
            </div>
          </div>

          <div className="mini-player__controls">
            <button className="icon-button" type="button" onClick={goToPreviousTrack} aria-label="Vorige">
              <SkipBack size={17} />
            </button>
            <button className="play-button" type="button" onClick={togglePlay} aria-label={isPlaying ? 'Pauze' : 'Speel af'}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button className="icon-button" type="button" onClick={goToNextTrack} aria-label="Volgende">
              <SkipForward size={17} />
            </button>
          </div>

          <div className="mini-player__progress">
            <div className="mini-player__progress-line">
              <div className="mini-player__progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <input
              className="mini-player__range"
              type="range"
              min="0"
              max={Number.isFinite(duration) ? duration : 0}
              step="0.1"
              value={currentTime}
              onChange={(event) => seekTo(event.target.value)}
              aria-label="Voortgang"
            />
            <span className="mini-player__time">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </span>
          </div>

          <div className="mini-player__volume">
            <Volume2 size={16} />
            <input
              className="mini-player__range mini-player__range--volume"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(event) => setVolume(event.target.value)}
              aria-label="Volume"
            />
          </div>
        </>
      ) : (
        <div className="mini-player__empty">
          <strong>Geen track geselecteerd</strong>
          <span>Open de player of kies een track in je bibliotheek.</span>
        </div>
      )}
    </footer>
  );
}
