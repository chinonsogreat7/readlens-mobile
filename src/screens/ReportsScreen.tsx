import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { RootStackParams } from '../navigation';
import { reportsRepository } from '../services';
import { useSession } from '../state/session';
import { Badge, Brand, Button, Card, Icon, IconButton, Notice } from '../ui/components';
import { Screen } from '../ui/Screen';
import { ReportsSkeleton } from '../ui/ReportsSkeleton';
import { reportGreeting, reportListState } from '../domain/reports-presentation';
import { colors as c } from '../ui/theme';

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function ReportsScreen({ navigation }: NativeStackScreenProps<RootStackParams, 'Reports'>) {
  const { signOut, user, scope } = useSession();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useInfiniteQuery({
    queryKey: ['reports', scope, debounced],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => reportsRepository.list(debounced, pageParam, 5, signal),
    getNextPageParam: (last) => last.nextPage,
  });
  const searching = search.trim() !== debounced;
  const reports = searching
    ? []
    : Array.from(
        new Map(
          (query.data?.pages.flatMap((page) => page.reports) ?? []).map((report) => [
            report.id,
            report,
          ]),
        ).values(),
      );
  const listState = reportListState({
    searching,
    pending: query.isPending,
    failed: query.isError,
    paused: query.fetchStatus === 'paused',
    hasReports: reports.length > 0,
  });
  const updating = !searching && query.isRefetching && !query.isFetchingNextPage && !refreshing;
  return (
    <Screen scroll={false} backgroundColor={c.background}>
      <View style={styles.topbar}>
        <Brand compact />
        <IconButton name="log-out-outline" label="Sign out" onPress={signOut} />
      </View>
      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onRefresh={async () => {
          if (query.isFetching || searching) return;
          setRefreshing(true);
          try {
            await query.refetch();
          } finally {
            setRefreshing(false);
          }
        }}
        refreshing={refreshing}
        ListHeaderComponent={
          <View>
            <Text style={styles.greeting}>{reportGreeting(user.name)}</Text>
            <Text accessibilityRole="header" style={styles.heading}>
              Your workspace
            </Text>
            <Text style={styles.intro}>Your updates, all in one place.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a new report"
              onPress={() => navigation.navigate('CreateReport')}
              style={({ pressed }) => [styles.createCard, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.createIcon}>
                <Icon name="add" size={25} color={c.lime} />
              </View>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={styles.createTitle}>New report</Text>
                <Text style={styles.createBody}>Capture something that matters.</Text>
              </View>
              <Icon name="arrow-forward" color={c.lime} />
            </Pressable>
            <View style={styles.section}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                {debounced ? 'Search results' : 'Your reports'}
              </Text>
              {updating ? (
                <View
                  style={styles.updating}
                  accessible
                  accessibilityLabel="Updating reports"
                  accessibilityState={{ busy: true }}
                >
                  <ActivityIndicator size="small" color={c.green} />
                  <Text style={styles.meta}>Updating</Text>
                </View>
              ) : listState === 'ready' ? (
                <View style={styles.count}>
                  <Text style={styles.countText}>
                    {reports.length}
                    {query.hasNextPage ? '+' : ''}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.search}>
              <Icon name="search-outline" size={19} color={c.muted} />
              <TextInput
                accessibilityLabel="Search reports"
                placeholder="Search your reports"
                placeholderTextColor={c.muted}
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {!!search && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => setSearch('')}
                  style={{
                    minHeight: 44,
                    width: 44,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Icon name="close-circle" size={18} color={c.muted} />
                </Pressable>
              )}
            </View>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View report: ${item.title}`}
            onPress={() => navigation.navigate('ReportDetail', { id: item.id })}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Card style={{ padding: 18 }}>
              <View style={styles.cardTop}>
                <View style={styles.fileIcon}>
                  <Icon name="document-text-outline" size={20} />
                </View>
                <Badge status={item.status} />
              </View>
              <Text numberOfLines={2} style={styles.reportTitle}>
                {item.title}
              </Text>
              {!!item.description && (
                <Text numberOfLines={2} style={styles.excerpt}>
                  {item.description}
                </Text>
              )}
              <View style={styles.cardBottom}>
                <Text style={styles.meta}>{formatDate(item.createdAt)}</Text>
                {item.attachment && <Icon name="attach" size={15} color={c.muted} />}
                <View style={{ flex: 1 }} />
                <Icon name="arrow-forward" size={17} color={c.muted} />
              </View>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={
          listState === 'loading' ? (
            <ReportsSkeleton />
          ) : listState === 'error' || listState === 'offline' ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Icon
                  name={listState === 'offline' ? 'cloud-offline-outline' : 'alert-circle-outline'}
                  size={28}
                />
              </View>
              <Text accessibilityRole="header" style={styles.emptyTitle}>
                {listState === 'offline' ? 'You’re offline' : 'Couldn’t load reports'}
              </Text>
              <Text accessibilityRole="alert" style={styles.emptyBody}>
                {listState === 'offline'
                  ? 'Reconnect to load your reports. Your workspace will be here.'
                  : query.error?.message}
              </Text>
              <Button
                label="Try again"
                secondary
                onPress={() => {
                  void query.refetch();
                }}
              />
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Icon name={debounced ? 'search-outline' : 'documents-outline'} size={28} />
              </View>
              <Text accessibilityRole="header" style={styles.emptyTitle}>
                {debounced ? 'No matching reports' : 'Your first report starts here'}
              </Text>
              <Text style={styles.emptyBody}>
                {debounced
                  ? 'Try another keyword or clear your search to see all reports.'
                  : 'Tap New report to share an update. You can follow it here once it’s submitted.'}
              </Text>
              {!!debounced && (
                <Button label="Clear search" secondary onPress={() => setSearch('')} />
              )}
            </View>
          )
        }
        ListFooterComponent={
          <View style={{ paddingTop: 20, gap: 12 }}>
            {!searching && reports.length > 0 && query.isRefetchError && (
              <Notice error>
                Refresh failed. Your previously loaded reports are still here. Pull down to try
                again.
              </Notice>
            )}
            {!searching && reports.length > 0 && query.isFetchNextPageError && (
              <Notice error>
                We couldn’t load the next page. Your existing reports are still here.
              </Notice>
            )}
            {query.hasNextPage && !searching ? (
              <Button
                label={query.isFetchNextPageError ? 'Retry loading more' : 'Load more reports'}
                icon="chevron-down"
                secondary
                loading={query.isFetchingNextPage}
                onPress={() => {
                  if (!query.isFetching) void query.fetchNextPage();
                }}
              />
            ) : reports.length > 0 ? (
              <Text style={{ textAlign: 'center', fontSize: 12, color: c.muted, padding: 10 }}>
                You’re all caught up.
              </Text>
            ) : null}
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  content: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 28 },
  greeting: { fontSize: 14, lineHeight: 21, color: c.muted },
  heading: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -1,
    color: c.ink,
    marginTop: 4,
  },
  intro: { fontSize: 14, lineHeight: 22, color: c.muted, marginTop: 6, marginBottom: 24 },
  createCard: {
    backgroundColor: c.greenDark,
    padding: 18,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  createIcon: {
    width: 45,
    height: 45,
    backgroundColor: '#355742',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createTitle: { fontSize: 17, color: '#FFF', fontWeight: '600' },
  createBody: { fontSize: 12, lineHeight: 18, color: '#C5D4C5' },
  section: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 14,
    gap: 12,
  },
  sectionTitle: { fontSize: 20, fontWeight: '600', letterSpacing: -0.5, color: c.ink, flex: 1 },
  updating: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  count: {
    borderRadius: 8,
    backgroundColor: c.softGreen,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  countText: { color: c.green, fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    padding: 24,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: c.softGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    color: c.ink,
    fontSize: 19,
    fontWeight: '600',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  emptyBody: { color: c.muted, fontSize: 14, lineHeight: 22, textAlign: 'center', maxWidth: 280 },
  search: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 13,
    paddingLeft: 15,
    paddingRight: 5,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    minHeight: 50,
    marginBottom: 20,
  },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 15, fontSize: 14, color: c.ink },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: c.ink,
    letterSpacing: -0.4,
    lineHeight: 23,
  },
  excerpt: { fontSize: 13, lineHeight: 20, color: c.muted, marginTop: 8 },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 16,
    marginTop: 15,
    borderTopWidth: 1,
    borderColor: '#EFF2ED',
  },
  meta: { fontSize: 11, color: c.muted },
});
