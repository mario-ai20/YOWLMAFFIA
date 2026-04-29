import TrackCard from './TrackCard';

export default function TrackBrowser({ tracks = [], activeTrackId = null, onPlay }) {
  return (
    <div className="track-browser">
      {tracks.length ? (
        tracks.map((track) => <TrackCard key={track.id} track={track} active={track.id === activeTrackId} onPlay={onPlay} />)
      ) : (
        <div className="empty-state">
          <strong>Geen tracks gevonden</strong>
          <p>Upload een audiofile naar Supabase Storage of voeg een demo-track toe.</p>
        </div>
      )}
    </div>
  );
}
