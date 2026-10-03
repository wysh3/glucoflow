import * as React from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * Lucide Animated icons from the documented package (lucide-animated).
 *
 * An animated icon plays once, after its associated interaction, for 120-200 ms
 * where the icon supports configuration. Reduced motion is respected and clinical
 * values are never animated.
 */
export type AnimatedIconHandle = {
  startAnimation: () => void;
  stopAnimation: () => void;
};

export function useAnimatedIcon(durationMs = 180): {
  ref: React.RefObject<AnimatedIconHandle | null>;
  play: () => void;
} {
  const ref = React.useRef<AnimatedIconHandle | null>(null);
  const reducedMotion = useReducedMotion();

  const play = React.useCallback(() => {
    if (reducedMotion) return;
    const handle = ref.current;
    if (!handle) return;
    handle.startAnimation();
    window.setTimeout(() => handle.stopAnimation(), durationMs);
  }, [durationMs, reducedMotion]);

  return { ref, play };
}

export const ANIMATED_ICON_DURATION_MS = 180;
