import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { colors as c } from './theme';

const pulse = { '0%': { opacity: 0.55 }, '50%': { opacity: 1 }, '100%': { opacity: 0.55 } };

export function ReportsSkeleton() {
  const reducedMotion = useReducedMotion();
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setActive(state === 'active'),
    );
    return () => subscription.remove();
  }, []);

  return (
    <View accessible accessibilityLabel="Loading reports" accessibilityState={{ busy: true }}>
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.stack,
          !reducedMotion && {
            animationName: pulse,
            // This is a gentle repeating loading pulse, not a delayed UI transition.
            animationDuration: '1600ms',
            animationTimingFunction: cubicBezier(0.77, 0, 0.175, 1),
            animationIterationCount: 'infinite',
            animationPlayState: active && focused ? 'running' : 'paused',
          },
        ]}
      >
        {[0, 1, 2].map((index) => (
          <View key={index} style={styles.card}>
            <View style={styles.row}>
              <View style={[styles.block, styles.icon]} />
              <View style={[styles.block, { width: 72, height: 22 }]} />
            </View>
            <View style={[styles.block, { width: index === 1 ? '62%' : '78%', height: 18 }]} />
            <View style={[styles.block, { width: '94%', height: 12, marginTop: 12 }]} />
            <View style={styles.footer}>
              <View style={[styles.block, { width: 92, height: 11 }]} />
              <View style={[styles.block, { width: 20, height: 11 }]} />
            </View>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  card: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  block: { backgroundColor: '#DFE6DC', borderRadius: 6 },
  icon: { width: 34, height: 34, borderRadius: 10 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: c.line,
    marginTop: 18,
    paddingTop: 16,
  },
});
