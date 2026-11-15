import * as React from 'react';

/**
 * A short CSS "pop" on an icon after its interaction (about 180 ms).
 * Uses no animation library, so it adds nothing to the first load.
 * Reduced motion is respected and clinical values are never animated.
 */
export type AnimatedIconHandle = SVGSVGElement;

export function useAnimatedIcon(durationMs = 180): {
  ref: React.RefObject<SVGSVGElement | null>;
  play: () => void;
} {
  const ref = React.useRef<SVGSVGElement | null>(null);
  const play = React.useCallback(() => {
    const node = ref.current;
    if (!node || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    node.removeAttribute('data-icon-pop');
    void node.getBoundingClientRect(); // restart the animation
    node.setAttribute('data-icon-pop', '');
    window.setTimeout(() => node.removeAttribute('data-icon-pop'), durationMs);
  }, [durationMs]);
  return { ref, play };
}

export const ANIMATED_ICON_DURATION_MS = 180;
