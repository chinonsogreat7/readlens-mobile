import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';

const file = new URL('../.env', import.meta.url);
if (!existsSync(file)) {
  console.error('No .env file. Create one using .env.example.');
  process.exit(1);
}
const env = parseEnv(readFileSync(file, 'utf8'));
const credentialsReady = [
  'EXPO_PUBLIC_BASIC_AUTH_USERNAME',
  'EXPO_PUBLIC_BASIC_AUTH_PASSWORD',
].every((key) => !!env[key]?.trim());
const urlReady = env.EXPO_PUBLIC_API_URL === 'https://dev.api.readlens.app/api/v1';
console.log(
  `Gateway credentials: ${credentialsReady ? 'both configured (values hidden)' : 'missing one or both values'}`,
);
console.log(`Assessment API URL: ${urlReady ? 'correct' : 'check against .env.example'}`);
console.log(
  `App mode: ${env.EXPO_PUBLIC_DEMO_MODE === 'true' ? 'sample-data preview' : 'live mobile integration'}`,
);
console.log('Account email, account password, and OTP are entered in the mobile app, not in .env.');
if (!credentialsReady || !urlReady) process.exitCode = 1;
