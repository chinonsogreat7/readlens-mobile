import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClient } from '../api/client';
import { AuthService } from './auth-service';
import { SessionManager } from './session-manager';
import { createVerificationLifetime } from './verification-lifetime';

const email = 'sample@example.com';
const password = 'test-only-password';
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }));

function setup() {
  let time = 0;
  let saved = '';
  let loginCount = 0;
  let nextLogin: (() => Promise<Response>) | undefined;
  const requests: { path: string; body: Record<string, string> }[] = [];
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
    { baseUrl: 'https://api.example.com', username: 'gateway', password: 'example' },
    sessions,
    async (url, options) => {
      requests.push({
        path: new URL(String(url)).pathname,
        body: JSON.parse(String(options?.body)),
      });
      if (String(url).endsWith('/auth/login')) {
        loginCount++;
        if (nextLogin) return nextLogin();
        return ok({ token: `challenge-${loginCount}` });
      }
      return ok({ access_token: 'access', refresh_token: 'refresh', session_key: 'key' });
    },
  );
  const auth = new AuthService(api, () => time);
  return {
    auth,
    sessions,
    requests,
    saved: () => saved,
    advance: (ms: number) => {
      time += ms;
    },
    onLogin: (handler: () => Promise<Response>) => {
      nextLogin = handler;
    },
  };
}

test('resend is blocked before cooldown and uses the documented login request afterward', async () => {
  const f = setup();
  await f.auth.login(email, password);
  await assert.rejects(f.auth.resend(email), /countdown/);
  assert.equal(f.requests.length, 1);
  f.advance(60_000);
  await f.auth.resend(email);
  assert.deepEqual(f.requests[1], { path: '/auth/login', body: { email, password } });
  assert.equal(f.auth.getResendAvailableAt(email), 120_000);
  assert.equal(f.saved(), '');
  await f.auth.verify(email, '123456');
  assert.equal(f.requests[2]?.body.token, 'challenge-2');
  assert.equal(f.saved().includes(password), false);
  await assert.rejects(f.auth.resend(email), /no longer available/);
});

test('resend and verification cannot race or issue duplicate emails', async () => {
  const f = setup();
  await f.auth.login(email, password);
  f.advance(60_000);
  let release!: (response: Response) => void;
  f.onLogin(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const first = f.auth.resend(email);
  await assert.rejects(f.auth.resend(email), /current request/);
  await assert.rejects(f.auth.verify(email, '123456'), /current request/);
  assert.equal(f.requests.length, 2);
  release(ok({ token: 'newest' }));
  await first;
});

test('failed resend keeps the previous challenge and throttles another email attempt', async () => {
  const f = setup();
  await f.auth.login(email, password);
  f.advance(60_000);
  f.onLogin(async () => new Response('', { status: 429 }));
  await assert.rejects(f.auth.resend(email), /Too many requests/);
  await assert.rejects(f.auth.resend(email), /countdown/);
  await f.auth.verify(email, '123456');
  assert.equal(f.requests.at(-1)?.body.token, 'challenge-1');
});

test('leaving the flow prevents a late resend from restoring pending credentials', async () => {
  const f = setup();
  await f.auth.login(email, password);
  f.advance(60_000);
  let release!: (response: Response) => void;
  f.onLogin(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const request = f.auth.resend(email);
  const rejected = assert.rejects(request);
  f.auth.cancel();
  release(ok({ token: 'late' }));
  await rejected;
  assert.equal(f.auth.getResendAvailableAt(email), undefined);
  await assert.rejects(f.auth.resend(email), /no longer available/);
  assert.equal(f.saved(), '');
});

test('resend rejects a different account without making a network request', async () => {
  const f = setup();
  await f.auth.login(email, password);
  f.advance(60_000);
  await assert.rejects(f.auth.resend('someone@example.com'), /no longer available/);
  assert.equal(f.requests.length, 1);
});

test('resend survives effect replay and verification uses the replacement login challenge', async () => {
  const f = setup();
  await f.auth.login(email, password);
  const lifetime = createVerificationLifetime(() => f.auth.cancel());
  lifetime.attach()();
  const leave = lifetime.attach();
  await Promise.resolve();
  f.advance(60_000);
  await f.auth.resend(email);
  assert.deepEqual(f.requests[1]?.body, { email, password });
  await f.auth.verify(email, '001234');
  assert.equal(f.requests[2]?.body.token, 'challenge-2');
  leave();
  await Promise.resolve();
  assert.equal(f.sessions.getSnapshot().session?.accessToken, 'access');
});

test('local resend failures do not start a new cooldown or make a request', async () => {
  const f = setup();
  await f.auth.login(email, password);
  f.advance(60_000);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(f.auth.resend(email, controller.signal));
  assert.equal(f.auth.getResendAvailableAt(email), 60_000);
  f.auth.cancel();
  await assert.rejects(f.auth.resend(email), /no longer available/);
  assert.equal(f.auth.getResendAvailableAt(email), undefined);
  assert.equal(f.requests.length, 1);
});

test('aborted resend cannot replace the challenge even if transport completes', async () => {
  const f = setup();
  await f.auth.login(email, password);
  f.advance(60_000);
  const controller = new AbortController();
  f.onLogin(async () => {
    controller.abort();
    return ok({ token: 'cancelled' });
  });
  await assert.rejects(f.auth.resend(email, controller.signal));
  await f.auth.verify(email, '123456');
  assert.equal(f.requests.at(-1)?.body.token, 'challenge-1');
});
