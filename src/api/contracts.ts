export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public kind: 'http' | 'network' | 'contract' | 'config' = 'http',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ApiError(
      'The server returned an unexpected response. Please try again.',
      0,
      'contract',
    );
  return value as Record<string, unknown>;
}

export function requiredString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim())
    throw new ApiError('The server response is missing required information.', 0, 'contract');
  return value;
}

export function identifier(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : requiredString(value);
}

export function optionalString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function queryRetry(count: number, error: Error): boolean {
  if (error.name === 'AbortError') return false;
  if (
    error instanceof ApiError &&
    (error.kind === 'config' ||
      error.kind === 'contract' ||
      (error.status >= 400 && error.status < 500))
  )
    return false;
  return count < 1;
}

export function aborted(): Error {
  const error = new Error('Request cancelled.');
  error.name = 'AbortError';
  return error;
}
