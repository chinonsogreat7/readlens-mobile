import type { ApiClient } from '../api/client';
import { ApiError, aborted, record, requiredString } from '../api/contracts';
import { parseSession } from './session-manager';
import { OTP_RESEND_DELAY_MS } from './otp-cooldown';

export class AuthService {
  // Pending-login secrets are memory-only and never enter navigation or storage.
  private challenge?: {
    email: string;
    password: string;
    token: string;
    generation: number;
    resendAvailableAt: number;
  };
  private operation?: symbol;
  private attempt = 0;
  constructor(
    private api: ApiClient,
    private now = Date.now,
  ) {}
  async login(email: string, password: string, signal?: AbortSignal) {
    const attempt = ++this.attempt;
    const generation = this.api.sessions.generation;
    this.challenge = undefined;
    this.operation = undefined;
    const data = record(
      await this.api.request('/auth/login', {
        method: 'POST',
        authenticated: false,
        body: { email: email.trim(), password },
        signal,
      }),
    );
    this.api.sessions.assertCurrent(generation);
    if (attempt !== this.attempt)
      throw new ApiError('A newer sign-in attempt is already in progress.');
    if (signal?.aborted) throw new ApiError('Sign-in was cancelled.');
    this.challenge = {
      email: email.trim(),
      password,
      token: requiredString(data.token),
      generation,
      resendAvailableAt: this.now() + OTP_RESEND_DELAY_MS,
    };
  }
  getResendAvailableAt(email: string) {
    return this.challenge?.email === email ? this.challenge.resendAvailableAt : undefined;
  }
  async resend(email: string, signal?: AbortSignal) {
    if (signal?.aborted) throw aborted();
    const challenge = this.challenge;
    if (!challenge || challenge.email !== email)
      throw new ApiError('Your sign-in attempt is no longer available. Go back and sign in again.');
    if (this.operation) throw new ApiError('Please wait for the current request to finish.');
    if (this.now() < challenge.resendAvailableAt)
      throw new ApiError('Please wait for the countdown before requesting another code.');
    this.api.sessions.assertCurrent(challenge.generation);
    const operation = Symbol('resend');
    this.operation = operation;
    // Also throttle failed attempts: an ambiguous response may still have sent an email.
    challenge.resendAvailableAt = this.now() + OTP_RESEND_DELAY_MS;
    try {
      const data = record(
        await this.api.request('/auth/login', {
          method: 'POST',
          authenticated: false,
          body: { email: challenge.email, password: challenge.password },
          signal,
        }),
      );
      this.api.sessions.assertCurrent(challenge.generation);
      if (signal?.aborted || this.challenge !== challenge || this.operation !== operation)
        throw new ApiError('This sign-in attempt has been replaced.');
      this.challenge = {
        ...challenge,
        token: requiredString(data.token),
        resendAvailableAt: this.now() + OTP_RESEND_DELAY_MS,
      };
    } finally {
      if (this.operation === operation) this.operation = undefined;
    }
  }
  async verify(email: string, otp: string, signal?: AbortSignal) {
    const challenge = this.challenge;
    if (!challenge || challenge.email !== email)
      throw new ApiError('Your sign-in attempt is no longer available. Go back and sign in again.');
    if (this.operation) throw new ApiError('Please wait for the current request to finish.');
    const operation = Symbol('verify');
    this.operation = operation;
    try {
      const data = await this.api.request('/auth/login/verify_otp', {
        method: 'POST',
        authenticated: false,
        body: { email, otp, token: challenge.token },
        signal,
      });
      if (signal?.aborted || challenge !== this.challenge)
        throw new ApiError('This sign-in attempt has been replaced.');
      await this.api.sessions.save(parseSession(data), challenge.generation);
      this.challenge = undefined;
    } finally {
      if (this.operation === operation) this.operation = undefined;
    }
  }
  cancel() {
    ++this.attempt;
    this.challenge = undefined;
    this.operation = undefined;
    // An OTP request or keychain write may finish after the user goes back.
    if (!this.api.sessions.getSnapshot().session) void this.api.sessions.clear();
  }
  async logout() {
    this.cancel();
    await this.api.sessions.clear();
  }
}
