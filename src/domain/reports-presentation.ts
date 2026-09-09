export function reportGreeting(name: string) {
  const clean = name.trim();
  if (!clean || clean.toLowerCase() === 'your workspace') return 'Welcome back';
  return `Welcome back, ${clean.split(/\s+/)[0]}`;
}

export function reportListState({
  searching,
  pending,
  failed,
  paused,
  hasReports,
}: {
  searching: boolean;
  pending: boolean;
  failed: boolean;
  paused: boolean;
  hasReports: boolean;
}): 'loading' | 'offline' | 'error' | 'empty' | 'ready' {
  if (searching) return 'loading';
  if (hasReports) return 'ready';
  if (paused) return 'offline';
  if (pending) return 'loading';
  if (failed) return 'error';
  return 'empty';
}
