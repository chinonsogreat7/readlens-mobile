export function validateLogin(email: string, password: string) {
  return {
    email: !email.trim()
      ? 'Enter your email address.'
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ? 'Enter a valid email address.'
        : undefined,
    // Password whitespace may be intentional; never trim or silently change it.
    password: !password
      ? 'Enter your password.'
      : password.length < 6
        ? 'Password must be at least 6 characters.'
        : undefined,
  };
}

export function isGatewayLogin(
  email: string,
  password: string,
  gateway: { username: string; password: string },
) {
  return Boolean(
    gateway.username &&
    gateway.password &&
    email.trim().toLowerCase() === gateway.username.trim().toLowerCase() &&
    password === gateway.password,
  );
}
