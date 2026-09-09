import assert from 'node:assert/strict';
import test from 'node:test';
import { photoAttachment } from './photo-attachment';

test('gallery selection maps exported image metadata to the upload attachment', () => {
  assert.deepEqual(
    photoAttachment({
      uri: 'file:///cache/photo.jpg',
      fileName: 'IMG_01.HEIC',
      mimeType: 'image/jpeg',
      fileSize: 123,
    }),
    { uri: 'file:///cache/photo.jpg', name: 'IMG_01.jpg', type: 'JPEG', size: 123 },
  );
});
test('missing gallery filename and MIME fall back to the exported URI', () => {
  assert.equal(photoAttachment({ uri: 'file:///cache/image.png', fileName: null }).type, 'PNG');
  assert.equal(
    photoAttachment({ uri: 'blob:local', mimeType: 'image/webp', fileName: null }).type,
    'WEBP',
  );
});
test('gallery adapter rejects unsupported formats and does not mislabel their bytes', () => {
  for (const mimeType of ['image/heic', 'image/gif', 'video/mp4', 'application/pdf']) {
    assert.throws(() => photoAttachment({ uri: 'file:///fake.jpg', mimeType }), /Choose a JPEG/);
  }
});
