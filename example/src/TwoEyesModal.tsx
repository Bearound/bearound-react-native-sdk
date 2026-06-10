import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EyeCard, type EyeCardProps } from './EyeCard';
import {
  geofenceEventColor,
  geofenceEventTitle,
  type GeofenceEventEntry,
} from './events';

export type TwoEyesModalProps = {
  visible: boolean;
  onClose: () => void;
  nowMs: number;
  location: Omit<EyeCardProps, 'eye' | 'nowMs'>;
  bluetooth: Omit<EyeCardProps, 'eye' | 'nowMs'>;
  events: GeofenceEventEntry[];
  onClearLog: () => void;
};

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString('pt-BR', { hour12: false });

export function TwoEyesModal(props: TwoEyesModalProps) {
  const { location, bluetooth } = props;

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={props.onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>👁 👁 Dois Olhos</Text>
          <Pressable onPress={props.onClose} hitSlop={12}>
            <Text style={styles.close}>Fechar</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.summaryRow}>
            <SummaryBadge
              title="Location"
              color="#4caf50"
              isOn={location.isInZone}
              detail={`${location.beaconsNow} agora`}
            />
            <SummaryBadge
              title="Bluetooth"
              color="#2196f3"
              isOn={bluetooth.isInZone}
              detail={
                bluetooth.available
                  ? `${bluetooth.modeLabel} · ${bluetooth.beaconsNow} agora`
                  : 'iOS-only'
              }
            />
          </View>

          <View style={styles.cardsRow}>
            <EyeCard eye="location" nowMs={props.nowMs} {...location} />
            <EyeCard eye="bluetooth" nowMs={props.nowMs} {...bluetooth} />
          </View>

          {Platform.OS === 'android' ? (
            <View style={styles.note}>
              <Text style={styles.noteText}>
                O modelo de "dois olhos" é exclusivo do iOS. No Android a
                detecção é BLE-only — só o olho de proximidade reflete dados
                reais.
              </Text>
            </View>
          ) : null}

          <View style={styles.legend}>
            <Text style={styles.legendTitle}>Como ler</Text>
            <LegendRow
              color="#4caf50"
              title="Location"
              text="iBeacon region monitoring (kernel level). Funciona mesmo com BT bloqueado no app."
            />
            <LegendRow
              color="#2196f3"
              title="Bluetooth"
              text="Scan BLE ativo. STANDBY = peek de 10s a cada 5min. ATIVO = scan contínuo."
            />
            <LegendRow
              color="#ff9800"
              title="Wake-up"
              text="Quando Location entra na zona, o olho BT acorda pra ATIVO imediatamente."
            />
          </View>

          <View style={styles.eventsHeader}>
            <Text style={styles.eventsTitle}>Eventos ao vivo</Text>
            {props.events.length > 0 ? (
              <Pressable onPress={props.onClearLog} hitSlop={8}>
                <Text style={styles.clear}>Limpar</Text>
              </Pressable>
            ) : null}
          </View>

          {props.events.length === 0 ? (
            <Text style={styles.empty}>
              Nenhum evento ainda — aproxime de um beacon para disparar.
            </Text>
          ) : (
            props.events.slice(0, 20).map((event) => (
              <View key={event.id} style={styles.eventRow}>
                <View
                  style={[
                    styles.eventDot,
                    { backgroundColor: geofenceEventColor(event.kind) },
                  ]}
                />
                <View style={styles.eventBody}>
                  <View style={styles.eventTop}>
                    <Text
                      style={[
                        styles.eventTitle,
                        { color: geofenceEventColor(event.kind) },
                      ]}
                    >
                      {geofenceEventTitle(event.kind)}
                    </Text>
                    <Text style={styles.eventTime}>
                      {fmtTime(event.timestamp)}
                    </Text>
                  </View>
                  <Text style={styles.eventDetail}>{event.detail}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function SummaryBadge({
  title,
  color,
  isOn,
  detail,
}: {
  title: string;
  color: string;
  isOn: boolean;
  detail: string;
}) {
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: isOn ? `${color}1f` : 'rgba(255,255,255,0.05)' },
      ]}
    >
      <View style={styles.badgeHeader}>
        <View
          style={[styles.badgeDot, { backgroundColor: isOn ? color : '#555' }]}
        />
        <Text style={styles.badgeTitle}>{title}</Text>
      </View>
      <Text style={styles.badgeDetail}>{detail}</Text>
    </View>
  );
}

function LegendRow({
  color,
  title,
  text,
}: {
  color: string;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <View style={styles.legendBody}>
        <Text style={styles.legendName}>{title}</Text>
        <Text style={styles.legendText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0f',
  },
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
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  close: {
    color: '#1e88e5',
    fontSize: 15,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
  },
  badgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  badgeTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  badgeDetail: {
    color: '#9e9e9e',
    fontSize: 10,
    marginTop: 2,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  note: {
    backgroundColor: '#141414',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    padding: 12,
    marginBottom: 16,
  },
  noteText: {
    color: '#bdbdbd',
    fontSize: 12,
  },
  legend: {
    backgroundColor: '#141414',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  legendTitle: {
    color: '#bdbdbd',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    marginRight: 8,
  },
  legendBody: {
    flex: 1,
  },
  legendName: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  legendText: {
    color: '#9e9e9e',
    fontSize: 11,
    marginTop: 1,
  },
  eventsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventsTitle: {
    color: '#bdbdbd',
    fontSize: 12,
    fontWeight: '600',
  },
  clear: {
    color: '#9e9e9e',
    fontSize: 12,
  },
  empty: {
    color: '#9e9e9e',
    fontSize: 11,
    fontStyle: 'italic',
    paddingVertical: 12,
    textAlign: 'center',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    marginRight: 8,
  },
  eventBody: {
    flex: 1,
  },
  eventTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  eventTime: {
    color: '#9e9e9e',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  eventDetail: {
    color: '#bdbdbd',
    fontSize: 11,
    marginTop: 2,
  },
});
