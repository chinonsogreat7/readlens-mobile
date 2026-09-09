import type { Attachment } from '../domain/reports';
import type { UploadTicket } from './reports';
import { aborted } from './contracts';

const mime = { JPEG: 'image/jpeg', PNG: 'image/png', WEBP: 'image/webp', PDF: 'application/pdf' };

class UploadError extends Error {}

// Native XHR can read picker/cache file URIs on both platforms. Expo's fetch
// FormData serializer requires real Blob bytes, not React Native's URI object.
export function readNativeAttachment(uri: string, signal: AbortSignal): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(aborted());
      return;
    }
    const request = new XMLHttpRequest();
    const cleanup = () => signal.removeEventListener('abort', cancel);
    const cancel = () => {
      request.abort();
      cleanup();
      reject(aborted());
    };
    request.onload = () => {
      cleanup();
      if (
        (request.status === 0 || (request.status >= 200 && request.status < 300)) &&
        request.response instanceof Blob
      ) {
        resolve(request.response);
      } else
        reject(
          new UploadError(
            'The selected file couldn’t be read. Your report is saved. Try the attachment upload again.',
          ),
        );
    };
    request.onerror = () => {
      cleanup();
      reject(
        new UploadError(
          'The selected file couldn’t be read. Your report is saved. Try the attachment upload again.',
        ),
      );
    };
    request.onabort = () => {
      cleanup();
      reject(aborted());
    };
    signal.addEventListener('abort', cancel, { once: true });
    try {
      request.open('GET', uri);
      request.responseType = 'blob';
      request.send();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

export async function uploadToS3(
  ticket: UploadTicket,
  file: Attachment,
  signal?: AbortSignal,
  options: {
    native?: boolean;
    transport?: typeof fetch;
    readBlob?: typeof readNativeAttachment;
  } = {},
) {
  if (signal?.aborted) throw aborted();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, 120_000);
  const transport = options.transport ?? fetch;
  let localBlob: Blob | undefined;
  let uploadBlob: Blob | undefined;
  try {
    const body = new FormData();
    Object.entries(ticket.fields).forEach(([key, value]) => body.append(key, value));
    // S3 requires the file part last. Fetch generates the multipart boundary.
    if (options.native === false) {
      const local = await transport(file.uri, { signal: controller.signal });
      if (!local.ok)
        throw new UploadError(
          'The selected file couldn’t be read. Your report is saved. Try the attachment upload again.',
        );
      localBlob = await local.blob();
    } else {
      localBlob = await (options.readBlob ?? readNativeAttachment)(file.uri, controller.signal);
    }
    if (controller.signal.aborted) throw aborted();
    uploadBlob = localBlob.slice(0, localBlob.size, mime[file.type]);
    body.append('file', uploadBlob, file.name);
    // Bypass ApiClient: no Basic Auth or application tokens go to S3.
    const response = await transport(ticket.url, {
      method: 'POST',
      credentials: 'omit',
      body,
      signal: controller.signal,
    });
    if (!response.ok)
      throw new UploadError(
        response.status === 403
          ? 'The upload authorization was rejected or expired. Your report is saved, but the attachment could not be uploaded.'
          : 'The attachment could not be uploaded. Your report is saved; try uploading the file again.',
      );
  } catch (error) {
    if (signal?.aborted) throw aborted();
    if (controller.signal.aborted)
      throw new Error('The upload timed out. Your report is saved. Retry the attachment upload.');
    if (error instanceof TypeError)
      throw new Error(
        'The upload connection was lost. Your report is saved. Retry the attachment upload.',
      );
    if (error instanceof UploadError) throw error;
    throw new UploadError(
      'The attachment couldn’t be uploaded. Your report is saved. Please retry the attachment upload.',
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    // React Native Blob has a native resource-release method; web Blob does not.
    (uploadBlob as (Blob & { close?: () => void }) | undefined)?.close?.();
    (localBlob as (Blob & { close?: () => void }) | undefined)?.close?.();
  }
}
