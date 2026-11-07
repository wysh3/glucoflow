import { useEffect, useRef, type ReactElement } from 'react';
import { GROK_BODY_PATH, GROK_EYE_LOWER_LEFT_PATH, GROK_EYE_LOWER_RIGHT_PATH } from '../vendor/grok-orb/paths';

/** Original orb expression, with a small care cap and bounded pointer attention. */
export function LoadingOrb({ size = 30, animated = true }: { size?: number; animated?: boolean }): ReactElement {
  const orb = useRef<SVGSVGElement>(null);
  const gaze = useRef<SVGGElement>(null);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const reset = () => { if (gaze.current) gaze.current.style.transform = 'translate(0px, 0px)'; };
    const follow = (event: PointerEvent) => {
      if (motion.matches || event.pointerType === 'touch') return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = orb.current?.getBoundingClientRect();
        if (!bounds || !gaze.current || bounds.bottom < 0 || bounds.top > window.innerHeight) return;
        const x = Math.max(-19, Math.min(19, (event.clientX - bounds.left - bounds.width / 2) / 18));
        const y = Math.max(-13, Math.min(13, (event.clientY - bounds.top - bounds.height / 2) / 24));
        gaze.current.style.transform = `translate(${x}px, ${y}px)`;
      });
    };
    window.addEventListener('pointermove', follow, { passive: true });
    window.addEventListener('blur', reset);
    document.addEventListener('pointerleave', reset);
    motion.addEventListener('change', reset);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', follow);
      window.removeEventListener('blur', reset);
      document.removeEventListener('pointerleave', reset);
      motion.removeEventListener('change', reset);
    };
  }, []);
  return <svg ref={orb} className={`loading-orb${animated ? '' : ' loading-orb-still'}`} width={size} height={size} viewBox="-15 -34 260 280" aria-hidden="true" focusable="false">
    <g className="loading-orb-body">
      <path d={GROK_BODY_PATH} fill="#fff" stroke="#8c9691" strokeWidth="6" />
      <path d="M66 23 L74 -15 Q114 -29 154 -15 L162 23 Q114 13 66 23Z" fill="#e6f3ec" stroke="#54786c" strokeWidth="5" strokeLinejoin="round" />
      <path d="M114 -12 V10 M103 -1 H125" stroke="#3f7067" strokeWidth="5" strokeLinecap="round" />
      <g ref={gaze} className="loading-orb-gaze">
        <g className="loading-orb-eyes" fill="#292e2b">
          <path d={GROK_EYE_LOWER_LEFT_PATH} transform="translate(22 -8) rotate(-32 55 106)" />
          <path d={GROK_EYE_LOWER_RIGHT_PATH} transform="translate(42 -20) rotate(16 109 119)" />
        </g>
      </g>
    </g>
  </svg>;
}
