// A client-side UX cooldown, not a claim about the server's rate-limit policy.
export const OTP_RESEND_DELAY_MS = 60_000;

export function resendSecondsRemaining(availableAt: number, now = Date.now()) {
  return Math.max(0, Math.ceil((availableAt - now) / 1000));
}

export function formatResendCountdown(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
