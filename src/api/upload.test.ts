import assert from 'node:assert/strict';
import { test } from 'node:test';
import { uploadToS3 } from './upload';
import { convertFormDataAsync } from '../../node_modules/expo/src/winter/fetch/convertFormData';

test('S3 POST contains signed fields with file last and no application authentication headers', async () => {
  let uploads = 0;
  await uploadToS3(
    {
      url: 'https://sample.s3.amazonaws.com/',
      fields: { key: 'reports/1', Policy: 'signed-policy', 'Content-Type': 'image/png' },
    },
    { name: 'image.png', type: 'PNG', uri: 'blob:local' },
    undefined,
    {
      native: false,
      transport: async (url, options) => {
        if (url === 'blob:local')
          return new Response(new Blob(['sample-image'], { type: 'image/png' }));
        uploads++;
        assert.equal(options?.method, 'POST');
        assert.equal(options?.headers, undefined);
        assert.equal(options?.credentials, 'omit');
        const body = options?.body as FormData;
        const keys: string[] = [];
        body.forEach((_value, key) => keys.push(key));
        assert.deepEqual(keys, ['key', 'Policy', 'Content-Type', 'file']);
        assert.equal(body.get('Policy'), 'signed-policy');
        assert.equal((body.get('file') as File).name, 'image.png');
        return new Response(null, { status: 204 });
      },
    },
  );
  assert.equal(uploads, 1);
});

test('native uploads contain real bytes accepted by the installed Expo FormData serializer', async () => {
  for (const [type, mime] of Object.entries({
    JPEG: 'image/jpeg',
    PNG: 'image/png',
    WEBP: 'image/webp',
    PDF: 'application/pdf',
  })) {
    let reads = 0;
    await uploadToS3(
      {
        url: 'https://sample.s3.amazonaws.com/',
        fields: { key: 'reports/test', Policy: 'test-policy' },
      },
      {
        name: 'test attachment',
        uri: 'file:///cache/test',
        type: type as 'JPEG' | 'PNG' | 'WEBP' | 'PDF',
      },
      undefined,
      {
        readBlob: async (uri, signal) => {
          assert.equal(uri, 'file:///cache/test');
          assert.equal(signal.aborted, false);
          reads++;
          return new Blob(['actual-file-bytes'], { type: 'application/octet-stream' });
        },
        transport: async (_url, request) => {
          const form = request?.body as FormData;
          const file = form.get('file') as File;
          assert.ok(file instanceof Blob);
          assert.equal(file.type, mime);
          assert.equal(file.name, 'test attachment');
          assert.equal(await file.text(), 'actual-file-bytes');
          assert.deepEqual([...form.keys()], ['key', 'Policy', 'file']);
          const serialized = await convertFormDataAsync(form, 'test-boundary');
          const text = new TextDecoder().decode(serialized.body);
          assert.ok(text.includes('actual-file-bytes'));
          assert.ok(text.includes(`content-type: ${mime}`));
          assert.equal(request?.headers, undefined);
          return new Response(null, { status: 204 });
        },
      },
    );
    assert.equal(reads, 1);
  }
});

test('unreadable local files never reach S3 and raw implementation errors stay private', async () => {
  let sent = false;
  await assert.rejects(
    uploadToS3(
      { url: 'https://sample.s3.amazonaws.com/', fields: {} },
      { name: 'test.png', uri: 'file:///missing', type: 'PNG' },
      undefined,
      {
        readBlob: async () => {
          throw new Error('Unsupported FormDataPart implementation');
        },
        transport: async () => {
          sent = true;
          return new Response();
        },
      },
    ),
    (error: Error) =>
      error.message.includes('report is saved') && !error.message.includes('FormDataPart'),
  );
  assert.equal(sent, false);
});

test('cancelling during the local read prevents the S3 POST', async () => {
  const controller = new AbortController();
  let sent = false;
  await assert.rejects(
    uploadToS3(
      { url: 'https://sample.s3.amazonaws.com/', fields: {} },
      { name: 'test.png', uri: 'file:///test', type: 'PNG' },
      controller.signal,
      {
        readBlob: async () => {
          controller.abort();
          return new Blob(['test']);
        },
        transport: async () => {
          sent = true;
          return new Response();
        },
      },
    ),
  );
  assert.equal(sent, false);
});
test('expired S3 authorization explains that the report is already saved', async () => {
  await assert.rejects(
    uploadToS3(
      { url: 'https://sample.s3.amazonaws.com/', fields: {} },
      { name: 'sample.pdf', uri: 'blob:local', type: 'PDF' },
      undefined,
      {
        native: false,
        transport: async (url) =>
          url === 'blob:local' ? new Response('file') : new Response(null, { status: 403 }),
      },
    ),
    /report is saved/,
  );
});
