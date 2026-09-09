import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Button, Icon, textStyles as t } from './components';
import { colors as c } from './theme';

export type AttachmentSource = 'photos' | 'files';

const SHEET_SPRING = {
  duration: 300,
  dampingRatio: 0.8,
  overshootClamping: true,
  reduceMotion: ReduceMotion.Never,
};
const FADE = {
  duration: 180,
  easing: Easing.bezier(0.23, 1, 0.32, 1),
  reduceMotion: ReduceMotion.Never,
};

export function AttachmentSourceChooser({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (source: AttachmentSource) => void;
}) {
  const selected = useRef<AttachmentSource | null>(null);
  const closing = useRef(false);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(1);
  const height = useSharedValue(1);
  const dragStart = useSharedValue(0);
  const dismissing = useSharedValue(false);

  useEffect(() => () => cancelAnimation(progress), [progress]);

  function finishDismissal() {
    const source = selected.current;
    selected.current = null;
    if (source) onSelect(source);
  }

  const completeClose = useCallback(() => {
    onClose();
    // iOS waits for onDismiss before presenting another native controller.
    if (Platform.OS !== 'ios') finishDismissal();
  }, [onClose, onSelect]);

  function close(source: AttachmentSource | null = null) {
    if (closing.current || dismissing.get()) return;
    closing.current = true;
    dismissing.set(true);
    selected.current = source;
    // Browser file dialogs require the original click's user activation.
    if (Platform.OS === 'web' && source) finishDismissal();
    const finished = (done?: boolean) => {
      'worklet';
      if (done) scheduleOnRN(completeClose);
    };
    progress.set(
      reducedMotion ? withTiming(1, FADE, finished) : withSpring(1, SHEET_SPRING, finished),
    );
  }

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-10, 10])
        .maxPointers(1)
        .onStart(() => {
          if (dismissing.get()) return;
          cancelAnimation(progress);
          dragStart.set(progress.get());
        })
        .onUpdate((event) => {
          if (dismissing.get()) return;
          const next = dragStart.get() + event.translationY / height.get();
          progress.set(next >= 0 ? next : (next * 0.55) / (1 + 0.55 * Math.abs(next)));
        })
        .onEnd((event) => {
          if (dismissing.get()) return;
          const velocity = event.velocityY / height.get();
          const projected = progress.get() + ((velocity / 1000) * 0.998) / (1 - 0.998);
          if (projected > 0.4) {
            dismissing.set(true);
            progress.set(
              reducedMotion
                ? withTiming(1, FADE, (done) => {
                    if (done) scheduleOnRN(completeClose);
                  })
                : withSpring(1, { ...SHEET_SPRING, velocity }, (done) => {
                    if (done) scheduleOnRN(completeClose);
                  }),
            );
          } else {
            progress.set(withSpring(0, { ...SHEET_SPRING, velocity }));
          }
        })
        .onFinalize((_event, success) => {
          if (!success && !dismissing.get()) progress.set(withSpring(0, SHEET_SPRING));
        }),
    [completeClose, dismissing, dragStart, height, progress, reducedMotion],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: reducedMotion ? 0 : progress.get() * height.get() }],
    opacity:
      height.get() <= 1 ? 0 : reducedMotion ? 1 - Math.min(1, Math.max(0, progress.get())) : 1,
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, Math.max(0, progress.get())),
  }));

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onShow={() => {
        closing.current = false;
        dismissing.set(false);
        progress.set(1);
        progress.set(reducedMotion ? withTiming(0, FADE) : withSpring(0, SHEET_SPRING));
      }}
      onRequestClose={() => close()}
      onDismiss={finishDismissal}
    >
      <GestureHandlerRootView style={[styles.overlay, { paddingTop: insets.top + 16 }]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessible={false} />
        </Animated.View>
        <Animated.View
          style={[styles.dialog, { paddingBottom: Math.max(insets.bottom, 24) }, sheetStyle]}
          onLayout={(event) => height.set(event.nativeEvent.layout.height)}
          accessibilityViewIsModal
          onAccessibilityEscape={() => close()}
        >
          <GestureDetector gesture={pan}>
            <Animated.View style={styles.header}>
              <View style={styles.handle} accessible={false} />
              <Text accessibilityRole="header" style={styles.title}>
                Add supporting file
              </Text>
              <Text style={styles.subtitle}>Choose where to select your file.</Text>
            </Animated.View>
          </GestureDetector>
          <ScrollView bounces={false} contentContainerStyle={styles.options}>
            {(['photos', 'files'] as const).map((source) => (
              <Pressable
                key={source}
                accessibilityRole="button"
                accessibilityLabel={source === 'photos' ? 'Photo library' : 'Files'}
                onPress={() => close(source)}
                style={({ pressed }) => [
                  styles.option,
                  pressed && { backgroundColor: c.softGreen },
                ]}
              >
                <Icon
                  name={source === 'photos' ? 'images-outline' : 'folder-open-outline'}
                  size={25}
                />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={t.label}>{source === 'photos' ? 'Photo library' : 'Files'}</Text>
                  <Text style={styles.hint}>
                    {source === 'photos' ? 'Choose an image' : 'Images or PDF documents'}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} />
              </Pressable>
            ))}
            <Button label="Cancel" secondary onPress={() => close()} />
          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: { backgroundColor: 'rgba(15, 35, 27, 0.35)' },
  dialog: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: c.background,
    paddingHorizontal: 24,
    overflow: 'hidden',
  },
  header: { paddingTop: 12, paddingBottom: 16, gap: 12 },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.line,
    alignSelf: 'center',
    marginBottom: 12,
  },
  options: { gap: 12 },
  title: { fontSize: 21, fontWeight: '700', color: c.ink },
  subtitle: { fontSize: 14, lineHeight: 21, color: c.muted, marginBottom: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    minHeight: 76,
    borderRadius: 14,
    backgroundColor: '#F0F4EB',
  },
  hint: { fontSize: 12, lineHeight: 18, color: c.muted },
});
