import assert from 'node:assert/strict';
import test from 'node:test';
import { isOtpComplete, normalizeOtp, otpCellCount } from './otp-input';

test('OTP input preserves leading zeroes', () => {
  assert.equal(normalizeOtp('001234'), '001234');
});

test('pasted OTP separators are removed', () => {
  assert.equal(normalizeOtp(' 012 345\n'), '012345');
  assert.equal(normalizeOtp('012-345'), '012345');
});

test('OTP input supports deletion and ignores nonnumeric input', () => {
  assert.equal(normalizeOtp(''), '');
  assert.equal(normalizeOtp('12a3'), '123');
});

test('generic cell layout can accommodate codes longer than six digits', () => {
  assert.equal(normalizeOtp('00123456'), '00123456');
  assert.equal(otpCellCount('00123456'), 8);
  assert.equal(otpCellCount('1234'), 6);
});

test('verification is ready only for exactly six numeric digits', () => {
  for (const code of ['', '1', '12345', '1234567', '12345a', ' 123456']) {
    assert.equal(isOtpComplete(code), false);
  }
  assert.equal(isOtpComplete('123456'), true);
  assert.equal(isOtpComplete('001234'), true);
  assert.equal(isOtpComplete('123456'.slice(0, -1)), false);
});

test('a known code length controls the number of cells', () => {
  assert.equal(otpCellCount('', 4), 4);
  assert.equal(otpCellCount('123456', 6), 6);
});
