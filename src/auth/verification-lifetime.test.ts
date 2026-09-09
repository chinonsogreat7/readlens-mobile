import assert from 'node:assert/strict';
import test from 'node:test';
import { createVerificationLifetime } from './verification-lifetime';

test('effect replay preserves the pending login', async () => {
  let cancelled = 0;
  const lifetime = createVerificationLifetime(() => {
    cancelled++;
  });
  const firstCleanup = lifetime.attach();
  firstCleanup();
  const finalCleanup = lifetime.attach();
  await Promise.resolve();
  assert.equal(cancelled, 0);
  finalCleanup();
  await Promise.resolve();
  assert.equal(cancelled, 1);
});

test('a real screen unmount disposes pending credentials exactly once', async () => {
  let cancelled = 0;
  const cleanup = createVerificationLifetime(() => {
    cancelled++;
  }).attach();
  cleanup();
  cleanup();
  await Promise.resolve();
  assert.equal(cancelled, 1);
});
