// React Fast Refresh and Strict Mode can replay an effect without leaving its
// screen. Give the replacement setup one microtask to renew ownership before
// disposing the pending login. A real unmount still disposes it promptly.
export function createVerificationLifetime(dispose: () => void) {
  let revision = 0;
  return {
    attach() {
      const attachedRevision = ++revision;
      return () => {
        queueMicrotask(() => {
          if (revision !== attachedRevision) return;
          ++revision;
          dispose();
        });
      };
    },
  };
}
