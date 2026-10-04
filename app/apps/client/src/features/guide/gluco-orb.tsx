import * as React from 'react';
export type GlucoMood =
  'idle' | 'listening' | 'thinking' | 'replying' | 'error';
/** Expressions reflect chat activity only, never a patient's clinical state. */
export function GlucoOrb({
  mood = 'idle',
  small = false,
}: {
  mood?: GlucoMood;
  small?: boolean;
}) {
  const face = React.useRef<SVGSVGElement>(null);
  return (
    <span
      className={`gluco-orb ${small ? 'gluco-orb-small' : ''}`}
      data-mood={mood}
      data-testid="gluco-face"
      aria-hidden="true"
      onPointerMove={(e) => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches)
          return;
        const box = e.currentTarget.getBoundingClientRect();
        face.current?.style.setProperty(
          '--look-x',
          `${Math.max(-3, Math.min(3, (e.clientX - box.x - box.width / 2) / 6))}px`,
        );
      }}
      onPointerLeave={() => face.current?.style.setProperty('--look-x', '0px')}
    >
      <span className="gluco-orbit" />
      <svg ref={face} className="gluco-face" viewBox="0 0 64 64" fill="none">
        <g
          className="gluco-eye-pair"
          stroke="#24594e"
          strokeWidth="4"
          strokeLinecap="round"
        >
          <path
            d={
              mood === 'replying'
                ? 'M21 29 Q24 24 27 29'
                : mood === 'error'
                  ? 'M21 26 L26 29'
                  : 'M23 26 V32'
            }
          />
          <path
            d={
              mood === 'replying'
                ? 'M37 29 Q40 24 43 29'
                : mood === 'error'
                  ? 'M38 29 L43 26'
                  : 'M41 26 V32'
            }
          />
        </g>
        <ellipse cx="17" cy="36" rx="4" ry="2" fill="#db9296" opacity=".45" />
        <ellipse cx="47" cy="36" rx="4" ry="2" fill="#db9296" opacity=".45" />
        {mood === 'thinking' ? (
          <circle cx="33" cy="39" r="2.5" fill="#24594e" />
        ) : (
          <path
            className="gluco-mouth"
            d={
              mood === 'error'
                ? 'M29 40 Q33 37 37 40'
                : mood === 'listening'
                  ? 'M29 39 Q33 42 37 39'
                  : 'M27 38 Q32 45 37 38'
            }
            stroke="#24594e"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </svg>
      {mood === 'thinking' ? (
        <span className="gluco-thinking-stars">
          <i />
          <i />
          <i />
        </span>
      ) : null}
    </span>
  );
}
