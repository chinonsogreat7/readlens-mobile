import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParams } from '../navigation';
import { secureAttachmentUrl } from '../api/reports';
import { ZoomableImage } from '../ui/ZoomableImage';
import { PdfAttachment } from '../ui/PdfAttachment';
import { Icon } from '../ui/components';

export function MediaViewerScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParams, 'MediaViewer'>) {
  const { attachment } = route.params;
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const onError = useCallback(() => setFailed(true), []);
  let uri: string | undefined;
  try {
    uri = secureAttachmentUrl(attachment.uri);
  } catch {
    /* Never render an unsafe route URL. */
  }
  return (
    <GestureHandlerRootView style={styles.screen}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <SafeAreaView style={styles.screen}>
          <StatusBar style="light" />
          <View style={styles.header}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
                {attachment.name}
              </Text>
              <Text style={styles.subtitle}>
                {attachment.type === 'PDF' ? 'Document' : 'Photo'} · {attachment.type}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close attachment viewer"
              onPress={() => navigation.goBack()}
              style={({ pressed }) => [styles.close, pressed && { opacity: 0.6 }]}
            >
              <Icon name="close" color="white" size={24} />
            </Pressable>
          </View>
          {!uri || failed ? (
            <View style={styles.error}>
              <Icon name="document-outline" color="#BFCBC4" size={36} />
              <Text style={styles.title}>Couldn’t load this attachment</Text>
              <Text style={[styles.subtitle, { textAlign: 'center', lineHeight: 22 }]}>
                {uri
                  ? 'Check your connection and try again. Your report is still saved.'
                  : 'The attachment link is unavailable. Return to the report and refresh it.'}
              </Text>
              {uri && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setFailed(false);
                    setAttempt((value) => value + 1);
                  }}
                  style={styles.retry}
                >
                  <Text style={styles.title}>Try again</Text>
                </Pressable>
              )}
            </View>
          ) : attachment.type === 'PDF' ? (
            <PdfAttachment key={attempt} uri={uri} onError={onError} />
          ) : (
            <ZoomableImage key={attempt} uri={uri} name={attachment.name} onError={onError} />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111A16' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  title: { color: '#F7FAF8', fontSize: 16, fontWeight: '600' },
  subtitle: { color: '#BFCBC4', fontSize: 12 },
  close: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#26312D',
  },
  error: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  retry: {
    minHeight: 48,
    paddingHorizontal: 28,
    borderRadius: 24,
    backgroundColor: '#26312D',
    justifyContent: 'center',
  },
});
