import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as BeAround from '@bearound/react-native-sdk';
import {
  addBeaconsListener,
  addErrorListener,
  addScanningListener,
  addSyncStatusListener,
  checkPermissions,
  ensurePermissions,
  type Beacon,
  type BeaconProximity,
  type PermissionResult,
} from '@bearound/react-native-sdk';

type SortOption = 'proximity' | 'id';

const intervalOptions = [5, 10, 15, 20, 30, 60];
const sortOptions: Array<{ key: SortOption; label: string }> = [
  { key: 'proximity', label: 'Proximidade' },
  { key: 'id', label: 'ID' },
];

const sortBeacons = (beacons: Beacon[], option: SortOption) => {
  if (option === 'id') {
    return [...beacons].sort((a, b) =>
      `${a.major}.${a.minor}`.localeCompare(`${b.major}.${b.minor}`)
    );
  }

  const proximityRank = (value: BeaconProximity) => {
    switch (value) {
      case 'immediate':
        return 0;
      case 'near':
        return 1;
      case 'far':
        return 2;
      default:
        return 3;
    }
  };

  return [...beacons].sort((a, b) => {
    const rank = proximityRank(a.proximity) - proximityRank(b.proximity);
    if (rank !== 0) {
      return rank;
    }
    if (a.rssi !== b.rssi) {
      return b.rssi - a.rssi;
    }
    const aAccuracy = a.accuracy > 0 ? a.accuracy : Number.MAX_SAFE_INTEGER;
    const bAccuracy = b.accuracy > 0 ? b.accuracy : Number.MAX_SAFE_INTEGER;
    return aAccuracy - bAccuracy;
  });
};

const proximityLabel = (value: BeaconProximity) => {
  switch (value) {
    case 'immediate':
      return 'Imediato';
    case 'near':
      return 'Perto';
    case 'far':
      return 'Longe';
    default:
      return 'Desconhecido';
  }
};

const proximityColor = (value: BeaconProximity) => {
  switch (value) {
    case 'immediate':
      return '#4caf50';
    case 'near':
      return '#ff9800';
    case 'far':
      return '#f44336';
    default:
      return '#9e9e9e';
  }
};

const formatTime = (date: Date) =>
  date.toLocaleTimeString('pt-BR', { hour12: false });

export default function App() {
  const [currentSyncInterval, setCurrentSyncInterval] = useState(30);
  const [enableBluetoothScanning, setEnableBluetoothScanning] = useState(true);
  const [enablePeriodicScanning, setEnablePeriodicScanning] = useState(true);
  const [sortOption, setSortOption] = useState<SortOption>('proximity');
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState({
    location: 'Verificando...',
    bluetooth: 'Verificando...',
    notifications: 'Verificando...',
  });
  const [statusMessage, setStatusMessage] = useState('Pronto');
  const [secondsUntilNextSync, setSecondsUntilNextSync] = useState(0);
  const [isRanging, setIsRanging] = useState(false);
  const [beacons, setBeacons] = useState<Beacon[]>([]);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const scanDuration = useMemo(() => {
    const calculated = currentSyncInterval / 3;
    return Math.max(5, Math.min(calculated, 10));
  }, [currentSyncInterval]);

  const pauseDuration = useMemo(
    () => Math.max(0, currentSyncInterval - scanDuration),
    [currentSyncInterval, scanDuration]
  );

  const scanMode = useMemo(() => {
    if (!enablePeriodicScanning) {
      return 'Contínuo';
    }
    return pauseDuration > 0 ? 'Periódico' : 'Contínuo';
  }, [enablePeriodicScanning, pauseDuration]);

  const sortedBeacons = useMemo(
    () => sortBeacons(beacons, sortOption),
    [beacons, sortOption]
  );

  const updatePermissionStatus = useCallback((status: PermissionResult) => {
    const ok =
      Platform.OS === 'android'
        ? status.fineLocation &&
          status.btScan &&
          status.btConnect &&
          status.notifications &&
          status.backgroundLocation
        : status.fineLocation;

    setHasPermissions(ok);

    const locationStatus = status.fineLocation
      ? Platform.OS === 'android' && status.backgroundLocation
        ? 'Sempre (Background habilitado)'
        : 'Quando em uso'
      : 'Negada (SDK não funcionará)';

    const bluetoothStatus =
      Platform.OS === 'android'
        ? status.btScan && status.btConnect
          ? 'Autorizado'
          : 'Não autorizado'
        : status.fineLocation
          ? 'Autorizado'
          : 'Indisponível';

    const notificationStatus =
      Platform.OS === 'android'
        ? status.notifications
          ? 'Autorizada'
          : 'Negada'
        : 'Indisponível';

    setPermissionStatus({
      location: locationStatus,
      bluetooth: bluetoothStatus,
      notifications: notificationStatus,
    });

    return ok;
  }, []);

  const refreshPermissions = useCallback(async () => {
    const status = await checkPermissions();
    return updatePermissionStatus(status);
  }, [updatePermissionStatus]);

  const requestPermissions = useCallback(async () => {
    const status = await ensurePermissions({ askBackground: true });
    const ok = updatePermissionStatus(status);

    if (!ok) {
      Alert.alert(
        'Permissões',
        'Algumas permissões ainda não foram concedidas.'
      );
    }

    return ok;
  }, [updatePermissionStatus]);

  const configureSdk = useCallback(
    async (
      overrides: Partial<{
        syncInterval: number;
        enableBluetoothScanning: boolean;
        enablePeriodicScanning: boolean;
      }> = {}
    ) => {
      setLastError(null);
      const config = {
        syncInterval: currentSyncInterval,
        enableBluetoothScanning,
        enablePeriodicScanning,
        ...overrides,
      };

      try {
        await BeAround.configure(config);
        setStatusMessage('Configurado');
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Erro ao configurar';
        setLastError(message);
        setStatusMessage(`Erro: ${message}`);
        throw error;
      }
    },
    [currentSyncInterval, enableBluetoothScanning, enablePeriodicScanning]
  );

  const startScan = useCallback(async () => {
    setLastError(null);
    const ok = await requestPermissions();
    if (!ok) {
      return;
    }

    try {
      await configureSdk();
      await BeAround.startScanning();
      const scanning = await BeAround.isScanning();
      setIsScanning(scanning);
      setStatusMessage(scanning ? 'Scaneando...' : 'Parado');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erro ao iniciar';
      setLastError(message);
      setStatusMessage(`Erro: ${message}`);
    }
  }, [configureSdk, requestPermissions]);

  const stopScan = useCallback(async () => {
    setLastError(null);
    try {
      await BeAround.stopScanning();
      setIsScanning(false);
      setBeacons([]);
      setSecondsUntilNextSync(0);
      setIsRanging(false);
      setStatusMessage('Parado');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao parar';
      setLastError(message);
      setStatusMessage(`Erro: ${message}`);
    }
  }, []);

  useEffect(() => {
    refreshPermissions();
    BeAround.isScanning()
      .then((scanning) => setIsScanning(scanning))
      .catch(() => null);

    const beaconsSub = addBeaconsListener((items) => {
      setBeacons(items);
      setLastScanTime(new Date());
      if (items.length === 0) {
        setStatusMessage('Scaneando...');
      } else {
        setStatusMessage(
          `${items.length} beacon${items.length === 1 ? '' : 's'}`
        );
      }
    });

    const syncSub = addSyncStatusListener((status) => {
      setSecondsUntilNextSync(status.secondsUntilNextSync);
      setIsRanging(status.isRanging);
    });

    const scanningSub = addScanningListener((scanning) => {
      setIsScanning(scanning);
      setStatusMessage(scanning ? 'Scaneando...' : 'Parado');
      if (!scanning) {
        setBeacons([]);
        setSecondsUntilNextSync(0);
        setIsRanging(false);
      }
    });

    const errorSub = addErrorListener((error) => {
      setLastError(error.message);
      setStatusMessage(`Erro: ${error.message}`);
    });

    return () => {
      beaconsSub.remove();
      syncSub.remove();
      scanningSub.remove();
      errorSub.remove();
    };
  }, [refreshPermissions]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>BeAroundScan</Text>
        <Text style={styles.appBarSubtitle}>{statusMessage}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {lastError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{lastError}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permissões</Text>
          <View style={styles.permissionRow}>
            <View style={styles.permissionLabel}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: permissionColor(permissionStatus.location),
                  },
                ]}
              />
              <Text style={styles.permissionText}>Localização</Text>
            </View>
            <Text
              style={[
                styles.permissionValue,
                { color: permissionColor(permissionStatus.location) },
              ]}
            >
              {permissionStatus.location}
            </Text>
          </View>
          <View style={styles.permissionRow}>
            <View style={styles.permissionLabel}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: permissionColor(
                      permissionStatus.bluetooth
                    ),
                  },
                ]}
              />
              <Text style={styles.permissionText}>Bluetooth</Text>
            </View>
            <Text
              style={[
                styles.permissionValue,
                { color: permissionColor(permissionStatus.bluetooth) },
              ]}
            >
              {permissionStatus.bluetooth}
            </Text>
          </View>
          <View style={styles.permissionRow}>
            <View style={styles.permissionLabel}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: permissionColor(
                      permissionStatus.notifications
                    ),
                  },
                ]}
              />
              <Text style={styles.permissionText}>Notificações</Text>
            </View>
            <Text
              style={[
                styles.permissionValue,
                { color: permissionColor(permissionStatus.notifications) },
              ]}
            >
              {permissionStatus.notifications}
            </Text>
          </View>
          <View style={styles.inlineButton}>
            <Button
              title="Solicitar permissões"
              color="#6c5ce7"
              onPress={requestPermissions}
            />
          </View>
        </View>

        {isScanning ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informações do Scan</Text>
            <InfoRow label="Modo" value={scanMode} />
            <InfoRow
              label="Intervalo de sync"
              value={`${currentSyncInterval}s`}
            />
            <InfoRow
              label="Duração do scan"
              value={`${Math.round(scanDuration)}s`}
            />
            {pauseDuration > 0 ? (
              <InfoRow
                label="Tempo de pausa"
                value={`${Math.round(pauseDuration)}s`}
              />
            ) : null}
            <View style={styles.divider} />
            <InfoRow
              label="Envio para API em"
              value={`${secondsUntilNextSync}s`}
              valueColor="#64b5f6"
            />
            <View style={styles.rangingRow}>
              <Text style={styles.infoLabel}>Ranging</Text>
              <View style={styles.rangingStatus}>
                <View
                  style={[
                    styles.rangingDot,
                    { backgroundColor: isRanging ? '#4caf50' : '#ff9800' },
                  ]}
                />
                <Text
                  style={[
                    styles.rangingText,
                    { color: isRanging ? '#4caf50' : '#ff9800' },
                  ]}
                >
                  {isRanging ? 'Ativo' : 'Pausado'}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Controle</Text>
          <View style={styles.buttonRow}>
            {!isScanning ? (
              <Button
                title="Iniciar Scan"
                color="#1976d2"
                onPress={startScan}
                disabled={!hasPermissions}
              />
            ) : (
              <Button title="Parar Scan" color="#c0392b" onPress={stopScan} />
            )}
          </View>

          <Text style={styles.optionLabel}>Intervalo</Text>
          <View style={styles.chipRow}>
            {intervalOptions.map((interval) => (
              <Pressable
                key={interval}
                onPress={() => {
                  setCurrentSyncInterval(interval);
                  configureSdk({ syncInterval: interval }).catch(() => null);
                }}
                style={[
                  styles.chip,
                  interval === currentSyncInterval && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    interval === currentSyncInterval && styles.chipTextActive,
                  ]}
                >
                  {interval}s
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.optionLabel}>Ordenar</Text>
          <View style={styles.chipRow}>
            {sortOptions.map((option) => (
              <Pressable
                key={option.key}
                onPress={() => setSortOption(option.key)}
                style={[
                  styles.chip,
                  option.key === sortOption && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    option.key === sortOption && styles.chipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.optionLabel}>Configurações extras</Text>
          <View style={styles.extraRow}>
            <Pressable
              onPress={() => {
                const next = !enableBluetoothScanning;
                setEnableBluetoothScanning(next);
                configureSdk({ enableBluetoothScanning: next }).catch(
                  () => null
                );
              }}
              style={[
                styles.toggleButton,
                enableBluetoothScanning && styles.toggleButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.toggleText,
                  enableBluetoothScanning && styles.toggleTextActive,
                ]}
              >
                Bluetooth metadata {enableBluetoothScanning ? 'on' : 'off'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const next = !enablePeriodicScanning;
                setEnablePeriodicScanning(next);
                configureSdk({ enablePeriodicScanning: next }).catch(
                  () => null
                );
              }}
              style={[
                styles.toggleButton,
                enablePeriodicScanning && styles.toggleButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.toggleText,
                  enablePeriodicScanning && styles.toggleTextActive,
                ]}
              >
                Scan periódico {enablePeriodicScanning ? 'on' : 'off'}
              </Text>
            </Pressable>
          </View>
        </View>

        {lastScanTime ? (
          <Text style={styles.lastScan}>
            Última atualização: {formatTime(lastScanTime)}
          </Text>
        ) : null}

        {sortedBeacons.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Aguardando próximos scans</Text>
            {isScanning ? (
              <Text style={styles.emptySubtitle}>
                O sistema está monitorando beacons
              </Text>
            ) : null}
          </View>
        ) : (
          sortedBeacons.map((beacon) => (
            <View
              key={`${beacon.uuid}-${beacon.major}-${beacon.minor}`}
              style={styles.beaconCard}
            >
              <View style={styles.beaconHeader}>
                <View style={styles.beaconInfo}>
                  <Text style={styles.beaconTitle}>
                    Beacon {beacon.major}.{beacon.minor}
                  </Text>
                  <Text style={styles.beaconUuid} numberOfLines={1}>
                    {beacon.uuid}
                  </Text>
                  <View style={styles.beaconMetaRow}>
                    <View style={styles.proximityRow}>
                      <View
                        style={[
                          styles.proximityDot,
                          { backgroundColor: proximityColor(beacon.proximity) },
                        ]}
                      />
                      <Text style={styles.beaconMetaText}>
                        {proximityLabel(beacon.proximity)}
                      </Text>
                    </View>
                    {beacon.accuracy > 0 ? (
                      <Text style={styles.beaconMetaText}>
                        {beacon.accuracy.toFixed(1)}m
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.rssiText}>{beacon.rssi} dB</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function permissionColor(status: string) {
  if (status.includes('Negada')) {
    return '#f44336';
  }
  if (status.includes('Sempre')) {
    return '#4caf50';
  }
  if (status.includes('Quando') || status.includes('Autorizada')) {
    return '#ff9800';
  }
  if (status.includes('Autorizado')) {
    return '#4caf50';
  }
  if (status.includes('Indisponível')) {
    return '#9e9e9e';
  }
  return '#9e9e9e';
}

function InfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[styles.infoValue, valueColor ? { color: valueColor } : null]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0b0b0f',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  appBar: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1f1f1f',
    backgroundColor: '#111',
  },
  appBarTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  appBarSubtitle: {
    color: '#bdbdbd',
    marginTop: 4,
    fontSize: 12,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#141414',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  permissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  permissionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  permissionText: {
    color: '#bdbdbd',
    marginLeft: 8,
  },
  permissionValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  inlineButton: {
    marginTop: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoLabel: {
    color: '#bdbdbd',
  },
  infoValue: {
    color: '#fff',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#1f1f1f',
    marginVertical: 8,
  },
  rangingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  rangingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rangingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  rangingText: {
    fontWeight: '600',
  },
  buttonRow: {
    marginBottom: 12,
  },
  optionLabel: {
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
  extraRow: {
    flexDirection: 'column',
  },
  toggleButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#0f0f0f',
    marginBottom: 8,
  },
  toggleButtonActive: {
    backgroundColor: '#1b5e20',
    borderColor: '#2e7d32',
  },
  toggleText: {
    color: '#bdbdbd',
    fontSize: 12,
  },
  toggleTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  lastScan: {
    color: '#9e9e9e',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    color: '#bdbdbd',
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: '#9e9e9e',
    marginTop: 4,
  },
  beaconCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    backgroundColor: '#141414',
    marginBottom: 12,
  },
  beaconHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  beaconInfo: {
    flex: 1,
    marginRight: 12,
  },
  beaconTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  beaconUuid: {
    color: '#9e9e9e',
    fontSize: 12,
    marginTop: 4,
  },
  beaconMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  proximityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  proximityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  beaconMetaText: {
    color: '#9e9e9e',
    fontSize: 12,
  },
  rssiText: {
    color: '#bdbdbd',
    fontSize: 12,
  },
  errorBox: {
    backgroundColor: '#2a1111',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#ff7675',
  },
});
