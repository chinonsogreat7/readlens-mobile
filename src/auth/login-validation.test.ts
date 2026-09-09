import assert from 'node:assert/strict';
import test from 'node:test';
import { isGatewayLogin, validateLogin } from './login-validation';

test('empty login identifies both required fields', () => {
  assert.deepEqual(validateLogin('  ', ''), {
    email: 'Enter your email address.',
    password: 'Enter your password.',
  });
});

test('invalid email is rejected even when a password is present', () => {
  for (const email of ['hello', 'hello@', 'hello@example', 'a b@example.com']) {
    assert.equal(validateLogin(email, 'example-password').email, 'Enter a valid email address.');
  }
});

test('surrounding email whitespace is accepted and a missing password is identified', () => {
  assert.deepEqual(validateLogin(' person@example.com ', ''), {
    email: undefined,
    password: 'Enter your password.',
  });
});

test('password validation preserves intentional whitespace', () => {
  assert.deepEqual(validateLogin('person@example.com', ' pass '), {
    email: undefined,
    password: undefined,
  });
});

test('login readiness requires a valid email and at least six password characters', () => {
  const cases: [string, string, boolean][] = [
    ['', '', false],
    ['person@example.com', '', false],
    ['person@example.com', 'P', false],
    ['person@example.com', '12345', false],
    ['person@example.com', '123456', true],
    ['', 'example-password', false],
    ['person@', 'example-password', false],
    ['person@example.com', 'example-password', true],
    [' person@example.com ', 'example-password', true],
  ];
  for (const [email, password, ready] of cases) {
    const errors = validateLogin(email, password);
    assert.equal(!errors.email && !errors.password, ready);
  }
});

test('short passwords have a clear minimum-length validation message', () => {
  for (const password of ['P', '12345']) {
    assert.equal(
      validateLogin('person@example.com', password).password,
      'Password must be at least 6 characters.',
    );
  }
  assert.equal(validateLogin('person@example.com', '123456').password, undefined);
  assert.equal(validateLogin('person@example.com', '1234567').password, undefined);
});

test('gateway credential detection matches only the configured pair', () => {
  const gateway = { username: 'gateway@example.com', password: 'test-gateway-password' };
  assert.equal(isGatewayLogin(' GATEWAY@example.com ', gateway.password, gateway), true);
  assert.equal(isGatewayLogin(gateway.username, 'account-password', gateway), false);
  assert.equal(isGatewayLogin('account@example.com', gateway.password, gateway), false);
  assert.equal(isGatewayLogin('', '', { username: '', password: '' }), false);
});
