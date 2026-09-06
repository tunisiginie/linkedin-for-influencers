"use client";

import { useEffect, useState } from "react";

/** Animates a number counting up from 0 to `value` via requestAnimationFrame.
 * Respects `prefers-reduced-motion` — nothing else in this project has had
 * to yet, since this is the first number that animates on load — by
 * rendering the final value immediately instead of animating to it.
 *
 * Takes `prefix`/`suffix` strings rather than a formatter function: this
 * renders from a Server Component page, and a function prop can't cross
 * that server/client boundary (React errors on it at request time, not at
 * typecheck time — worth remembering next time this looks temptingly
 * flexible). */
export function CountUp({
  value,
  durationMs = 1400,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  durationMs?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    // A reduced-motion preference collapses the animation to a single
    // frame rather than skipping it outright — every setState call below
    // happens inside the requestAnimationFrame callback (not synchronously
    // in the effect body), which is what react-hooks/set-state-in-effect
    // wants: an effect that subscribes to an external tick, not one that
    // computes and applies state directly.
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const effectiveDuration = prefersReducedMotion ? 0 : durationMs;

    let raf: number;
    const start = performance.now();
    function tick(now: number) {
      const progress = effectiveDuration === 0 ? 1 : Math.min(1, (now - start) / effectiveDuration);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.round(eased * value));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return (
    <span className={className}>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}
