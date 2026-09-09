import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

// Read-only check of tracked and non-ignored files. Never print secret values.
const root = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const files = [
  ...new Set(
    git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean),
  ),
];
const envFile = new URL('../.env', import.meta.url);
const env = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};
const username = env.EXPO_PUBLIC_BASIC_AUTH_USERNAME;
const password = env.EXPO_PUBLIC_BASIC_AUTH_PASSWORD;
const secrets = [username, password];
if (username && password) secrets.push(Buffer.from(`${username}:${password}`).toString('base64'));
const needles = secrets
  .filter((value) => value && value.length >= 8)
  .flatMap((value) => [value, JSON.stringify(value).slice(1, -1), encodeURIComponent(value)]);
const findings = [];
for (const file of files) {
  const path = resolve(root, file);
  if (!existsSync(path)) continue;
  if (lstatSync(path).isSymbolicLink()) {
    findings.push(`${file}: review symlink before publication`);
    continue;
  }
  if (
    /(^|\/)(\.env(?:\..+)?|node_modules|\.expo|dist|coverage|tmp|ios|android)(\/|$)/.test(file) &&
    file !== '.env.example'
  )
    findings.push(`${file}: private or generated file is publishable`);
  if (/\.(?:p12|pem|key|keystore|mobileprovision|ipa|apk|aab|mov)$/i.test(file))
    findings.push(`${file}: credential, build, or recording requires review`);
  const content = readFileSync(path).toString('utf8');
  if (needles.some((value) => content.includes(value)))
    findings.push(`${file}: contains a configured gateway credential`);
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content))
    findings.push(`${file}: contains private-key material`);
}
if (findings.length) {
  findings.forEach((finding) => console.error(finding));
  process.exitCode = 1;
} else {
  console.log(
    `Checked ${files.length} publishable files: no flagged private/generated files or known credential values.`,
  );
}
console.log(
  needles.length
    ? 'Local gateway values were checked without printing them.'
    : 'No local gateway values available; known-value scan was skipped.',
);
console.log(
  'This checks working-tree candidates, not Git history or every possible secret. Review the staged diff before publishing.',
);
