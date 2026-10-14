export default function InlineProgressSummary({
  answeredCount,
  totalCount,
  label = "famílies han respost",
  detailText = "",
}) {
  const progress =
    totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  return (
    <div className="inline-progress-summary">
      <p className="inline-progress-copy">
        <strong>{answeredCount}/{totalCount}</strong> {label}
      </p>

      <div className="inline-progress-track">
        <div
          className="inline-progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      {detailText && (
        <p className="inline-progress-detail">{detailText}</p>
      )}
    </div>
  );
}
