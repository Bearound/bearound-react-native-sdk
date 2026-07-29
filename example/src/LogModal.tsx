import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  APP_STATE_COLOR,
  APP_STATE_LABEL,
  type AppStateBucket,
  type DetectionLogEntry,
} from './events';

export type LogModalProps = {
  visible: boolean;
  onClose: () => void;
  entries: DetectionLogEntry[];
  onClear: () => void;
};

type Filter = 'all' | AppStateBucket;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'foreground', label: 'Foreground' },
  { key: 'background', label: 'Background' },
  { key: 'backgroundLocked', label: 'BG bloqueado' },
  { key: 'terminated', label: 'Terminated' },
];

const fmt = (ms: number) =>
  new Date(ms).toLocaleTimeString('pt-BR', { hour12: false });

// Per-minute aggregation (mirrors the native iOS DetectionLogView and the
// Flutter example): one row per minute with total, per-state counts and how
// many distinct beacons ("major.minor" parsed from Scan details) were seen.
type ViewMode = 'detail' | 'grouped';

type MinuteGroup = {
  key: number;
  date: Date;
  total: number;
  fg: number;
  bg: number;
  lk: number;
  tm: number;
  uniqueBeacons: number;
};

const BEACON_ID_PATTERN = /\b(\d+\.\d+)\b/g;

function groupByMinute(entries: DetectionLogEntry[]): MinuteGroup[] {
  const buckets = new Map<number, DetectionLogEntry[]>();
  for (const e of entries) {
    const t = new Date(e.timestamp);
    const key = new Date(
      t.getFullYear(),
      t.getMonth(),
      t.getDate(),
      t.getHours(),
      t.getMinutes()
    ).getTime();
    const list = buckets.get(key);
    if (list) {
      list.push(e);
    } else {
      buckets.set(key, [e]);
    }
  }
  const groups: MinuteGroup[] = [];
  for (const [key, list] of buckets) {
    const ids = new Set<string>();
    for (const e of list) {
      if (e.type === 'Scan') {
        for (const m of e.detail.matchAll(BEACON_ID_PATTERN)) {
          ids.add(m[1]!);
        }
      }
    }
    const countOf = (s: AppStateBucket) =>
      list.filter((e) => e.state === s).length;
    groups.push({
      key,
      date: new Date(key),
      total: list.length,
      fg: countOf('foreground'),
      bg: countOf('background'),
      lk: countOf('backgroundLocked'),
      tm: countOf('terminated'),
      uniqueBeacons: ids.size,
    });
  }
  return groups.sort((a, b) => b.key - a.key);
}

const fmtMinute = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function LogModal(props: LogModalProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('detail');

  const counts = {
    foreground: props.entries.filter((e) => e.state === 'foreground').length,
    background: props.entries.filter((e) => e.state === 'background').length,
    backgroundLocked: props.entries.filter(
      (e) => e.state === 'backgroundLocked'
    ).length,
    terminated: props.entries.filter((e) => e.state === 'terminated').length,
  };

  const filtered =
    filter === 'all'
      ? props.entries
      : props.entries.filter((e) => e.state === filter);

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={props.onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Log de Eventos</Text>
          <View style={styles.headerActions}>
            {props.entries.length > 0 ? (
              <Pressable onPress={props.onClear} hitSlop={8}>
                <Text style={styles.clear}>Apagar</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={props.onClose} hitSlop={12}>
              <Text style={styles.close}>Fechar</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <Summary
            label="Foreground"
            value={counts.foreground}
            color="#4caf50"
          />
          <Summary
            label="Background"
            value={counts.background}
            color="#ff9800"
          />
          <Summary
            label="BG🔒"
            value={counts.backgroundLocked}
            color="#607d8b"
          />
          <Summary
            label="Terminated"
            value={counts.terminated}
            color="#9c27b0"
          />
        </View>

        <View style={styles.viewModeRow}>
          {(
            [
              { key: 'detail', label: 'Detalhado' },
              { key: 'grouped', label: 'Por Minuto' },
            ] as Array<{ key: ViewMode; label: string }>
          ).map((m) => {
            const active = viewMode === m.key;
            return (
              <Pressable
                key={m.key}
                style={[
                  styles.viewModeButton,
                  active && styles.viewModeButtonActive,
                ]}
                onPress={() => setViewMode(m.key)}
              >
                <Text
                  style={[
                    styles.viewModeText,
                    active && styles.viewModeTextActive,
                  ]}
                >
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {filtered.length === 0 ? (
            <Text style={styles.empty}>Nenhum evento registrado ainda.</Text>
          ) : viewMode === 'grouped' ? (
            groupByMinute(filtered).map((g) => (
              <View key={g.key} style={styles.minuteRow}>
                <View style={styles.minuteTop}>
                  <Text style={styles.minuteDate}>{fmtMinute(g.date)}</Text>
                  <Text style={styles.minuteTotal}>{g.total} detecções</Text>
                </View>
                <View style={styles.minuteBadges}>
                  {g.fg > 0 && (
                    <CountBadge label="FG" count={g.fg} color="#4caf50" />
                  )}
                  {g.bg > 0 && (
                    <CountBadge label="BG" count={g.bg} color="#ff9800" />
                  )}
                  {g.lk > 0 && (
                    <CountBadge label="LK" count={g.lk} color="#607d8b" />
                  )}
                  {g.tm > 0 && (
                    <CountBadge label="T" count={g.tm} color="#9c27b0" />
                  )}
                  <View style={styles.minuteSpacer} />
                  <Text style={styles.minuteBeacons}>
                    {g.uniqueBeacons} beacon{g.uniqueBeacons === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            filtered.map((entry) => (
              <View key={entry.id} style={styles.row}>
                <View
                  style={[
                    styles.stateDot,
                    { backgroundColor: APP_STATE_COLOR[entry.state] },
                  ]}
                />
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.rowType}>{entry.type}</Text>
                    <Text style={styles.rowTime}>{fmt(entry.timestamp)}</Text>
                  </View>
                  <Text style={styles.rowDetail}>{entry.detail}</Text>
                  <Text
                    style={[
                      styles.rowState,
                      { color: APP_STATE_COLOR[entry.state] },
                    ]}
                  >
                    {APP_STATE_LABEL[entry.state]}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function CountBadge({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <View style={[styles.countBadge, { backgroundColor: `${color}26` }]}>
      <Text style={[styles.countBadgeText, { color }]}>
        {label} {count}
      </Text>
    </View>
  );
}

function Summary({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.summaryItem}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0b0f' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f1f1f',
    backgroundColor: '#111',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  clear: { color: '#ff7675', fontSize: 15, fontWeight: '600' },
  close: { color: '#1e88e5', fontSize: 15, fontWeight: '600' },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 8,
    paddingVertical: 8,
  },
  summaryValue: { fontSize: 20, fontWeight: '700' },
  summaryLabel: { color: '#9e9e9e', fontSize: 10, marginTop: 2 },
  viewModeRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: '#141414',
    padding: 3,
    gap: 3,
  },
  viewModeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewModeButtonActive: { backgroundColor: '#1976d2' },
  viewModeText: { color: '#bdbdbd', fontSize: 12, fontWeight: '600' },
  viewModeTextActive: { color: '#fff' },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: '#0f0f0f',
  },
  filterChipActive: { backgroundColor: '#1976d2', borderColor: '#1976d2' },
  filterChipText: { color: '#bdbdbd', fontSize: 12 },
  filterChipTextActive: { color: '#fff', fontWeight: '600' },
  content: { padding: 16 },
  empty: {
    color: '#9e9e9e',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 24,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    marginRight: 8,
  },
  rowBody: { flex: 1 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowType: { color: '#fff', fontSize: 12, fontWeight: '700' },
  rowTime: {
    color: '#9e9e9e',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  rowDetail: { color: '#bdbdbd', fontSize: 11, marginTop: 2 },
  rowState: { fontSize: 9, fontWeight: '700', marginTop: 2 },
  minuteRow: {
    backgroundColor: '#141414',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  minuteTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  minuteDate: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  minuteTotal: { color: '#bdbdbd', fontSize: 11 },
  minuteBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  minuteSpacer: { flex: 1 },
  minuteBeacons: { color: '#9e9e9e', fontSize: 10 },
  countBadge: {
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  countBadgeText: { fontSize: 9, fontWeight: '700' },
});
