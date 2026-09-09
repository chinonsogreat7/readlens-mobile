import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors as c } from './theme';
import { Brand, IconButton } from './components';
import { demoMode } from '../state/session';

export function Screen({
  children,
  scroll = true,
  backgroundColor = '#EAF0E8',
  keyboardVerticalOffset = 0,
}: PropsWithChildren<{
  scroll?: boolean;
  backgroundColor?: string;
  keyboardVerticalOffset?: number;
}>) {
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]}>
      <View style={styles.frame}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={keyboardVerticalOffset}
        >
          {scroll ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              contentContainerStyle={styles.content}
            >
              {children}
            </ScrollView>
          ) : (
            children
          )}
        </KeyboardAvoidingView>
        {demoMode && (
          <View style={styles.preview}>
            <View style={styles.dot} />
            <Text style={styles.previewText}>LOCAL PREVIEW · SAMPLE DATA</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

export function PageHeader({
  title,
  back,
  action,
}: {
  title?: string;
  back?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      {back ? (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <IconButton name="arrow-back" label="Go back" onPress={back} />
          <Text style={{ fontSize: 16, fontWeight: '600', color: c.ink }}>{title}</Text>
        </View>
      ) : (
        <Brand compact />
      )}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#EAF0E8' },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: c.background,
  },
  content: { padding: 24, paddingBottom: 32, flexGrow: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 28,
    minHeight: 72,
  },
  preview: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderColor: c.line,
    backgroundColor: c.background,
  },
  previewText: { fontSize: 9, letterSpacing: 1.5, fontWeight: '600', color: c.muted },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#789C55' },
});
