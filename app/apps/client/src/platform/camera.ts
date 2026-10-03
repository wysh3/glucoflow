import { Capacitor } from '@capacitor/core';

/**
 * Camera capture for report upload.
 *
 * A denied permission or a cancellation never blocks the workflow: the caller keeps
 * the file-upload path available and shows the reason. Release of camera temporary
 * files is left to the platform where its API allows it.
 */

export type CapturedPage = {
  filename: string;
  contentType: 'image/jpeg' | 'image/png';
  bytes: Uint8Array;
};

export type CaptureOutcome =
  | { status: 'captured'; pages: CapturedPage[] }
  | { status: 'cancelled' }
  | { status: 'denied'; message: string }
  | { status: 'unsupported'; message: string };

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** Cancellation returns an empty list through status 'cancelled'. */
export async function captureReport(): Promise<CaptureOutcome> {
  if (!Capacitor.isNativePlatform()) {
    return {
      status: 'unsupported',
      message: 'This browser cannot open the camera directly. Choose a file instead.',
    };
  }
  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      correctOrientation: true,
      width: 2000,
    });
    if (!photo.base64String) return { status: 'cancelled' };
    const contentType = photo.format === 'png' ? 'image/png' : 'image/jpeg';
    return {
      status: 'captured',
      pages: [
        {
          filename: `photo-${Date.now()}.${photo.format ?? 'jpeg'}`,
          contentType,
          bytes: base64ToBytes(photo.base64String),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'the camera did not open';
    if (/cancel/i.test(message)) return { status: 'cancelled' };
    if (/denied|permission|authoriz/i.test(message)) {
      return {
        status: 'denied',
        message: 'Camera access was denied. You can upload a file instead.',
      };
    }
    return { status: 'denied', message: `The camera is not available (${message}).` };
  }
}
