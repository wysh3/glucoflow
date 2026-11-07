import type { ReactNode } from 'react';

/** Primary destinations live in the desktop rail / mobile bar, once per screen. */
export function ClinicNavigation({ children }: { children?: ReactNode }) {
  return children ? <div className="flex shrink-0 items-center justify-end gap-1 px-2 sm:px-4">{children}</div> : null;
}
