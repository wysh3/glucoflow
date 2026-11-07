let pendingPath: string | null = null;

/** Retain the request while the lazily loaded guide mounts, scoped to this page. */
export function requestGuideOpen(): void {
  pendingPath = window.location.pathname;
  window.dispatchEvent(new Event('gluco:open'));
}

export function consumeGuideOpen(): boolean {
  const matches = pendingPath === window.location.pathname;
  pendingPath = null;
  return matches;
}
