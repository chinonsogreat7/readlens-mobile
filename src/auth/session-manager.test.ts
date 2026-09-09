import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SessionManager, expiresSoon, parseSession, type SessionStorage } from './session-manager';

export const session = {
  accessToken: 'old',
  refreshToken: 'refresh',
  sessionKey: 'session',
  user: { name: 'Alex', email: 'alex@example.com' },
};
export function memoryStorage(): SessionStorage & { value: string | null } {
  return {
    value: null,
    async read() {
      return this.value;
    },
    async write(value) {
      this.value = value;
    },
    async remove() {
      this.value = null;
    },
  };
}
test('secure session round-trip restores tokens and user as one record', async () => {
  const storage = memoryStorage();
  const manager = new SessionManager(storage);
  await manager.save(session, 0);
  const restored = new SessionManager(storage);
  await restored.restore();
  assert.deepEqual(restored.getSnapshot().session, session);
  await restored.clear();
  assert.equal(storage.value, null);
});
test('corrupt saved credentials are removed and storage failure blocks sign-in', async () => {
  const storage = memoryStorage();
  storage.value = '{bad json';
  const manager = new SessionManager(storage);
  await manager.restore();
  assert.equal(storage.value, null);
  assert.equal(manager.getSnapshot().session, null);
  storage.read = async () => {
    throw new Error('locked');
  };
  await manager.restore();
  assert.equal(manager.getSnapshot().blocked, true);
});
test('logout serializes after an in-flight write and prevents session resurrection', async () => {
  const storage = memoryStorage();
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  storage.write = async (value) => {
    entered();
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    storage.value = value;
  };
  const manager = new SessionManager(storage);
  const saving = manager.save(session, 0);
  const rejected = assert.rejects(saving, { name: 'AbortError' });
  await started;
  const clearing = manager.clear();
  release();
  await Promise.all([rejected, clearing]);
  assert.equal(manager.getSnapshot().session, null);
  assert.equal(storage.value, null);
});
test('failed persistence never publishes an authenticated session', async () => {
  const storage = memoryStorage();
  storage.write = async () => {
    throw new Error('full');
  };
  const manager = new SessionManager(storage);
  await assert.rejects(manager.save(session, 0));
  assert.equal(manager.getSnapshot().session, null);
  assert.equal(manager.getSnapshot().blocked, true);
});
test('refresh parsing retains omitted refresh/session keys but rejects explicitly empty ones', () => {
  assert.equal(parseSession({ access_token: 'next' }, session).refreshToken, 'refresh');
  assert.throws(() => parseSession({ access_token: 'next', refresh_token: '' }, session));
  assert.throws(() => parseSession({ user: {} }, session));
});
test('JWT expiry only provides a scheduling hint, with a 30-second margin', () => {
  const token = `header.${btoa(JSON.stringify({ exp: 100 }))}.signature`;
  assert.equal(expiresSoon(token, 80_000), true);
  assert.equal(expiresSoon(token, 10_000), false);
  assert.equal(expiresSoon('malformed'), false);
});
