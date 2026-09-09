import assert from 'node:assert/strict';
import test from 'node:test';
import { formatResendCountdown, resendSecondsRemaining } from './otp-cooldown';

test('resend countdown rounds up and unlocks exactly at the deadline', () => {
  assert.equal(resendSecondsRemaining(60_000, 0), 60);
  assert.equal(resendSecondsRemaining(60_000, 59_999), 1);
  assert.equal(resendSecondsRemaining(60_000, 60_000), 0);
});

test('resend countdown catches up after backgrounding without negative values', () => {
  assert.equal(resendSecondsRemaining(60_000, 45_000), 15);
  assert.equal(resendSecondsRemaining(60_000, 180_000), 0);
});

test('resend countdown uses stable minute and second formatting', () => {
  assert.equal(formatResendCountdown(60), '1:00');
  assert.equal(formatResendCountdown(9), '0:09');
  assert.equal(formatResendCountdown(0), '0:00');
});
