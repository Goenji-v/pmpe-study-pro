type ProgressBarVariant =
  | "primary"
  | "success"
  | "warning"
  | "danger";

type ProgressBarProps = {
  value: number;
  max?: number;
  showLabel?: boolean;
  variant?: ProgressBarVariant;
};

export default function ProgressBar({
  value,
  max = 100,
  showLabel = false,
  variant = "primary",
}: ProgressBarProps) {
  const valorSeguro = Math.max(
    0,
    Math.min(value, max)
  );

  const percentual =
    max === 0
      ? 0
      : Math.round((valorSeguro / max) * 100);

  return (
    <div className="ui-progress-wrapper">
      {showLabel && (
        <div className="ui-progress-label">
          <span>Progresso</span>
          <strong>{percentual}%</strong>
        </div>
      )}

      <div className="ui-progress-track">
        <div
          className={`ui-progress-fill ui-progress-${variant}`}
          style={{
            width: `${percentual}%`,
          }}
        />
      </div>
    </div>
  );
}