export default function BrandMark({ compact = false, stacked = false, subtitle = 'writers portal' }) {
  return (
    <div className={`brand-mark ${compact ? 'is-compact' : ''} ${stacked ? 'is-stacked' : ''}`}>
      <img className="brand-mark__image" src="assets/yowl.jpg" alt="YOWLMAFFIA logo" />
      <div className="brand-mark__text">
        <strong>YOWLMAFFIA</strong>
        {!compact && subtitle?.trim() ? <span>{subtitle}</span> : null}
      </div>
    </div>
  );
}
