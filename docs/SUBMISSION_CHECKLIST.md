# Submission checklist

Status as of 9 September 2026. Checked items have direct evidence; unchecked items are not claims of missing implementation, but work still needed to verify or deliver it. Do not submit another report to retry a failed attachment.

## Implemented and checked

- [x] React Native/TypeScript app with a custom Expo development build.
- [x] Live account login and email OTP access to the reports screen.
- [x] Live report creation and a JPEG upload appearing on the CDN/report.
- [x] iOS development build compiled/installed; image and sample PDF viewer opened in-app.
- [x] Login/OTP validation, resend countdown, report form validation, keyboard-aware footer and safe-area fixes.
- [x] Automated coverage for refresh, secure-storage ordering, cancellations, upload recovery, report/search/pagination contracts and form/presentation logic.
- [x] Separate screen files and reusable authentication notification hook.
- [x] Temporary assessment page images removed; original PDF unaffected.
- [x] README covers setup, configuration, architecture, auth/API behavior, trade-offs and limitations.
- [x] Final `submission:check` passed: TypeScript, 77 tests, formatting and public-file scan. Local configuration check passed without printing credential values.
- [x] iOS, Android and web Metro exports passed in credential-free sample mode. This does not verify native Android compilation or live authentication.

## Live and device checks before final sign-off

- [ ] Force-close/reopen the native app: session restores without entering OTP again.
- [ ] Let an access token expire, then load reports: refresh succeeds without forcing login.
- [ ] Verify rejected refresh and logout clear session/UI; reopening cannot expose prior cached reports.
- [ ] Resend OTP, use the newest email code, and verify without restarting sign-in.
- [ ] Create a text-only report, then PNG, WEBP and PDF reports with small non-sensitive files; verify S3 acceptance and eventual attachment availability.
- [ ] Confirm upload-only retry does not duplicate a report; exercise interruption and explain process-restart limitations.
- [ ] With more than five reports, load subsequent/final pages. Check search, no matches, clearing search, changing search while loading, and pagination within results.
- [ ] Exercise slow server, airplane mode/connection loss, recovery, next-page errors and detail refresh errors without discarding cached report text.
- [ ] Check Photos/Files cancellation, physical-device keyboard scrolling, media pinch/pan and multi-page PDFs.
- [ ] Build/run Android; check keyboard, pickers, upload, PDF and safe areas.
- [ ] Check larger text, screen reader, Reduce Motion, and touch targets on a device.

Use non-sensitive test data. Reuse existing reports for read-only checks when possible. A passing unit test or successful Metro export is not evidence of live backend or native Android behavior.

## Repository and delivery

- [x] Run `npm run submission:check` and `npm run config:check` from the reviewed working tree; rerun after further changes.
- [ ] Review `npm audit`: 18 moderate findings were reported on 9 September; record accepted limitations or verify compatible fixes. Do not force a major Expo downgrade.
- [ ] Review staged changes, including the README, lockfile, plugins and `.env.example`; exclude real `.env` values, private assets, recordings and generated bundles.
- [ ] Confirm the app starts from the documented clean-install steps.
- [ ] Commit source and connect the intended public GitHub repository. No commit/remote existed at this review's start.
- [ ] Publish only after reviewing the exact files; verify the repository opens for the assessment team.
- [ ] Reply to the assessment email with the repository link. The supplied email requests submission by Wednesday, 9 September 2026.

This checklist does not publish a repository, send an email, or mark unverified flows as complete.
