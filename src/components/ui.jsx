export function AppCard({ children, className = "" }) {
  return <section className={`ch-card ${className}`}>{children}</section>;
}

export function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button className={`ch-button ch-button-primary ${className}`} {...props}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = "", ...props }) {
  return (
    <button className={`ch-button ch-button-secondary ${className}`} {...props}>
      {children}
    </button>
  );
}

export function StatusPill({ children, tone = "neutral", className = "" }) {
  return (
    <span className={`ch-pill ch-pill-${tone} ${className}`}>
      {children}
    </span>
  );
}

export function FormField({ label, hint, children, className = "" }) {
  return (
    <label className={`ch-field ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function ProgressDots({ steps, currentStep }) {
  return (
    <div className="ch-progress-dots" aria-label="Progrés">
      {Array.from({ length: steps }).map((_, index) => (
        <span
          key={index}
          className={index <= currentStep ? "is-active" : ""}
        />
      ))}
    </div>
  );
}
