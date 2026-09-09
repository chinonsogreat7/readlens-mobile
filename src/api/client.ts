import { ApiError, aborted, record } from './contracts';
import {
  expiresSoon,
  parseSession,
  SessionManager,
  type AuthSession,
} from '../auth/session-manager';

type Config = { baseUrl: string; username: string; password: string; timeoutMs?: number };
type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
  authenticated?: boolean;
};

export class ApiClient {
  private refreshFlight?: { generation: number; promise: Promise<AuthSession> };
  constructor(
    private config: Config,
    readonly sessions: SessionManager,
    private transport: typeof fetch = fetch,
  ) {}
  private basicAuth() {
    if (!this.config.username || !this.config.password)
      throw new ApiError(
        'Add the assessment gateway credentials to your local configuration, then restart the app.',
        0,
        'config',
      );
    if (this.config.username.includes(':'))
      throw new ApiError('The Basic Auth username must not contain a colon.', 0, 'config');
    const url = new URL(this.config.baseUrl);
    if (url.protocol !== 'https:' || url.username || url.password)
      throw new ApiError(
        'The API must use an HTTPS URL without embedded credentials.',
        0,
        'config',
      );
    const bytes = new TextEncoder().encode(`${this.config.username}:${this.config.password}`);
    return `Basic ${btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))}`;
  }
  private async send(
    path: string,
    options: RequestOptions,
    session?: AuthSession,
    refresh = false,
  ): Promise<unknown> {
    if (!path.startsWith('/') || path.startsWith('//'))
      throw new ApiError('Invalid API path.', 0, 'config');
    if (options.signal?.aborted) throw aborted();
    const headers: Record<string, string> = {
      Authorization: this.basicAuth(),
      Accept: 'application/json',
      'X-Client-Platform': 'mobile',
    };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (session) {
      headers['x-session-key'] = session.sessionKey;
      if (refresh) headers['X-Refresh-Token'] = session.refreshToken;
      else headers['X-Access-Token'] = session.accessToken;
    }
    const controller = new AbortController();
    const cancel = () => controller.abort();
    options.signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(cancel, this.config.timeoutMs ?? 90_000);
    try {
      const response = await this.transport(`${this.config.baseUrl.replace(/\/$/, '')}${path}`, {
        method: options.method ?? 'GET',
        headers,
        signal: controller.signal,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
      if (!response.ok)
        throw new ApiError(this.httpMessage(response.status, refresh), response.status);
      const body = record(await response.json());
      if (body.success !== true) {
        const status = typeof body.status_code === 'number' ? body.status_code : 400;
        throw new ApiError(this.httpMessage(status, refresh), status);
      }
      if (!('data' in body))
        throw new ApiError('The server returned an incomplete response.', 0, 'contract');
      return body.data;
    } catch (error) {
      if (options.signal?.aborted) throw aborted();
      if (error instanceof ApiError) throw error;
      if (error instanceof SyntaxError)
        throw new ApiError('The server returned unreadable data. Please try again.', 0, 'contract');
      throw new ApiError(
        controller.signal.aborted
          ? 'The server is taking longer than expected. Check your connection and try again.'
          : 'Could not reach the server. Check your connection and try again.',
        0,
        'network',
      );
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
    }
  }
  private httpMessage(status: number, refresh: boolean) {
    if (refresh && (status === 400 || status === 401 || status === 403))
      return 'Your session has expired. Please sign in again.';
    if (status === 401)
      return 'Authentication was rejected. Check your sign-in details and gateway configuration.';
    if (status === 403) return 'You do not have permission to perform this action.';
    if (status === 404) return 'This item could not be found.';
    if (status === 422 || status === 400)
      return 'The request was not accepted. Check the information entered and try again.';
    if (status === 429) return 'Too many requests. Please wait a moment before trying again.';
    return 'The server could not complete the request. Please try again.';
  }
  async refresh(): Promise<AuthSession> {
    const generation = this.sessions.generation;
    const session = this.sessions.getSnapshot().session;
    if (!session) throw new ApiError('Please sign in to continue.', 401);
    if (this.refreshFlight?.generation === generation) return this.refreshFlight.promise;
    const promise = (async () => {
      try {
        const data = await this.send('/auth/refresh_token', { method: 'POST' }, session, true);
        this.sessions.assertCurrent(generation);
        const next = parseSession(data, session);
        await this.sessions.save(next, generation);
        return next;
      } catch (error) {
        if (
          generation === this.sessions.generation &&
          error instanceof ApiError &&
          [400, 401, 403].includes(error.status)
        )
          await this.sessions.clear('Your session has expired. Please sign in again.');
        throw error;
      } finally {
        if (this.refreshFlight?.generation === generation) this.refreshFlight = undefined;
      }
    })();
    this.refreshFlight = { generation, promise };
    return promise;
  }
  async request(path: string, options: RequestOptions = {}): Promise<unknown> {
    // Do not start a shared refresh for work that was already cancelled.
    if (options.signal?.aborted) throw aborted();
    if (options.authenticated === false) return this.send(path, options);
    const generation = this.sessions.generation;
    let session = this.sessions.getSnapshot().session;
    if (!session) throw new ApiError('Please sign in to continue.', 401);
    if (expiresSoon(session.accessToken)) session = await this.refresh();
    this.sessions.assertCurrent(generation);
    try {
      const result = await this.send(path, options, session);
      this.sessions.assertCurrent(generation);
      return result;
    } catch (error) {
      this.sessions.assertCurrent(generation);
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      // Another request may have already refreshed while this response was in flight.
      const current = this.sessions.getSnapshot().session;
      session =
        current && current.accessToken !== session.accessToken ? current : await this.refresh();
      if (options.signal?.aborted) throw aborted();
      this.sessions.assertCurrent(generation);
      try {
        const result = await this.send(path, options, session);
        this.sessions.assertCurrent(generation);
        return result;
      } catch (retryError) {
        if (
          generation === this.sessions.generation &&
          retryError instanceof ApiError &&
          retryError.status === 401
        )
          await this.sessions.clear('Your session was rejected. Please sign in again.');
        throw retryError;
      }
    }
  }
}
