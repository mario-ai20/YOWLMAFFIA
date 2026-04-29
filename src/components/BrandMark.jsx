export default function BrandMark({ compact = false, stacked = false }) {
  return (
    <div className={`brand-mark ${compact ? 'is-compact' : ''} ${stacked ? 'is-stacked' : ''}`}>
      <img className="brand-mark__image" src="assets/yowl.jpg" alt="YOWLMAFFIA logo" />
      <div className="brand-mark__text">
        <strong>YOWLMAFFIA</strong>
        {!compact && <span>writers portal</span>}
      </div>
    </div>
  );
}
