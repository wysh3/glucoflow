/** React Router accepts trailing slashes. Keep route-dependent UI on the same path. */
export function normalizePathname(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}
