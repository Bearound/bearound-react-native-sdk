import { StyleSheet, Text, View } from 'react-native';

export type EyeKind = 'location' | 'bluetooth';

export type EyeCardProps = {
  eye: EyeKind;
  /** False when the platform has no equivalent (e.g. Bluetooth eye on Android). */
  available: boolean;
  isInZone: boolean;
  lastEnter: number | null;
  lastExit: number | null;
  enterCount: number;
  beaconsNow: number;
  totalDetected: number;
  modeLabel: string;
  modeIsActive: boolean;
  cadenceLabel: string;
  nextScanAt: number | null;
  nowMs: number;
};

const EYE_META: Record<EyeKind, { title: string; color: string; sub: string }> =
  {
    location: {
      title: '👁 Location',
      color: '#4caf50',
      sub: 'CoreLocation region',
    },
    bluetooth: {
      title: '👁 Bluetooth',
      color: '#2196f3',
      sub: 'CBCentralManager BLE',
    },
  };

const fmtClock = (ms: number | null): string =>
  ms == null
    ? '--'
    : new Date(ms).toLocaleTimeString('pt-BR', { hour12: false });

export function EyeCard(props: EyeCardProps) {
  const meta = EYE_META[props.eye];

  if (!props.available) {
    return (
      <View style={[styles.card, styles.cardOff]}>
        <Text style={styles.title}>{meta.title}</Text>
        <Text style={styles.sub}>{meta.sub}</Text>
        <View style={styles.naBox}>
          <Text style={styles.naText}>N/A nesta plataforma</Text>
        </View>
      </View>
    );
  }

  const countdown = (() => {
    if (props.nextScanAt == null) return null;
    const remaining = Math.max(
      0,
      Math.floor((props.nextScanAt - props.nowMs) / 1000)
    );
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  })();

  return (
    <View
      style={[
        styles.card,
        { borderColor: props.isInZone ? meta.color : '#1f1f1f' },
        props.isInZone && { backgroundColor: `${meta.color}14` },
      ]}
    >
      <View style={styles.headerRow}>
        <View
          style={[
            styles.dot,
            { backgroundColor: props.isInZone ? meta.color : '#555' },
          ]}
        />
        <Text style={styles.title}>{meta.title}</Text>
      </View>
      <Text style={styles.sub}>{meta.sub}</Text>

      <View style={styles.zonePill}>
        <Text
          style={[
            styles.zonePillText,
            { color: props.isInZone ? meta.color : '#9e9e9e' },
          ]}
        >
          {props.isInZone ? 'NA ZONA' : 'FORA'}
        </Text>
      </View>

      <Stat label="Agora" value={`${props.beaconsNow}`} />
      <Stat label="Total visto" value={`${props.totalDetected}`} />
      <Stat label="Entradas" value={`${props.enterCount}`} />

      <View style={styles.modeRow}>
        <Text style={styles.statLabel}>Modo</Text>
        <View
          style={[
            styles.modeChip,
            {
              backgroundColor: props.modeIsActive
                ? `${meta.color}22`
                : '#1a1a1a',
              borderColor: props.modeIsActive ? meta.color : '#2a2a2a',
            },
          ]}
        >
          <Text
            style={[
              styles.modeChipText,
              { color: props.modeIsActive ? meta.color : '#9e9e9e' },
            ]}
          >
            {props.modeLabel}
          </Text>
        </View>
      </View>
      <Text style={styles.cadence}>{props.cadenceLabel}</Text>

      {countdown ? (
        <Text style={styles.countdown}>Próx. scan em {countdown}</Text>
      ) : null}

      <View style={styles.divider} />
      <Text style={styles.timeLine}>Entrou: {fmtClock(props.lastEnter)}</Text>
      <Text style={styles.timeLine}>Saiu: {fmtClock(props.lastExit)}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: '#141414',
  },
  cardOff: {
    borderColor: '#1f1f1f',
    opacity: 0.7,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  sub: {
    color: '#9e9e9e',
    fontSize: 10,
    marginTop: 2,
    marginBottom: 8,
  },
  zonePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 10,
  },
  zonePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statLabel: {
    color: '#9e9e9e',
    fontSize: 11,
  },
  statValue: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  modeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  modeChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  modeChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cadence: {
    color: '#9e9e9e',
    fontSize: 10,
    marginTop: 2,
  },
  countdown: {
    color: '#bdbdbd',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#1f1f1f',
    marginVertical: 8,
  },
  timeLine: {
    color: '#9e9e9e',
    fontSize: 10,
  },
  naBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  naText: {
    color: '#9e9e9e',
    fontSize: 11,
    fontStyle: 'italic',
  },
});
