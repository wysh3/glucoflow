import * as React from 'react';

/** Nine-dot system mark used as a quiet status ornament, never as content. */
export function SystemGlyph({ className = '' }: { className?: string }): React.ReactElement {
  return (
    <span className={`system-glyph ${className}`} aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => (
        <i key={index} style={{ animationDelay: `${index * 90}ms` }} />
      ))}
    </span>
  );
}
