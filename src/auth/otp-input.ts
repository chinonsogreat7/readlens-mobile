// Keep leading zeroes and accept codes copied with spaces or separators.
export function normalizeOtp(value: string) {
  return value.replace(/\D/g, '');
}

export const OTP_LENGTH = 6;

export function isOtpComplete(value: string) {
  return /^\d{6}$/.test(value);
}

// The reusable component can accept other lengths; login explicitly uses six.
export function otpCellCount(value: string, length?: number) {
  return length ?? Math.max(6, value.length);
}
