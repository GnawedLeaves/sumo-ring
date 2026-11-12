/** Pulsing red dot shown while a bout is live. Text is for screen readers only; the pulse respects reduced motion. */
export function LiveIndicator() {
  return (
    <span className="relative inline-flex h-3 w-3 shrink-0" role="status" title="Live">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson-spotlight opacity-75 motion-reduce:hidden" aria-hidden />
      <span className="relative inline-flex h-3 w-3 rounded-full bg-crimson-spotlight" aria-hidden />
      <span className="sr-only">Live</span>
    </span>
  );
}
