import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const audioRef = useRef(null);
  const queueRef = useRef([]);
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(() => {
    const stored = Number(window.localStorage.getItem('yowlmaffia-volume'));
    return Number.isFinite(stored) && stored > 0 ? stored : 0.86;
  });

  const currentTrack = queue[currentIndex] || null;

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = volume;
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const handleDurationChange = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };

    const handleEnded = () => {
      goToNextTrack();
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handleError = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleDurationChange);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('error', handleError);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleDurationChange);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.volume = volume;
    window.localStorage.setItem('yowlmaffia-volume', String(volume));
  }, [volume]);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    const audio = audioRef.current;

    if (!currentTrack) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    if (audio.src !== currentTrack.url) {
      audio.src = currentTrack.url;
      audio.load();
      setCurrentTime(0);
    }

    if (isPlaying) {
      audio.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [currentTrack, isPlaying]);

  function playFromQueue(tracks, startIndex = 0, shouldPlay = true) {
    const normalizedQueue = Array.isArray(tracks) ? tracks.filter(Boolean) : [];
    queueRef.current = normalizedQueue;
    setQueue(normalizedQueue);
    setCurrentIndex(Math.min(Math.max(startIndex, 0), Math.max(normalizedQueue.length - 1, 0)));
    setIsPlaying(shouldPlay);
  }

  function playTrack(track, tracks = queue.length ? queue : [track]) {
    const nextQueue = Array.isArray(tracks) && tracks.length ? tracks : [track];
    const index = nextQueue.findIndex((item) => item.id === track.id || item.url === track.url);
    playFromQueue(nextQueue, index >= 0 ? index : 0, true);
  }

  function togglePlay() {
    if (!currentTrack && queue.length > 0) {
      setCurrentIndex(0);
      setIsPlaying(true);
      return;
    }

    if (!currentTrack) {
      return;
    }

    const nextValue = !isPlaying;
    setIsPlaying(nextValue);
    if (audioRef.current) {
      if (nextValue) {
        audioRef.current.play().catch(() => {
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }

  function goToNextTrack() {
    if (!queueRef.current.length) {
      setIsPlaying(false);
      return;
    }

    const nextIndex = currentIndex + 1 < queueRef.current.length ? currentIndex + 1 : 0;
    setCurrentIndex(nextIndex);
    setIsPlaying(true);
  }

  function goToPreviousTrack() {
    if (!queueRef.current.length) {
      return;
    }

    const nextIndex = currentIndex - 1 >= 0 ? currentIndex - 1 : queueRef.current.length - 1;
    setCurrentIndex(nextIndex);
    setIsPlaying(true);
  }

  function seekTo(value) {
    const nextTime = Number(value);
    if (!audioRef.current || !Number.isFinite(nextTime)) {
      return;
    }

    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function updateVolume(value) {
    const nextVolume = Math.min(1, Math.max(0, Number(value)));
    setVolumeState(Number.isFinite(nextVolume) ? nextVolume : 0.86);
  }

  const value = useMemo(
    () => ({
      audioRef,
      queue,
      currentIndex,
      currentTrack,
      isPlaying,
      currentTime,
      duration,
      volume,
      playTrack,
      playFromQueue,
      togglePlay,
      goToNextTrack,
      goToPreviousTrack,
      seekTo,
      setVolume: updateVolume
    }),
    [
      queue,
      currentIndex,
      currentTrack,
      isPlaying,
      currentTime,
      duration,
      volume,
      playTrack,
      playFromQueue,
      togglePlay,
      goToNextTrack,
      goToPreviousTrack,
      seekTo,
      updateVolume
    ]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer moet binnen PlayerProvider worden gebruikt.');
  }

  return context;
}
