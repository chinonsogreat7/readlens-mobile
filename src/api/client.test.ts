import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient } from './client';
import { SessionManager } from '../auth/session-manager';

const original = {
  accessToken: 'old',
  refreshToken: 'refresh',
  sessionKey: 'session',
  user: { name: 'Alex', email: 'alex@example.com' },
};
const ok = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data, status_code: 200 }), { status: 200 });
const no = (status = 401) => new Response('', { status });
async function setup(handler: typeof fetch) {
  let value: string | null = null;
  const manager = new SessionManager({
    read: async () => value,
    write: async (next) => {
      value = next;
    },
    remove: async () => {
      value = null;
    },
  });
  await manager.save(original, 0);
  const api = new ApiClient(
    {
      baseUrl: 'https://api.example.com/api/v1',
      username: 'gateway',
      password: 'sample',
      timeoutMs: 100,
    },
    manager,
    handler,
  );
  return { api, manager };
}
test('concurrent unauthorized requests share one refresh and retry with rotated credentials', async () => {
  let refreshes = 0;
  let oldRequests = 0;
  const { api, manager } = await setup(async (url, options) => {
    const headers = new Headers(options?.headers);
    assert.equal(headers.get('Authorization'), `Basic ${btoa('gateway:sample')}`);
    assert.equal(headers.get('X-Client-Platform'), 'mobile');
    if (String(url).endsWith('/auth/refresh_token')) {
      refreshes++;
      assert.equal(headers.get('X-Refresh-Token'), 'refresh');
      assert.equal(headers.get('X-Access-Token'), null);
      await new Promise((resolve) => setTimeout(resolve, 10));
      return ok({ access_token: 'new', refresh_token: 'rotated', session_key: 'new-session' });
    }
    if (headers.get('X-Access-Token') === 'old') {
      oldRequests++;
      return no();
    }
    assert.equal(headers.get('x-session-key'), 'new-session');
    return ok({ id: 1 });
  });
  await Promise.all([
    api.request('/reports/test'),
    api.request('/reports/test'),
    api.request('/reports/test'),
  ]);
  assert.equal(refreshes, 1);
  assert.equal(oldRequests, 3);
  assert.equal(manager.getSnapshot().session?.refreshToken, 'rotated');
});
test('late 401 uses the token another request already refreshed', async () => {
  let refreshes = 0;
  const { api } = await setup(async (url, options) => {
    const headers = new Headers(options?.headers);
    if (String(url).endsWith('/auth/refresh_token')) {
      refreshes++;
      return ok({ access_token: 'new' });
    }
    if (headers.get('X-Access-Token') === 'old') {
      if (String(url).endsWith('/slow')) await new Promise((resolve) => setTimeout(resolve, 20));
      return no();
    }
    return ok({});
  });
  await Promise.all([api.request('/fast'), api.request('/slow')]);
  assert.equal(refreshes, 1);
});
test('failed refresh clears rejected credentials; transient failure retains them', async () => {
  for (const status of [401, 503]) {
    const { api, manager } = await setup(async (url) =>
      String(url).endsWith('/auth/refresh_token') ? no(status) : no(),
    );
    await assert.rejects(api.request('/reports/test'));
    assert.equal(!!manager.getSnapshot().session, status === 503);
  }
});
test('a second 401 stops after one retry and signs out', async () => {
  let refreshes = 0;
  let attempts = 0;
  const { api, manager } = await setup(async (url) => {
    if (String(url).endsWith('/auth/refresh_token')) {
      refreshes++;
      return ok({ access_token: 'new' });
    }
    attempts++;
    return no();
  });
  await assert.rejects(api.request('/reports/test'));
  assert.equal(refreshes, 1);
  assert.equal(attempts, 2);
  assert.equal(manager.getSnapshot().session, null);
});
test('logout during refresh prevents credentials being restored', async () => {
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const { api, manager } = await setup(async (url) => {
    if (String(url).endsWith('/auth/refresh_token')) {
      entered();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return ok({ access_token: 'new' });
    }
    return no();
  });
  const request = api.request('/reports/test');
  const rejected = assert.rejects(request, { name: 'AbortError' });
  await started;
  await manager.clear();
  release();
  await rejected;
  assert.equal(manager.getSnapshot().session, null);
});
test('cancellation is propagated and POST failures are not automatically repeated', async () => {
  let calls = 0;
  const { api } = await setup(async (_url, options) => {
    calls++;
    return new Promise((_resolve, reject) =>
      options?.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
    );
  });
  const controller = new AbortController();
  const request = api.request('/reports/test', {
    method: 'POST',
    body: { title: 'Example' },
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
  assert.equal(calls, 1);
});
test('malformed responses fail safely and raw responses never become error messages', async () => {
  const { api } = await setup(
    async () => new Response('<html>private gateway data</html>', { status: 401 }),
  );
  await assert.rejects(
    api.request('/auth/login', { authenticated: false }),
    (error) => error instanceof Error && !error.message.includes('private gateway'),
  );
});

test('a cancelled request never starts a token refresh', async () => {
  let calls = 0;
  const { api, manager } = await setup(async () => {
    calls++;
    return ok({ access_token: 'new' });
  });
  await manager.save({ ...original, accessToken: `header.${btoa('{"exp":1}')}.signature` }, 0);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(api.request('/reports/test', { signal: controller.signal }), {
    name: 'AbortError',
  });
  assert.equal(calls, 0);
});

test('an expired access token is refreshed before sending the report request', async () => {
  const paths: string[] = [];
  const { api, manager } = await setup(async (url, options) => {
    paths.push(new URL(String(url)).pathname);
    if (String(url).endsWith('/auth/refresh_token')) return ok({ access_token: 'new' });
    assert.equal(new Headers(options?.headers).get('X-Access-Token'), 'new');
    return ok({ reports: [] });
  });
  await manager.save({ ...original, accessToken: `header.${btoa('{"exp":1}')}.signature` }, 0);
  await api.request('/reports/test');
  assert.deepEqual(paths, ['/api/v1/auth/refresh_token', '/api/v1/reports/test']);
  assert.equal(manager.getSnapshot().session?.refreshToken, original.refreshToken);
});
