/**
 * Loading indicator: a spinning ring in the brand colour. The label is read by screen readers only;
 * `hint` adds visible text under the ring for slow loads that deserve an explanation.
 * Fades in after a short delay so fast loads never flash a spinner.
 */
export function Spinner({
  label = "Loading",
  hint,
  size = "md",
  className = "",
}: {
  label?: string;
  hint?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div role="status" className={`spinner-appear flex flex-col items-center justify-center gap-3 ${size === "md" ? "py-10" : "py-4"} ${className}`}>
      <span
        aria-hidden
        className={`animate-spin rounded-full border-brand border-t-transparent motion-reduce:animate-[spin_1.5s_linear_infinite] ${
          size === "md" ? "h-8 w-8 border-[3px]" : "h-5 w-5 border-2"
        }`}
      />
      <span className="sr-only">{label}</span>
      {hint && <span className="text-center text-caption text-ink-soft">{hint}</span>}
    </div>
  );
}
