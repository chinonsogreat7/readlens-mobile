import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attachmentType, validateDraft } from './reports';
import { createDemoRepository } from '../data/demo';

test('whitespace-only report fields are rejected independently', () => {
  assert.ok(validateDraft({ title: '  ', description: 'Details' }).title);
  assert.ok(validateDraft({ title: 'Title', description: '\n ' }).description);
  assert.deepEqual(validateDraft({ title: ' Title ', description: ' Details ' }), {
    title: undefined,
    description: undefined,
  });
});

test('supported MIME types map to API values and missing MIME uses extension', () => {
  assert.equal(attachmentType('image/jpeg', 'photo.jpg'), 'JPEG');
  assert.equal(attachmentType(undefined, 'REPORT.PDF'), 'PDF');
  assert.equal(attachmentType('application/octet-stream', 'photo.webp'), 'WEBP');
  assert.equal(attachmentType('text/plain', 'report.pdf'), undefined);
  assert.equal(attachmentType(undefined, 'report.exe'), undefined);
});

test('preview pagination ends without overlap and search starts independently', async () => {
  const repository = createDemoRepository();
  const first = await repository.list('', 1);
  const second = await repository.list('', first.nextPage!);
  assert.equal(first.reports.length, 5);
  assert.equal(second.reports.length, 3);
  assert.equal(second.nextPage, undefined);
  assert.equal(new Set([...first.reports, ...second.reports].map((item) => item.id)).size, 8);
  assert.equal((await repository.list('LIBRARY', 1)).reports.length, 1);
  assert.equal((await repository.list('no such report', 1)).reports.length, 0);
});

test('preview creation trims input and is available in list and details', async () => {
  const repository = createDemoRepository();
  const created = await repository.create({ title: ' A report ', description: ' Some context ' });
  assert.equal(created.title, 'A report');
  assert.equal((await repository.list('', 1)).reports[0]?.id, created.id);
  assert.equal((await repository.detail(created.id)).description, 'Some context');
  await assert.rejects(repository.create({ title: ' ', description: 'Valid' }));
  await assert.rejects(repository.detail('missing'));
});
