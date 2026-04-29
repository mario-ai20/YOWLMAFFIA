import { forwardRef } from 'react';

const LyricsEditor = forwardRef(function LyricsEditor({ value, onChange, placeholder, onFocus, onBlur }, ref) {
  return (
    <div className="lyrics-editor panel">
      <div className="panel__header">
        <span className="eyebrow">Lyrics</span>
        <h2>Realtime editor</h2>
      </div>

      <textarea
        ref={ref}
        className="lyrics-editor__textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck="false"
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </div>
  );
});

export default LyricsEditor;
