export type AttachmentType = 'JPEG' | 'PNG' | 'WEBP' | 'PDF';

export type Attachment = {
  name: string;
  uri: string;
  type: AttachmentType;
  size?: number;
};

export type Report = {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  author: { name: string; email: string };
  attachment?: Attachment;
  attachmentError?: string;
};

export type ReportDraft = { title: string; description: string; attachment?: Attachment };
export type ReportPage = { reports: Report[]; nextPage: number | undefined };

export function validateDraft(draft: ReportDraft) {
  return {
    title: draft.title.trim() ? undefined : 'Give your report a title.',
    description: draft.description.trim() ? undefined : 'Add a description of what happened.',
  };
}

export function attachmentType(
  mimeType: string | undefined,
  name: string,
): AttachmentType | undefined {
  const byMime: Record<string, AttachmentType> = {
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/webp': 'WEBP',
    'application/pdf': 'PDF',
  };
  const byExtension: Record<string, AttachmentType> = {
    jpg: 'JPEG',
    jpeg: 'JPEG',
    png: 'PNG',
    webp: 'WEBP',
    pdf: 'PDF',
  };
  // The OS picker occasionally omits MIME; only then use the extension as a hint.
  if (mimeType && mimeType !== 'application/octet-stream') return byMime[mimeType.toLowerCase()];
  return byExtension[name.split('.').pop()?.toLowerCase() ?? ''];
}
