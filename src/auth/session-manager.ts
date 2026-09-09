import { ApiError, optionalString, record, requiredString, aborted } from '../api/contracts';

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  sessionKey: string;
  user: { name: string; email: string };
};
export type SessionStorage = {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  remove(): Promise<void>;
};
type Snapshot = {
  session: AuthSession | null;
  restoring: boolean;
  error?: string;
  blocked?: boolean;
};

export function parseSession(value: unknown, previous?: AuthSession): AuthSession {
  const data = record(value);
  const user = data.user == null ? {} : record(data.user);
  return {
    accessToken: requiredString(data.access_token),
    refreshToken: requiredString(data.refresh_token ?? previous?.refreshToken),
    sessionKey: requiredString(data.session_key ?? previous?.sessionKey),
    user: {
      name: optionalString(user.name, previous?.user.name ?? 'Your workspace'),
      email: optionalString(user.email, previous?.user.email ?? ''),
    },
  };
}

export function expiresSoon(token: string, now = Date.now()): boolean {
  try {
    const payload = token.split('.')[1];
    if (!payload) return false;
    const encoded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const data = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
    // Decoding is only a refresh scheduling hint; the server validates the JWT.
    return typeof data.exp === 'number' && data.exp * 1000 <= now + 30_000;
  } catch {
    return false;
  }
}

/** Serializes keychain writes and rejects results from an earlier login/logout generation. */
export class SessionManager {
  private snapshot: Snapshot = { session: null, restoring: true };
  private listeners = new Set<() => void>();
  private writes: Promise<void> = Promise.resolve();
  generation = 0;
  constructor(private storage: SessionStorage) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(next: Snapshot) {
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }
  private enqueue(task: () => Promise<void>) {
    const next = this.writes.then(task);
    this.writes = next.catch(() => undefined);
    return next;
  }
  assertCurrent(generation: number) {
    if (generation !== this.generation) throw aborted();
  }
  async restore() {
    const generation = this.generation;
    this.publish({ ...this.snapshot, restoring: true, error: undefined });
    try {
      const raw = await this.storage.read();
      this.assertCurrent(generation);
      let session: AuthSession | null = null;
      if (raw) {
        try {
          const stored = record(JSON.parse(raw));
          session = parseSession(stored);
        } catch {
          await this.enqueue(() => this.storage.remove());
          this.assertCurrent(generation);
        }
      }
      this.publish({ session, restoring: false });
    } catch (error) {
      if (generation === this.generation)
        this.publish({
          session: null,
          restoring: false,
          blocked: true,
          error: 'Secure storage could not be opened. Unlock your device and try again.',
        });
    }
  }
  async save(session: AuthSession, generation: number) {
    this.assertCurrent(generation);
    try {
      await this.enqueue(async () => {
        this.assertCurrent(generation);
        await this.storage.write(
          JSON.stringify({
            access_token: session.accessToken,
            refresh_token: session.refreshToken,
            session_key: session.sessionKey,
            user: session.user,
          }),
        );
      });
    } catch (error) {
      this.assertCurrent(generation);
      this.publish({
        session: null,
        restoring: false,
        blocked: true,
        error:
          'Your session could not be saved securely. Clear the saved session and sign in again.',
      });
      throw new ApiError('Your session could not be saved securely.', 0, 'config');
    }
    this.assertCurrent(generation);
    this.publish({ session, restoring: false });
  }
  async clear(message?: string) {
    ++this.generation;
    this.publish({ session: null, restoring: false, error: message });
    try {
      await this.enqueue(() => this.storage.remove());
    } catch {
      this.publish({
        session: null,
        restoring: false,
        blocked: true,
        error:
          'The saved session could not be removed. Unlock your device and try clearing it again.',
      });
    }
  }
}
