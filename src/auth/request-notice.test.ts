import assert from 'node:assert/strict';
import test from 'node:test';
import { delayedRequestNotice } from './request-notice';

test('fast requests never show the slow-server notification', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const events: string[] = [];
  const stop = delayedRequestNotice(
    new AbortController().signal,
    () => events.push('show'),
    () => events.push('hide'),
  );
  t.mock.timers.tick(7999);
  stop();
  t.mock.timers.tick(9000);
  assert.deepEqual(events, []);
});

test('slow requests show once and completion dismisses once', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const events: string[] = [];
  const stop = delayedRequestNotice(
    new AbortController().signal,
    () => events.push('show'),
    () => events.push('hide'),
  );
  t.mock.timers.tick(8000);
  assert.deepEqual(events, ['show']);
  stop();
  stop();
  t.mock.timers.tick(10000);
  assert.deepEqual(events, ['show', 'hide']);
});

test('aborting a pending request cancels future feedback', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const events: string[] = [];
  const controller = new AbortController();
  delayedRequestNotice(
    controller.signal,
    () => events.push('show'),
    () => events.push('hide'),
  );
  controller.abort();
  t.mock.timers.tick(10000);
  assert.deepEqual(events, []);
});

test('aborting a slow request removes feedback already on screen', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const events: string[] = [];
  const controller = new AbortController();
  delayedRequestNotice(
    controller.signal,
    () => events.push('show'),
    () => events.push('hide'),
  );
  t.mock.timers.tick(8000);
  controller.abort();
  assert.deepEqual(events, ['show', 'hide']);
});

test('already-aborted requests cannot schedule a toast', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const controller = new AbortController();
  controller.abort();
  const events: string[] = [];
  delayedRequestNotice(
    controller.signal,
    () => events.push('show'),
    () => events.push('hide'),
  )();
  t.mock.timers.tick(10000);
  assert.deepEqual(events, []);
});
