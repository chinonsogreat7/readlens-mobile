import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable } from 'react-native';
import { Easing, FadeInUp, FadeOutUp, ReduceMotion } from 'react-native-reanimated';
import { Toaster, toast } from 'sonner-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './components';
import { colors as c } from './theme';

// Slide from above and fade on the UI thread, without shifting the form.
const animation = {
  enter: FadeInUp.duration(250)
    .easing(Easing.bezier(0.23, 1, 0.32, 1))
    .reduceMotion(ReduceMotion.System),
  exit: FadeOutUp.duration(180)
    .easing(Easing.bezier(0.23, 1, 0.32, 1))
    .reduceMotion(ReduceMotion.System),
};

export function AppToaster() {
  const insets = useSafeAreaInsets();
  const [screenReader, setScreenReader] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        if (active) setScreenReader(enabled);
      })
      .catch(() => {
        // Prefer manual dismissal if the accessibility setting cannot be read.
        if (active) setScreenReader(true);
      });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return (
    <Toaster
      theme="light"
      position="top-center"
      closeButton
      offset={insets.top + 12}
      visibleToasts={1}
      enableStacking={false}
      autoWiggleOnUpdate="never"
      pauseWhenPageIsHidden
      allowFontScaling
      duration={screenReader ? Infinity : 7000}
      animation={animation}
      toastOptions={{
        style: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, padding: 12 },
        titleStyle: { color: c.ink, fontSize: 14, fontWeight: '600' },
        descriptionStyle: { color: c.muted, fontSize: 13, lineHeight: 19 },
        toastContentStyle: { gap: 10, alignItems: 'flex-start' },
      }}
    />
  );
}

export function notify(
  id: string,
  variant: 'error' | 'info' | 'success',
  title: string,
  description: string,
) {
  // Sonner supplies Android's live region; iOS needs an explicit announcement.
  if (Platform.OS === 'ios') {
    AccessibilityInfo.announceForAccessibility(`${title}. ${description}`);
  }
  toast[variant](title, {
    id,
    description,
    important: variant === 'error',
    styles:
      variant === 'error'
        ? {
            toast: { backgroundColor: c.softError, borderColor: c.errorBorder },
            title: { color: c.error },
            description: { color: c.error },
          }
        : undefined,
    icon: (
      <Icon
        name={
          variant === 'error'
            ? 'alert-circle-outline'
            : variant === 'success'
              ? 'checkmark-circle-outline'
              : 'information-circle-outline'
        }
        color={variant === 'error' ? c.error : c.green}
      />
    ),
    close: (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification"
        onPress={() => toast.dismiss(id)}
        style={({ pressed }) => ({
          width: 48,
          height: 48,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed
            ? variant === 'error'
              ? c.errorBorder
              : c.softGreen
            : 'transparent',
        })}
      >
        <Icon name="close" size={18} color={variant === 'error' ? c.error : c.muted} />
      </Pressable>
    ),
  });
}

export function dismissNotification(id: string) {
  toast.dismiss(id);
}
