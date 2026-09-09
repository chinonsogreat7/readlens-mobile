# Readlens mobile

A React Native / Expo implementation of the Readlens Mobile Engineer Assessment: email login and OTP, secure sessions, report creation with an optional file, server-side search and pagination, and report details.

The interface is an original assessment design. The layered icon and wordmark are a custom placeholder, not a verified official Readlens logo. No Figma design was supplied.

## Current status

Core functionality is implemented. Live login/OTP, report creation, and a JPEG upload through S3 to the CDN have been exercised in the iOS development client. Images and a public sample PDF have opened in the full-screen in-app viewer.

TypeScript and 77 automated tests pass. Those tests use fake transports/storage where appropriate; they do not prove every live backend or native-device behavior. Android, full live token-expiry scenarios, and all attachment formats still need end-to-end checks. See [the submission checklist](docs/SUBMISSION_CHECKLIST.md) for verified work and remaining checks.

## Setup

Use Node.js 22 LTS, npm, and a development build (not Expo Go).

```sh
npm ci
```

Create a local `.env` using `.env.example`, then configure it as described below **before** starting the app.

```sh
# Build and install a native development client:
npm run ios
# Or, with the Android SDK/emulator configured:
npm run android

# Subsequent JS/TypeScript changes:
npm start
```

iOS needs Xcode, a simulator runtime, and CocoaPods. A physical iPhone also needs development signing and Developer Mode. Android needs its SDK, Java tooling, and an emulator or device. Use `npm run ios -- --device` or `npm run android -- --device` to select a target.

Native dependencies and config plugins require rebuilding the development client; a Metro reload is insufficient. Restart Metro with `npm start -- --clear` after animation/worklet changes. Generated `ios/` and `android/` projects are ignored; reproducible configuration lives in `app.json` and the lockfile. Do not run a clean prebuild over native changes you intend to keep.

For a sample-only browser preview, set `EXPO_PUBLIC_DEMO_MODE=true` and run `npm run web`. Live browser authentication is intentionally disabled.

## Configuration

| Variable                          | Purpose                                                     |
| --------------------------------- | ----------------------------------------------------------- |
| `EXPO_PUBLIC_API_URL`             | `https://dev.api.readlens.app/api/v1`                       |
| `EXPO_PUBLIC_BASIC_AUTH_USERNAME` | Assessment gateway username supplied separately             |
| `EXPO_PUBLIC_BASIC_AUTH_PASSWORD` | Assessment gateway password supplied separately             |
| `EXPO_PUBLIC_DEMO_MODE`           | `false` for live mobile integration; `true` for sample data |

The example defaults to sample mode so it can be explored without credentials. Missing/false demo configuration selects live mode; API failures never silently fall back to sample data.

Run `npm run config:check` to validate local configuration without printing credentials. Restart Expo after changing environment variables.

Create a test account on [the Readlens development website](https://dev.readlens.app), using the assessment Basic Auth credentials to enter that website. Sign into the mobile app with your **registered account**, not the gateway credentials. OTP is sent to that account's email. Account passwords and OTPs are entered in the app, not in `.env`.

### Credential handling

- `.env`, generated builds, local logs, and signing material are ignored by Git.
- `EXPO_PUBLIC_*` values are embedded in the client bundle. They keep configuration out of source control but cannot keep shared credentials secret in a distributed app. This is assessment-only gateway configuration, not a production secret-management solution.
- Do not publish credential-bearing bundles, screenshots, recordings, environment files, or logs.
- `npm run security:check` scans tracked/non-ignored working-tree candidates for private/generated paths, private-key material, and locally configured gateway values. It does not scan Git history or detect every possible secret.
- Optional `node scripts/check-access.mjs` makes read-only gateway checks and prints only HTTP/envelope metadata.

## Architecture and state management

| Area                    | Responsibility                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `src/screens`           | One file per screen: login, verification, reports, creation, details, media viewer         |
| `src/ui`                | Reusable controls, OTP input, toast host, attachment chooser, skeletons, viewer primitives |
| `src/domain`            | Types, validation, attachment normalization, presentation and geometry helpers             |
| `src/auth`              | Auth service, session manager, secure storage, OTP lifecycle and shared notification hook  |
| `src/api`               | HTTP client, validated response adapters, reports repository, direct S3 upload             |
| `src/state/session.tsx` | React session subscription/context and cache cleanup                                       |
| `src/services.ts`       | Dependency wiring and explicit live/demo repository selection                              |
| `src/data/demo.ts`      | Isolated in-memory sample repository                                                       |

TanStack Query owns server data, caching, loading/error states and pagination. Query keys include the session generation and search term. Queries use a 30-second stale time and one bounded retry for eligible transient errors. Report creation uses a mutation with automatic retries disabled, then invalidates report lists.

A framework-independent SessionManager owns authentication state; React subscribes using `useSyncExternalStore` and exposes it through context. Forms and view state remain local with `useState`/`useRef`. Upload jobs and pending OTP credentials are memory-only. Reanimated shared values own animation state. Redux/Zustand were unnecessary for this scope.

React Navigation uses typed native-stack routes. Signing out removes the authenticated navigation group, cancels queries, and clears report caches/upload jobs.

## Authentication and token refresh

1. `POST /auth/login` sends account email/password. The returned challenge token is kept in AuthService memory.
2. `POST /auth/login/verify_otp` sends email, OTP, and challenge token.
3. Successful verification saves access token, refresh token, session key, and minimal user profile together in Expo SecureStore. iOS uses device-only, unlocked Keychain access. Startup validates/restores the record before showing authenticated screens.
4. Authenticated API calls include Basic Auth, `X-Client-Platform: mobile`, `X-Access-Token`, and `x-session-key`.
5. Before a request, a decoded JWT expiry within 30 seconds triggers `POST /auth/refresh_token`. Decoding is only a scheduling hint; the server validates the token. Refresh sends Basic Auth, platform/session headers, and `X-Refresh-Token`.
6. A server `401` also triggers refresh and one replay. Concurrent requests share one refresh; late responses reuse a token already refreshed. Rotated credentials are persisted; omitted refresh/session fields retain previous values.
7. Refresh rejection (`400/401/403`) or a second `401` ends the local session. Temporary network/server refresh failures preserve credentials and expose retry feedback. Already-cancelled requests do not start refresh.
8. Logout clears secure storage and pending credentials. Generation checks prevent late login/refresh results from restoring a signed-out session. Storage failures block access and offer recovery.

The six-cell OTP input supports paste and one-time-code autofill with explicit verification. Resend unlocks after a 60-second client cooldown based on an absolute deadline. With no documented resend endpoint, it repeats login and replaces the challenge token. The password is retained only in memory until verification, cancellation or logout. Failed resend attempts are throttled because an ambiguous response may still have sent an email.

No server logout/revocation endpoint is documented, so logout terminates the local session only. Live refresh response behavior still needs verification against the backend.

## Reports and API integration

| Endpoint                                    | Use                                             |
| ------------------------------------------- | ----------------------------------------------- |
| `POST /auth/login`                          | Login and resend                                |
| `POST /auth/login/verify_otp`               | Complete sign-in                                |
| `POST /auth/refresh_token`                  | Refresh session credentials                     |
| `GET /reports/test?limit=5&page=…&search=…` | Server-side report search and pagination        |
| `POST /reports/test`                        | Create report and obtain optional S3 form       |
| `GET /reports/test/:id`                     | Report details and attachment processing checks |

The client validates API envelopes and required fields. Raw response bodies, credentials and tokens are not logged or displayed. API requests have a 90-second timeout to accommodate the development server waking up, plus cancellation support. Buttons show pending state; no slow-connection toast is shown.

Search is debounced for 300 ms and sent to the API, not applied locally to a downloaded dataset. A new search uses its own page-one cache; clearing it returns to the unfiltered query. Load-more follows server pagination, guards duplicate requests, and retains loaded reports on subsequent-page or refresh failures. Loading, empty, no-results, retry and end-of-list states are distinct.

Title and description are required after trimming. Submit remains disabled until valid and hides while the keyboard is open. Field errors appear beside inputs. An ambiguous creation failure asks the user to check the list before resubmitting rather than creating a duplicate automatically.

## Attachments and recovery

A bottom-sheet chooser offers Photo library or Files. Supported formats are JPEG, PNG, WEBP and PDF. Gallery assets use compatible representations; returned formats are validated rather than renamed to disguise unsupported bytes. Pickers allow one file and cancellation preserves the form. Camera/microphone permissions are disabled.

Upload is two-step:

1. Create the report with optional `file_type`.
2. Validate the returned HTTPS S3 destination/fields, then POST signed fields and the file directly to S3, with the file last.

Native XHR reads the selected local URI into a Blob compatible with Expo's multipart serializer. Fetch generates the boundary. S3 requests bypass ApiClient and omit application auth headers and cookies. Uploads have a two-minute timeout; native Blob resources are released afterward.

If upload fails, the report remains saved. Retry reuses the report's existing signed form, never another report-creation request. Missing/expired upload authorization is reported; no undocumented renewal endpoint is invented.

After upload, details poll every three seconds for up to one minute while active/focused. Polling stops when an attachment arrives, an error occurs, or time runs out; manual refresh remains available. Invalid optional attachment metadata does not hide report text. The API's HTTP links for the exact `cdn.dev.readlens.app` host are upgraded to verified HTTPS; other insecure links are rejected.

Image previews and PDFs open in a full-screen in-app viewer. Images support pinch/pan, double-tap zoom and accessible zoom/reset controls. PDFs use native rendering, certificate verification, page count, and zoom; PDF links do not launch outside destinations. No third-party online document viewer receives attachment URLs. The modal has its own safe-area provider. Reduce Motion is respected by the app's Reanimated/native-stack transitions.

## Testing

```sh
npm run submission:check
npm run config:check
npx expo install --check
npm audit
```

`submission:check` runs TypeScript, automated tests, formatting and public-file checks. Tests cover auth/OTP lifecycle, secure-storage failure and ordering, refresh concurrency/expiry/rejection, cancellation, report adapters, live request query/body construction, validation, upload byte serialization/header isolation, retry recovery and presentation helpers.

Tests use Node's test runner with tsx and injected transports/storage. They do not replace native UI tests or live API checks. A Metro export verifies bundling, not native Android compilation. Do not publish exports made with gateway credentials.

## Trade-offs and known limitations

- Drafts, pending OTP credentials, upload tickets, and report caches are not persisted. Process death loses unsaved drafts and upload-only recovery state.
- No offline queue/background upload, byte-progress indicator, attachment reauthorization, or server-side session revocation.
- Uploads read the complete file into memory. No unsupported server size limit is invented; very large files can pressure device memory.
- Native image/PDF libraries can keep attachment data in OS/app caches; this is not an encrypted offline-document vault.
- No reliable API field distinguishes “no attachment” from “still processing” after a restart.
- Native network failures use bounded requests and retry feedback; proactive device connectivity tracking is not installed.
- Live browser auth is deliberately disabled. Demo data resets on reload/sign-out.
- Physical-device gestures, large text/screen readers, Android, and all live file formats require the checks listed separately.
- The 9 September 2026 dependency audit reports 18 moderate findings and no high/critical findings. They propagate from [decode-uri-component](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) through React Navigation and [uuid](https://github.com/advisories/GHSA-w5hq-g745-h8pq) through Expo/Xcode tooling. npm's proposed Expo/plugin fixes are incompatible major downgrades; no forced downgrade or unverified override was applied. Review compatible upstream updates before release.

## Submission

Review [docs/SUBMISSION_CHECKLIST.md](docs/SUBMISSION_CHECKLIST.md), then review the staged source and placeholder configuration before publishing. Repository creation, pushing, and emailing the submission are separate actions; the app does not perform them.
