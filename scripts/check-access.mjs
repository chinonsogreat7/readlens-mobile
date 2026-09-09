import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// A read-only gateway check. Never print credentials, response bodies, or tokens.
const env = parseEnv(readFileSync(new URL('../.env', import.meta.url), 'utf8'));
const username = env.EXPO_PUBLIC_BASIC_AUTH_USERNAME;
const password = env.EXPO_PUBLIC_BASIC_AUTH_PASSWORD;
if (!username || !password) throw new Error('Configure both gateway credentials in .env first.');
const headers = {
  Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
};
for (const [label, url] of [
  ['Development website', 'https://dev.readlens.app'],
  ['Report API (without account session)', 'https://dev.api.readlens.app/api/v1/reports/test'],
]) {
  try {
    const response = await fetch(url, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(90_000),
    });
    const gatewayChallenge = /basic/i.test(response.headers.get('www-authenticate') ?? '');
    console.log(
      `${label}: HTTP ${response.status}; Basic Auth challenge: ${gatewayChallenge ? 'yes' : 'no'}`,
    );
    if (response.headers.get('content-type')?.includes('application/json')) {
      const body = await response.json();
      console.log(
        `Assessment JSON envelope: ${body && typeof body === 'object' && 'success' in body ? 'recognized' : 'not recognized'}`,
      );
    }
    if (gatewayChallenge || response.status >= 500) process.exitCode = 1;
  } catch {
    console.error(`${label}: connection failed or timed out. No response data logged.`);
    process.exitCode = 1;
  }
}
