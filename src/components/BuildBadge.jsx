export default function BuildBadge({ buildNumber = 'dev', className = '' } = {}) {
  return (
    <div className={`build-badge ${className}`.trim()} aria-label={`Buildnummer ${buildNumber}`}>
      <span>Build {buildNumber || 'dev'}</span>
    </div>
  );
}
