import { useEffect, useId } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { dismissNotification } from '../ui/notifications';

export function useAuthNotification() {
  const id = useId();
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) dismissNotification(id);
    return () => dismissNotification(id);
  }, [focused, id]);
  return { id, focused };
}
