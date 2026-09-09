import type { ApiClient } from './client';
import {
  ApiError,
  errorMessage,
  identifier,
  optionalString,
  record,
  requiredString,
} from './contracts';
import {
  attachmentType,
  validateDraft,
  type Attachment,
  type Report,
  type ReportDraft,
  type ReportPage,
} from '../domain/reports';

export type UploadTicket = { url: string; fields: Record<string, string> };
export type UploadJob = {
  attachment: Attachment;
  ticket?: UploadTicket;
  state: 'uploading' | 'failed' | 'processing';
  message?: string;
};
export type ReportsRepository = {
  list(search: string, page: number, limit?: number, signal?: AbortSignal): Promise<ReportPage>;
  detail(id: string, signal?: AbortSignal): Promise<Report>;
  create(draft: ReportDraft, signal?: AbortSignal): Promise<{ id: string }>;
  getUpload(id: string): UploadJob | undefined;
  retryUpload(id: string, signal?: AbortSignal): Promise<void>;
  clear(): void;
};

export function secureAttachmentUrl(value: string): string {
  const url = new URL(value);
  if (url.username || url.password)
    throw new ApiError('The attachment link is invalid.', 0, 'contract');
  // The assessment API returns HTTP links for this CDN, but the same objects
  // are available over HTTPS. Upgrade only this verified first-party host.
  if (url.protocol === 'http:' && url.hostname === 'cdn.dev.readlens.app' && !url.port)
    url.protocol = 'https:';
  if (url.protocol !== 'https:')
    throw new ApiError('The attachment URL is not secure.', 0, 'contract');
  return url.toString();
}

export function parseReport(value: unknown, details = false): Report {
  const data = record(value);
  const author = data.author == null ? {} : record(data.author);
  let attachment: Attachment | undefined;
  let attachmentError: string | undefined;
  if (data.file != null) {
    try {
      const file = record(data.file);
      if (file.url != null && file.url !== '') {
        const uri = secureAttachmentUrl(requiredString(file.url));
        const type = attachmentType(
          undefined,
          `attachment.${optionalString(file.type).toLowerCase()}`,
        );
        if (!type) throw new ApiError('Unsupported attachment type.', 0, 'contract');
        attachment = { uri, type, name: `Supporting file (${type})` };
      }
    } catch {
      // Optional file metadata must not make the saved report unreadable.
      attachmentError =
        'This attachment can’t be opened safely. Your report is available. Please contact the assessment team about the file link.';
    }
  }
  return {
    id: identifier(data.id),
    title: requiredString(data.title),
    description: details ? requiredString(data.description) : optionalString(data.description),
    status: optionalString(data.status, 'Submitted'),
    createdAt: requiredString(data.created_at),
    author: {
      name: optionalString(author.name, 'Report author'),
      email: optionalString(author.email),
    },
    attachment,
    ...(attachmentError && { attachmentError }),
  };
}

export function parsePage(value: unknown, requestedPage: number): ReportPage {
  const data = record(value);
  if (!Array.isArray(data.reports))
    throw new ApiError('The report list response is invalid.', 0, 'contract');
  const pagination = record(data.pagination);
  if (pagination.current_page !== requestedPage || typeof pagination.has_next !== 'boolean')
    throw new ApiError('The server returned inconsistent pagination.', 0, 'contract');
  const next = pagination.has_next ? pagination.next_page : undefined;
  if (
    pagination.has_next &&
    (typeof next !== 'number' || !Number.isInteger(next) || next <= requestedPage)
  )
    throw new ApiError('The next report page is invalid.', 0, 'contract');
  return {
    reports: data.reports.map((item) => parseReport(item)),
    nextPage: next as number | undefined,
  };
}

export function parseTicket(value: unknown): UploadTicket {
  const data = record(value);
  const url = new URL(requiredString(data.upload_url));
  if (
    url.protocol !== 'https:' ||
    !/^(?:[a-z0-9-]+\.)*s3(?:[.-][a-z0-9-]+)*\.amazonaws\.com(?:\.cn)?$/.test(url.hostname) ||
    url.username ||
    url.password
  )
    throw new ApiError('The server returned an unexpected upload destination.', 0, 'contract');
  const source = record(data.fields);
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== 'string' || key.toLowerCase() === 'file')
      throw new ApiError('The upload form is invalid.', 0, 'contract');
    fields[key] = value;
  }
  if (!fields.key || !Object.keys(fields).some((key) => key.toLowerCase() === 'policy'))
    throw new ApiError('Upload authorization is incomplete.', 0, 'contract');
  return { url: url.toString(), fields };
}

export class CreationUncertainError extends Error {
  constructor() {
    super(
      'We could not confirm whether your report was created. Check your report list before submitting again to avoid a duplicate.',
    );
  }
}

export class LiveReportsRepository implements ReportsRepository {
  private uploads = new Map<string, UploadJob>();
  constructor(
    private api: ApiClient,
    private upload: (ticket: UploadTicket, file: Attachment, signal?: AbortSignal) => Promise<void>,
  ) {}
  async list(search: string, page: number, limit = 5, signal?: AbortSignal) {
    const params = new URLSearchParams({
      search: search.trim(),
      page: String(page),
      limit: String(limit),
    });
    return parsePage(await this.api.request(`/reports/test?${params}`, { signal }), page);
  }
  async detail(id: string, signal?: AbortSignal) {
    const report = parseReport(
      await this.api.request(`/reports/test/${encodeURIComponent(id)}`, { signal }),
      true,
    );
    if (report.attachment) this.uploads.delete(id);
    return report;
  }
  getUpload(id: string) {
    return this.uploads.get(id);
  }
  clear() {
    this.uploads.clear();
  }
  async create(draft: ReportDraft, signal?: AbortSignal) {
    const errors = validateDraft(draft);
    if (errors.title || errors.description) throw new Error(errors.title ?? errors.description);
    const generation = this.api.sessions.generation;
    let data: Record<string, unknown>;
    let id: string;
    try {
      data = record(
        await this.api.request('/reports/test', {
          method: 'POST',
          signal,
          body: {
            title: draft.title.trim(),
            description: draft.description.trim(),
            ...(draft.attachment && { file_type: draft.attachment.type }),
          },
        }),
      );
      id = identifier(data.id);
    } catch (error) {
      if (
        !(error instanceof ApiError) ||
        error.kind === 'network' ||
        error.kind === 'contract' ||
        error.status >= 500
      )
        throw new CreationUncertainError();
      throw error;
    }
    this.api.sessions.assertCurrent(generation);
    if (draft.attachment) {
      const job: UploadJob = { attachment: draft.attachment, state: 'failed' };
      this.uploads.set(id, job);
      try {
        job.ticket = parseTicket(data.file_url);
        await this.retryUpload(id, signal);
      } catch (error) {
        job.state = 'failed';
        job.message = errorMessage(error);
      }
    }
    this.api.sessions.assertCurrent(generation);
    return { id };
  }
  async retryUpload(id: string, signal?: AbortSignal) {
    const job = this.uploads.get(id);
    if (!job?.ticket)
      throw new Error(
        'Upload authorization is unavailable. The report is saved; contact the assessment team to recover its attachment.',
      );
    if (job.state === 'uploading') return;
    const generation = this.api.sessions.generation;
    job.state = 'uploading';
    job.message = undefined;
    try {
      await this.upload(job.ticket, job.attachment, signal);
      this.api.sessions.assertCurrent(generation);
      job.state = 'processing';
    } catch (error) {
      job.state = 'failed';
      job.message = errorMessage(error);
      throw error;
    }
  }
}
