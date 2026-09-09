import { attachmentType, type Attachment } from './reports';

type PhotoAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number;
};

export function photoAttachment(asset: PhotoAsset): Attachment {
  const uriName = asset.uri.split(/[?#]/)[0]?.split('/').pop() ?? '';
  // The exported file can differ from the original library asset (e.g. HEIC to JPEG).
  const hint = attachmentType(undefined, uriName) ? uriName : (asset.fileName ?? '');
  const type = attachmentType(asset.mimeType ?? undefined, hint);
  if (!type || type === 'PDF')
    throw new Error('Choose a JPEG, PNG or WEBP photo, or use Browse files for a PDF.');
  const extension = type === 'JPEG' ? 'jpg' : type.toLowerCase();
  const originalName = asset.fileName || uriName;
  const stem = originalName.replace(/\.[^.]*$/, '') || 'photo';
  return {
    uri: asset.uri,
    name: `${stem}.${extension}`,
    type,
    size: asset.fileSize,
  };
}
