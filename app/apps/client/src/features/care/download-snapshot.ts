import { Capacitor, registerPlugin } from '@capacitor/core';

const CareSnapshot = registerPlugin<{
  save: (input: { filename: string; json: string }) => Promise<{ saved: boolean }>;
}>('CareSnapshot');

export async function downloadCareSnapshot(id: string, snapshot: unknown): Promise<boolean> {
  const filename = `glucoflow-synthetic-${id}-snapshot.json`;
  const json = JSON.stringify(snapshot, null, 2);
  if (Capacitor.getPlatform() === 'android') {
    const result = await CareSnapshot.save({ filename, json });
    return result.saved;
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
