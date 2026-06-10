import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaxQueuedPayloads, ScanPrecision } from '@bearound/react-native-sdk';

export type SettingsModalProps = {
  visible: boolean;
  onClose: () => void;
  scanPrecision: ScanPrecision;
  maxQueuedPayloads: MaxQueuedPayloads;
  sdkVersion: string;
  onChangePrecision: (value: ScanPrecision) => void;
  onChangeQueue: (value: MaxQueuedPayloads) => void;
  onApply: () => void;
};

const PRECISIONS: Array<{ key: ScanPrecision; label: string }> = [
  { key: ScanPrecision.HIGH, label: 'Alta' },
  { key: ScanPrecision.MEDIUM, label: 'Média' },
  { key: ScanPrecision.LOW, label: 'Baixa' },
];

const QUEUES: Array<{ key: MaxQueuedPayloads; label: string }> = [
  { key: MaxQueuedPayloads.SMALL, label: '50' },
  { key: MaxQueuedPayloads.MEDIUM, label: '100' },
  { key: MaxQueuedPayloads.LARGE, label: '200' },
  { key: MaxQueuedPayloads.XLARGE, label: '500' },
];

export function SettingsModal(props: SettingsModalProps) {
  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={props.onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Configurações do SDK</Text>
          <Pressable onPress={props.onClose} hitSlop={12}>
            <Text style={styles.close}>Fechar</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.label}>Precisão do scan</Text>
          <View style={styles.chipRow}>
            {PRECISIONS.map((option) => {
              const active = props.scanPrecision === option.key;
              return (
                <Pressable
                  key={option.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => props.onChangePrecision(option.key)}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Máx. payloads na fila</Text>
          <View style={styles.chipRow}>
            {QUEUES.map((option) => {
              const active = props.maxQueuedPayloads === option.key;
              return (
                <Pressable
                  key={option.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => props.onChangeQueue(option.key)}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>Versão do SDK nativo</Text>
            <Text style={styles.versionValue}>
              {props.sdkVersion || '— (indisponível)'}
            </Text>
          </View>

          <Pressable style={styles.apply} onPress={props.onApply}>
            <Text style={styles.applyText}>Aplicar configurações</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
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
  label: {
    color: '#bdbdbd',
    marginBottom: 8,
    marginTop: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#0f0f0f',
  },
  chipActive: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  chipText: {
    color: '#bdbdbd',
    fontSize: 12,
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 16,
  },
  versionLabel: {
    color: '#9e9e9e',
  },
  versionValue: {
    color: '#fff',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  apply: {
    backgroundColor: '#1565c0',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  applyText: {
    color: '#fff',
    fontWeight: '700',
  },
});
