import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampPan, fitImage, panLimit, resistPan } from './media-geometry';

test('media fits portrait and landscape images without cropping', () => {
  assert.deepEqual(fitImage(1200, 800, 390, 700), { width: 390, height: 260 });
  assert.deepEqual(fitImage(800, 1600, 390, 700), { width: 350, height: 700 });
  assert.deepEqual(fitImage(0, 1600, 390, 700), { width: 0, height: 0 });
});
test('media pan gently resists dragging beyond an edge', () => {
  assert.equal(resistPan(20, 100, 390), 20);
  const resisted = resistPan(200, 100, 390);
  assert.ok(resisted > 100 && resisted < 200);
  assert.equal(resistPan(-200, 100, 390), -resisted);
  assert.equal(resistPan(0, 0, 0), 0);
});
test('media pan limits prevent losing the image outside the viewport', () => {
  assert.equal(panLimit(390, 390, 1), 0);
  assert.equal(panLimit(260, 700, 2), 0);
  assert.equal(panLimit(390, 390, 3), 390);
  assert.equal(clampPan(1000, 390), 390);
  assert.equal(clampPan(-1000, 390), -390);
  assert.equal(clampPan(20, 390), 20);
});
