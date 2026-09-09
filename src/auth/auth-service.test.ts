import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuthService } from './auth-service';
import { SessionManager } from './session-manager';
import { ApiClient } from '../api/client';

test('OTP verification includes the login challenge and persists only authenticated credentials', async () => {
  let saved = '';
  const sessions = new SessionManager({
    read: async () => null,
    write: async (value) => {
      saved = value;
    },
    remove: async () => {
      saved = '';
    },
  });
  const api = new ApiClient(
    { baseUrl: 'https://api.example.com', username: 'gateway', password: 'sample' },
    sessions,
    async (url, options) => {
      const body = JSON.parse(String(options?.body));
      assert.equal(new Headers(options?.headers).get('X-Access-Token'), null);
      if (String(url).endsWith('/auth/login')) {
        assert.deepEqual(body, { email: 'alex@example.com', password: 'account-password' });
        return new Response(JSON.stringify({ success: true, data: { token: 'challenge-token' } }));
      }
      assert.deepEqual(body, {
        email: 'alex@example.com',
        otp: '654321',
        token: 'challenge-token',
      });
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            access_token: 'access',
            refresh_token: 'refresh',
            session_key: 'key',
            user: { name: 'Alex', email: 'alex@example.com' },
          },
        }),
      );
    },
  );
  const auth = new AuthService(api);
  await auth.login(' alex@example.com ', 'account-password');
  assert.equal(saved, '');
  await auth.verify('alex@example.com', '654321');
  assert.equal(sessions.getSnapshot().session?.accessToken, 'access');
  assert.equal(saved.includes('account-password'), false);
  assert.equal(saved.includes('challenge-token'), false);
  await assert.rejects(auth.verify('alex@example.com', '654321'), /no longer available/);
});
test('canceling verification while keychain write is pending cannot sign the user back in', async () => {
  let saved = '';
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const sessions = new SessionManager({
    read: async () => null,
    write: async (value) => {
      entered();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      saved = value;
    },
    remove: async () => {
      saved = '';
    },
  });
  const api = new ApiClient(
    { baseUrl: 'https://api.example.com', username: 'gateway', password: 'sample' },
    sessions,
    async (url) =>
      new Response(
        JSON.stringify({
          success: true,
          data: String(url).endsWith('/auth/login')
            ? { token: 'challenge' }
            : { access_token: 'access', refresh_token: 'refresh', session_key: 'key' },
        }),
      ),
  );
  const auth = new AuthService(api);
  await auth.login('alex@example.com', 'sample');
  const verify = auth.verify('alex@example.com', '123456');
  const rejected = assert.rejects(verify, { name: 'AbortError' });
  await started;
  auth.cancel();
  release();
  await rejected;
  await sessions.clear();
  assert.equal(saved, '');
  assert.equal(sessions.getSnapshot().session, null);
});
