import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { clampPan, fitImage, panLimit, resistPan } from '../domain/media-geometry';
import { Icon } from './components';

const settle = {
  duration: 400,
  dampingRatio: 1,
  overshootClamping: true,
  reduceMotion: ReduceMotion.System,
};

export function ZoomableImage({
  uri,
  name,
  onError,
}: {
  uri: string;
  name: string;
  onError: () => void;
}) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [intrinsic, setIntrinsic] = useState({ width: 1, height: 1 });
  const [loaded, setLoaded] = useState(false);
  const fitted = fitImage(intrinsic.width, intrinsic.height, viewport.width, viewport.height);
  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const anchorX = useSharedValue(0);
  const anchorY = useSharedValue(0);

  useEffect(() => {
    scale.set(1);
    x.set(0);
    y.set(0);
  }, [viewport.width, viewport.height, uri, scale, x, y]);

  const gesture = useMemo(() => {
    const pinch = Gesture.Pinch()
      .enabled(loaded)
      .onStart((event) => {
        cancelAnimation(scale);
        cancelAnimation(x);
        cancelAnimation(y);
        startScale.set(scale.get());
        startX.set(x.get());
        startY.set(y.get());
        anchorX.set(event.focalX - viewport.width / 2);
        anchorY.set(event.focalY - viewport.height / 2);
      })
      .onUpdate((event) => {
        const next = Math.max(1, Math.min(4, startScale.get() * event.scale));
        const ratio = next / startScale.get();
        scale.set(next);
        x.set(
          clampPan(
            event.focalX - viewport.width / 2 - (anchorX.get() - startX.get()) * ratio,
            panLimit(fitted.width, viewport.width, next),
          ),
        );
        y.set(
          clampPan(
            event.focalY - viewport.height / 2 - (anchorY.get() - startY.get()) * ratio,
            panLimit(fitted.height, viewport.height, next),
          ),
        );
      });
    const pan = Gesture.Pan()
      .enabled(loaded)
      .maxPointers(1)
      .minDistance(4)
      .onStart(() => {
        cancelAnimation(x);
        cancelAnimation(y);
        startX.set(x.get());
        startY.set(y.get());
      })
      .onUpdate((event) => {
        if (scale.get() <= 1) return;
        x.set(
          resistPan(
            startX.get() + event.translationX,
            panLimit(fitted.width, viewport.width, scale.get()),
            viewport.width,
          ),
        );
        y.set(
          resistPan(
            startY.get() + event.translationY,
            panLimit(fitted.height, viewport.height, scale.get()),
            viewport.height,
          ),
        );
      })
      .onEnd((event) => {
        x.set(
          withSpring(clampPan(x.get(), panLimit(fitted.width, viewport.width, scale.get())), {
            ...settle,
            velocity: event.velocityX,
          }),
        );
        y.set(
          withSpring(clampPan(y.get(), panLimit(fitted.height, viewport.height, scale.get())), {
            ...settle,
            velocity: event.velocityY,
          }),
        );
      });
    const doubleTap = Gesture.Tap()
      .enabled(loaded)
      .numberOfTaps(2)
      .onEnd((event, success) => {
        if (!success) return;
        const next = scale.get() > 1 ? 1 : 3;
        x.set(
          withSpring(
            clampPan(
              (viewport.width / 2 - event.x) * (next - 1),
              panLimit(fitted.width, viewport.width, next),
            ),
            settle,
          ),
        );
        y.set(
          withSpring(
            clampPan(
              (viewport.height / 2 - event.y) * (next - 1),
              panLimit(fitted.height, viewport.height, next),
            ),
            settle,
          ),
        );
        scale.set(withSpring(next, settle));
      });
    return Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));
  }, [
    loaded,
    fitted.width,
    fitted.height,
    viewport.width,
    viewport.height,
    scale,
    x,
    y,
    startScale,
    startX,
    startY,
    anchorX,
    anchorY,
  ]);
  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }],
  }));
  function zoom(direction: number) {
    const next = direction === 0 ? 1 : Math.max(1, Math.min(4, scale.get() + direction));
    x.set(withSpring(clampPan(x.get(), panLimit(fitted.width, viewport.width, next)), settle));
    y.set(withSpring(clampPan(y.get(), panLimit(fitted.height, viewport.height, next)), settle));
    scale.set(withSpring(next, settle));
  }
  return (
    <View style={{ flex: 1 }}>
      <GestureDetector gesture={gesture}>
        <View
          collapsable={false}
          style={styles.viewport}
          onLayout={(event) => setViewport(event.nativeEvent.layout)}
        >
          <Animated.Image
            accessibilityLabel={name}
            source={{ uri }}
            resizeMode="contain"
            style={[{ width: fitted.width, height: fitted.height }, imageStyle]}
            onLoad={(event) => {
              setIntrinsic(event.nativeEvent.source);
              setLoaded(true);
            }}
            onError={onError}
          />
          {!loaded && (
            <ActivityIndicator
              accessibilityLabel="Loading image"
              color="white"
              style={StyleSheet.absoluteFill}
            />
          )}
        </View>
      </GestureDetector>
      <View style={styles.tools}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zoom out"
          disabled={!loaded}
          onPress={() => zoom(-1)}
          style={styles.control}
        >
          <Icon name="remove" color="white" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset image zoom"
          disabled={!loaded}
          onPress={() => zoom(0)}
          style={styles.control}
        >
          <Text style={{ color: 'white', fontSize: 14 }}>Reset</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zoom in"
          disabled={!loaded}
          onPress={() => zoom(1)}
          style={styles.control}
        >
          <Icon name="add" color="white" />
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  viewport: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tools: { flexDirection: 'row', justifyContent: 'center', gap: 16, padding: 12 },
  control: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#26312D',
    paddingHorizontal: 16,
  },
});
