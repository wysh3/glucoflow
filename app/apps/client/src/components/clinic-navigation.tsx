import type { ReactNode } from 'react';

/** Primary destinations live in the desktop rail / mobile bar, once per screen. */
export function ClinicNavigation({ children }: { children?: ReactNode }) {
  return children ? <div className="flex min-w-0 shrink-0 items-center justify-start gap-1 overflow-x-auto px-2 [scrollbar-width:none] sm:justify-end sm:px-4">{children}</div> : null;
}
