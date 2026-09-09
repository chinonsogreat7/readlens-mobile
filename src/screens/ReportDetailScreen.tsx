import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import type { RootStackParams } from '../navigation';
import { reportsRepository } from '../services';
import { demoMode } from '../config';
import { useSession } from '../state/session';
import { errorMessage } from '../api/contracts';
import { Badge, Button, Card, Icon, IconButton, Notice } from '../ui/components';
import { Screen } from '../ui/Screen';
import { colors as c } from '../ui/theme';
import { formatDate } from './ReportsScreen';

export function ReportDetailScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParams, 'ReportDetail'>) {
  const { scope } = useSession();
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [pollUntil, setPollUntil] = useState(Date.now() + 60_000);
  const [fileError, setFileError] = useState<string>();
  const [uploadBusy, setUploadBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setActive(state === 'active'),
    );
    return () => {
      subscription.remove();
      pending.current?.abort();
    };
  }, []);
  const query = useQuery({
    queryKey: ['report', scope, route.params.id],
    queryFn: ({ signal }) => reportsRepository.detail(route.params.id, signal),
    refetchInterval: (state) => {
      const job = reportsRepository.getUpload(route.params.id);
      return !demoMode &&
        focused &&
        active &&
        Date.now() < pollUntil &&
        !state.state.error &&
        !state.state.data?.attachment &&
        !state.state.data?.attachmentError &&
        job?.state === 'processing'
        ? 3000
        : false;
    },
    refetchIntervalInBackground: false,
  });
  const report = query.data;
  const job = reportsRepository.getUpload(route.params.id);
  useEffect(() => setPreviewFailed(false), [report?.attachment?.uri]);
  async function refreshReport() {
    if (query.isFetching) return;
    setRefreshing(true);
    setPollUntil(Date.now() + 60_000);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }
  async function retryUpload() {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setUploadBusy(true);
    setFileError(undefined);
    try {
      await reportsRepository.retryUpload(route.params.id, controller.signal);
      setPollUntil(Date.now() + 60_000);
      await query.refetch();
    } catch (error) {
      if (!controller.signal.aborted) setFileError(errorMessage(error));
    } finally {
      pending.current = null;
      setUploadBusy(false);
    }
  }
  function openFile() {
    if (!report?.attachment) return;
    navigation.navigate('MediaViewer', { attachment: report.attachment });
  }
  return (
    <Screen scroll={false} backgroundColor={c.background}>
      <View style={styles.header}>
        <IconButton
          name="arrow-back"
          label="Back to reports"
          onPress={() => navigation.popToTop()}
        />
        <Text accessibilityRole="header" style={styles.headerTitle}>
          Report details
        </Text>
        <View style={{ flex: 1 }} />
        {!demoMode && (
          <IconButton
            name="refresh-outline"
            label="Refresh report"
            onPress={() => void refreshReport()}
          />
        )}
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          !demoMode ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void refreshReport()}
              tintColor={c.green}
            />
          ) : undefined
        }
      >
        {route.params.justCreated && (
          <View style={styles.saved}>
            <Icon name="checkmark-circle" size={17} />
            <Text style={styles.savedText}>
              {demoMode ? 'Sample report created' : 'Report saved'}
            </Text>
          </View>
        )}
        {query.isPending ? (
          <View
            accessible
            accessibilityLabel="Loading report details"
            accessibilityState={{ busy: true }}
            style={{ gap: 18 }}
          >
            <View style={[styles.skeleton, { width: 85, height: 24 }]} />
            <View style={[styles.skeleton, { width: '75%', height: 30 }]} />
            <View style={[styles.skeleton, { width: '40%', height: 14 }]} />
            <View style={styles.panel}>
              <View style={[styles.skeleton, { width: '35%', height: 14 }]} />
              {[0, 1, 2].map((line) => (
                <View
                  key={line}
                  style={[styles.skeleton, { height: 12, width: line === 2 ? '60%' : '100%' }]}
                />
              ))}
            </View>
            <View style={[styles.skeleton, { height: 65 }]} />
          </View>
        ) : !report ? (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Couldn’t load this report</Text>
            <Notice error>{query.error?.message ?? 'Report not found.'}</Notice>
            <Button
              label="Try again"
              secondary
              onPress={() => {
                void query.refetch();
              }}
            />
          </View>
        ) : (
          <>
            {query.isRefetchError && (
              <Notice error>
                We couldn’t refresh this report. The last loaded information is shown.
              </Notice>
            )}
            <View style={{ gap: 12 }}>
              <View style={styles.statusRow}>
                <Badge status={report.status} />
                <Text style={styles.meta}>{formatDate(report.createdAt)}</Text>
              </View>
              <Text selectable accessibilityRole="header" style={styles.title}>
                {report.title}
              </Text>
            </View>
            <View style={styles.author}>
              <View style={styles.authorIcon}>
                <Icon name="person-outline" size={20} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.authorName}>{report.author.name}</Text>
                {!!report.author.email && (
                  <Text selectable style={styles.meta}>
                    {report.author.email}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.panel}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Description
              </Text>
              <Text selectable style={styles.body}>
                {report.description}
              </Text>
            </View>
          </>
        )}
        {(report || job) && (
          <View style={{ gap: 12 }}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Attachment
            </Text>
            {report?.attachment ? (
              <Card style={{ padding: 16, gap: 16 }}>
                <View style={styles.fileRow}>
                  <View style={styles.authorIcon}>
                    <Icon name="document-attach-outline" size={22} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={styles.authorName}>{report.attachment.name}</Text>
                    <Text style={styles.meta}>
                      {report.attachment.type}
                      {demoMode ? ' · Local preview' : ''}
                    </Text>
                  </View>
                </View>
                {report.attachment.type !== 'PDF' && !previewFailed && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="View attachment full screen"
                    onPress={openFile}
                  >
                    <Image
                      accessibilityLabel={`Attachment: ${report.attachment.name}`}
                      source={{ uri: report.attachment.uri }}
                      style={styles.preview}
                      resizeMode="contain"
                      onError={() => setPreviewFailed(true)}
                    />
                  </Pressable>
                )}
                {previewFailed && (
                  <Text style={styles.body}>
                    Preview unavailable. You can still try opening the file.
                  </Text>
                )}
                <Button
                  label="View attachment"
                  icon="expand-outline"
                  secondary
                  onPress={() => void openFile()}
                />
              </Card>
            ) : report?.attachmentError ? (
              <View style={[styles.panel, styles.failed]}>
                <View style={styles.fileRow}>
                  <Icon name="alert-circle-outline" color={c.error} />
                  <Text style={[styles.authorName, { color: c.error }]}>
                    Attachment unavailable
                  </Text>
                </View>
                <Text style={styles.body}>{report.attachmentError}</Text>
              </View>
            ) : job ? (
              <View style={[styles.panel, job.state === 'failed' && styles.failed]}>
                <View style={styles.fileRow}>
                  <Icon
                    name={job.state === 'failed' ? 'alert-circle-outline' : 'cloud-upload-outline'}
                    color={job.state === 'failed' ? c.error : c.green}
                  />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[styles.authorName, job.state === 'failed' && { color: c.error }]}>
                      {uploadBusy || job.state === 'uploading'
                        ? 'Uploading attachment…'
                        : job.state === 'processing'
                          ? 'Upload received'
                          : 'Attachment not uploaded'}
                    </Text>
                    <Text numberOfLines={2} style={styles.meta}>
                      {job.attachment.name}
                    </Text>
                  </View>
                </View>
                <Text style={styles.body}>
                  {job.state === 'failed'
                    ? job.ticket
                      ? 'Your report is saved. Retry uploading this file—there’s no need to submit the report again.'
                      : 'Your report is saved, but its upload link is unavailable. Contact the assessment team to recover the attachment.'
                    : job.state === 'processing'
                      ? 'The file was uploaded. We’re waiting for it to appear on your report. Pull down to check again.'
                      : 'Please keep this screen open until the upload finishes.'}
                </Text>
                {(job.state === 'failed' || uploadBusy) && job.ticket && (
                  <Button
                    label={uploadBusy ? 'Uploading…' : 'Retry upload'}
                    secondary
                    loading={uploadBusy}
                    onPress={() => void retryUpload()}
                  />
                )}
              </View>
            ) : (
              <View style={styles.noFile}>
                <Icon name="document-outline" color={c.muted} size={22} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.authorName}>No attachment available</Text>
                  <Text style={styles.meta}>There’s no file to open on this report.</Text>
                </View>
              </View>
            )}
            {fileError && <Notice error>{fileError}</Notice>}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '600', color: c.ink },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32, gap: 24 },
  saved: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  savedText: { fontSize: 13, color: c.green, fontWeight: '500' },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { fontSize: 28, lineHeight: 36, letterSpacing: -0.7, fontWeight: '700', color: c.ink },
  author: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  authorIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: c.softGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorName: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: c.ink },
  meta: { fontSize: 12, lineHeight: 18, color: c.muted },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: c.ink },
  body: { fontSize: 14, lineHeight: 23, color: '#43564C' },
  panel: {
    padding: 20,
    gap: 14,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 18,
  },
  failed: { backgroundColor: c.softError, borderColor: c.errorBorder },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  preview: { width: '100%', height: 210, borderRadius: 12, backgroundColor: c.background },
  noFile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#EEF1EB',
  },
  skeleton: { backgroundColor: '#E2E8DF', borderRadius: 8 },
});
