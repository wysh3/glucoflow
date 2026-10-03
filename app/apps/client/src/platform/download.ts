import { Capacitor } from '@capacitor/core';

/**
 * Opening a downloaded export or an original source.
 *
 * The server returns a short-lived authorized URL (60 seconds). The application
 * reauthorizes when a URL expires; no long-lived bearer link is stored anywhere.
 */

export async function openAuthorizedUrl(url: string, filename?: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    // The platform-appropriate action on Android is the system handler for the URL.
    window.open(url, '_system');
    return;
  }
  if (filename) {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noreferrer';
    anchor.click();
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Bytes upload to a signed, object-specific URL. Overwrite is disabled server-side. */
export async function uploadToSignedUrl(
  uploadUrl: string,
  method: 'PUT' | 'POST',
  bytes: Uint8Array,
  contentType: string,
  uploadToken?: string | null,
): Promise<void> {
  const url = new URL(uploadUrl);
  if (uploadToken && !url.searchParams.has('token')) url.searchParams.set('token', uploadToken);
  // x-upsert is a Supabase Storage header. The local signed endpoint refuses unknown
  // preflight headers, so it is only sent to a hosted storage host.
  const headers: Record<string, string> = { 'content-type': contentType };
  if (!url.hostname.startsWith('127.0.0.1') && url.hostname !== 'localhost') {
    headers['x-upsert'] = 'false';
  }
  const response = await fetch(url.toString(), {
    method,
    headers,
    body: new Blob([new Uint8Array(bytes)], { type: contentType }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`The upload did not complete (${response.status}). ${text.slice(0, 140)}`);
  }
}
