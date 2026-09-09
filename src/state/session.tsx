import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { auth, reportsRepository, sessions } from '../services';
import { demoMode } from '../config';
export { demoMode } from '../config';

type Session = {
  signedIn: boolean;
  restoring: boolean;
  blocked?: boolean;
  error?: string;
  user: { name: string; email: string };
  scope: string;
  signIn: () => void;
  signOut: () => void;
  retryStorage: () => void;
};
const SessionContext = createContext<Session | undefined>(undefined);

export function SessionProvider({ children }: PropsWithChildren) {
  const snapshot = useSyncExternalStore(
    sessions.subscribe,
    sessions.getSnapshot,
    sessions.getSnapshot,
  );
  const [signedIn, setSignedIn] = useState(false);
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!demoMode) void sessions.restore();
  }, []);
  useEffect(
    () =>
      sessions.subscribe(() => {
        if (!sessions.getSnapshot().session) {
          void queryClient.cancelQueries();
          queryClient.clear();
          reportsRepository.clear();
        }
      }),
    [queryClient],
  );
  return (
    <SessionContext.Provider
      value={{
        signedIn: demoMode ? signedIn : !!snapshot.session,
        restoring: !demoMode && snapshot.restoring,
        blocked: !demoMode && snapshot.blocked,
        error: demoMode ? undefined : snapshot.error,
        user: demoMode
          ? { name: 'Alex Morgan', email: 'alex@example.com' }
          : (snapshot.session?.user ?? { name: '', email: '' }),
        scope: demoMode ? 'demo' : String(sessions.generation),
        retryStorage: () => {
          void sessions.clear();
        },
        signIn: () => {
          if (demoMode) setSignedIn(true);
        },
        signOut: () => {
          queryClient.clear();
          setSignedIn(false);
          reportsRepository.clear();
          void auth.logout();
        },
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('SessionProvider is missing.');
  return context;
}
