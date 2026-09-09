import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LiveReportsRepository,
  parsePage,
  parseReport,
  parseTicket,
  CreationUncertainError,
  secureAttachmentUrl,
} from './reports';
import { ApiClient } from './client';
import { SessionManager } from '../auth/session-manager';
const fixture = {
  id: '1',
  title: 'Title',
  status: 'submitted',
  created_at: '2026-09-06T09:00:00Z',
  author: { name: 'Alex', email: 'alex@example.com' },
};
const ticket = {
  upload_url: 'https://sample.s3.eu-west-1.amazonaws.com/',
  fields: {
    key: 'report/1',
    Policy: 'policy',
    'Content-Type': 'image/png',
    'X-Amz-Signature': 'signed',
  },
};
const attachment = { name: 'sample.png', uri: 'file:///sample.png', type: 'PNG' as const };
test('list/detail adapters match the documented schema and normalize attachment types', () => {
  assert.equal(parseReport(fixture).description, '');
  assert.equal(
    parseReport(
      {
        ...fixture,
        description: 'Details',
        file: { url: 'https://sample.s3.amazonaws.com/1', type: 'jpeg' },
      },
      true,
    ).attachment?.type,
    'JPEG',
  );
  assert.ok(
    parseReport(
      { ...fixture, description: 'Details', file: { url: 'http://unsafe.test/1', type: 'pdf' } },
      true,
    ).attachmentError,
  );
  assert.throws(() =>
    parsePage({ reports: [], pagination: { current_page: 1, has_next: true, next_page: 1 } }, 1),
  );
  assert.equal(
    parsePage(
      { reports: [fixture], pagination: { current_page: 1, has_next: false, next_page: null } },
      1,
    ).nextPage,
    undefined,
  );
});
test('verified Readlens CDN links upgrade to HTTPS without changing the object or query', () => {
  assert.equal(
    secureAttachmentUrl('http://cdn.dev.readlens.app/reports/file%20name.jpg?key=a%2Fb'),
    'https://cdn.dev.readlens.app/reports/file%20name.jpg?key=a%2Fb',
  );
  assert.equal(
    secureAttachmentUrl('https://sample.s3.amazonaws.com/file.jpg?signature=example'),
    'https://sample.s3.amazonaws.com/file.jpg?signature=example',
  );
});
test('attachment normalization does not permit insecure or impersonating destinations', () => {
  for (const url of [
    'http://unsafe.test/file.jpg',
    'http://cdn.dev.readlens.app.attacker.test/file.jpg',
    'http://cdn.dev.readlens.app:8080/file.jpg',
    'http://cdn.dev.readlens.app@attacker.test/file.jpg',
    'https://user:password@cdn.dev.readlens.app/file.jpg',
    'file:///private/file.jpg',
    'javascript:alert(1)',
    '/relative/file.jpg',
  ])
    assert.throws(() => secureAttachmentUrl(url));
});
test('invalid attachment metadata cannot hide a report or break its list', () => {
  for (const file of [
    { url: 'http://unsafe.test/file.jpg', type: 'jpeg' },
    { url: 'not a URL', type: 'jpeg' },
    { url: 123, type: 'jpeg' },
    { url: 'https://cdn.dev.readlens.app/file.exe', type: 'exe' },
    'malformed',
  ]) {
    const raw = { ...fixture, description: 'Saved details', file };
    const report = parseReport(raw, true);
    assert.equal(report.title, fixture.title);
    assert.equal(report.description, 'Saved details');
    assert.equal(report.attachment, undefined);
    assert.ok(report.attachmentError);
    assert.equal(
      parsePage(
        {
          reports: [raw],
          pagination: { current_page: 1, has_next: false },
        },
        1,
      ).reports.length,
      1,
    );
  }
  assert.equal(parseReport({ ...fixture, file: { url: null } }).attachmentError, undefined);
});
test('signed uploads reject unexpected destinations and incomplete policies', () => {
  assert.equal(parseTicket(ticket).fields.key, 'report/1');
  assert.throws(() =>
    parseTicket({ ...ticket, upload_url: 'https://s3.amazonaws.com.attacker.test/' }),
  );
  assert.throws(() => parseTicket({ ...ticket, fields: { key: 'report/1' } }));
});
test('file retry reuses the saved report and never creates a duplicate', async () => {
  let creates = 0;
  let uploads = 0;
  const manager = new SessionManager({
    read: async () => null,
    write: async () => {},
    remove: async () => {},
  });
  await manager.save(
    {
      accessToken: 'token',
      refreshToken: 'refresh',
      sessionKey: 'session',
      user: { name: 'Alex', email: '' },
    },
    0,
  );
  const api = new ApiClient(
    { baseUrl: 'https://api.example.com', username: 'basic', password: 'sample' },
    manager,
    async (_url, options) => {
      creates++;
      assert.equal(JSON.parse(String(options?.body)).file_type, 'PNG');
      return new Response(
        JSON.stringify({ success: true, data: { id: 'created', file_url: ticket } }),
      );
    },
  );
  const repository = new LiveReportsRepository(api, async () => {
    uploads++;
    if (uploads === 1) throw new Error('connection lost');
  });
  assert.deepEqual(
    await repository.create({ title: 'Title', description: 'Description', attachment }),
    { id: 'created' },
  );
  assert.equal(repository.getUpload('created')?.state, 'failed');
  await repository.retryUpload('created');
  assert.equal(repository.getUpload('created')?.state, 'processing');
  assert.equal(creates, 1);
  assert.equal(uploads, 2);
});
test('ambiguous creation failures require checking the list instead of retrying automatically', async () => {
  const manager = new SessionManager({
    read: async () => null,
    write: async () => {},
    remove: async () => {},
  });
  await manager.save(
    {
      accessToken: 'token',
      refreshToken: 'refresh',
      sessionKey: 'session',
      user: { name: '', email: '' },
    },
    0,
  );
  let calls = 0;
  const api = new ApiClient(
    { baseUrl: 'https://api.example.com', username: 'basic', password: 'sample' },
    manager,
    async () => {
      calls++;
      throw new TypeError('offline');
    },
  );
  const repository = new LiveReportsRepository(api, async () => {});
  await assert.rejects(
    repository.create({ title: 'Title', description: 'Details' }),
    CreationUncertainError,
  );
  assert.equal(calls, 1);
});

async function liveRepository(transport: typeof fetch) {
  const manager = new SessionManager({
    read: async () => null,
    write: async () => {},
    remove: async () => {},
  });
  await manager.save(
    {
      accessToken: 'token',
      refreshToken: 'refresh',
      sessionKey: 'session',
      user: { name: 'Alex', email: '' },
    },
    0,
  );
  return new LiveReportsRepository(
    new ApiClient(
      { baseUrl: 'https://api.example.com/api/v1', username: 'gateway', password: 'sample' },
      manager,
      transport,
    ),
    async () => {
      assert.fail('A report without an attachment must not upload');
    },
  );
}

test('live search and pagination send encoded query parameters and respect the final page', async () => {
  const requests: URL[] = [];
  const repository = await liveRepository(async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    const page = Number(url.searchParams.get('page'));
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          reports: [fixture],
          pagination: {
            current_page: page,
            has_next: page === 1,
            next_page: page === 1 ? 2 : null,
          },
        },
      }),
    );
  });
  const first = await repository.list('  water & safety  ', 1);
  assert.equal(first.nextPage, 2);
  assert.equal((await repository.list('water & safety', first.nextPage!)).nextPage, undefined);
  await repository.list('', 1);
  assert.deepEqual(
    requests.map((url) => Object.fromEntries(url.searchParams)),
    [
      { search: 'water & safety', page: '1', limit: '5' },
      { search: 'water & safety', page: '2', limit: '5' },
      { search: '', page: '1', limit: '5' },
    ],
  );
  assert.ok(requests.every((url) => url.pathname === '/api/v1/reports/test'));
});

test('live report creation without a file trims fields and omits file_type and upload work', async () => {
  let calls = 0;
  const repository = await liveRepository(async (_url, options) => {
    calls++;
    assert.equal(options?.method, 'POST');
    assert.deepEqual(JSON.parse(String(options?.body)), { title: 'Title', description: 'Details' });
    return new Response(JSON.stringify({ success: true, data: { id: 'text-only' } }));
  });
  assert.deepEqual(await repository.create({ title: ' Title ', description: ' Details ' }), {
    id: 'text-only',
  });
  assert.equal(calls, 1);
  assert.equal(repository.getUpload('text-only'), undefined);
});
