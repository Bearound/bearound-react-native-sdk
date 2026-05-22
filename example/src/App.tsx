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
  addSyncLifecycleListener,
  addBackgroundDetectionListener,
  addBeaconRegionListener,
  addActiveScanListener,
  addLocationCaptureListener,
  checkPermissions,
  ensurePermissions,
  ScanPrecision,
  MaxQueuedPayloads,
  type Beacon,
  type BeaconProximity,
  type CapturedLocation,
  type PermissionResult,
} from '@bearound/react-native-sdk';

type SortOption = 'proximity' | 'id';
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

type GeofenceEventKind =
  | 'region-enter'
  | 'region-exit'
  | 'scan-active'
  | 'scan-paused'
  | 'capture-started'
  | 'capture-fix'
  | 'capture-no-fix';

type GeofenceEventEntry = {
  id: string;
  kind: GeofenceEventKind;
  timestamp: number;
  detail: string;
};

const geofenceEventTitle = (kind: GeofenceEventKind) => {
  switch (kind) {
    case 'region-enter':
      return 'ENTROU NA ZONA';
    case 'region-exit':
      return 'SAIU DA ZONA';
    case 'scan-active':
      return 'SCAN LIGADO';
    case 'scan-paused':
      return 'SCAN PAUSADO';
    case 'capture-started':
      return 'GPS DISPARADO';
    case 'capture-fix':
      return 'FIX OK';
    case 'capture-no-fix':
      return 'SEM FIX';
  }
};

const geofenceEventColor = (kind: GeofenceEventKind) => {
  switch (kind) {
    case 'region-enter':
    case 'scan-active':
    case 'capture-fix':
      return '#4caf50';
    case 'region-exit':
      return '#ff9800';
    case 'scan-paused':
      return '#9e9e9e';
    case 'capture-started':
      return '#2196f3';
    case 'capture-no-fix':
      return '#f44336';
  }
};

const formatAge = (ms: number) => {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}s atrás`;
  if (sec < 3600) return `${Math.floor(sec / 60)}min ${sec % 60}s atrás`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}min atrás`;
};

export default function App() {
  const [scanPrecision, setScanPrecision] = useState(ScanPrecision.MEDIUM);
  const [maxQueuedPayloads, setMaxQueuedPayloads] = useState(
    MaxQueuedPayloads.MEDIUM
  );
  const [sortOption, setSortOption] = useState<SortOption>('proximity');
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState({
    location: 'Verificando...',
    bluetooth: 'Verificando...',
    notifications: 'Verificando...',
  });
  const [statusMessage, setStatusMessage] = useState('Pronto');
  const [beacons, setBeacons] = useState<Beacon[]>([]);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // v2.4 — Geofence Debug state
  const [isInBeaconRegion, setIsInBeaconRegion] = useState(false);
  const [isActiveScan, setIsActiveScan] = useState(false);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [lastCaptureOpenReason, setLastCaptureOpenReason] = useState('—');
  const [lastCaptureOutcome, setLastCaptureOutcome] = useState('—');
  const [lastCaptureCompletedAt, setLastCaptureCompletedAt] = useState<
    number | null
  >(null);
  const [lastCapturedLocation, setLastCapturedLocation] =
    useState<CapturedLocation | null>(null);
  const [geofenceEvents, setGeofenceEvents] = useState<GeofenceEventEntry[]>(
    []
  );
  // 1Hz tick so live "X seg atrás" ages render in real time.
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const pushGeofenceEvent = useCallback(
    (kind: GeofenceEventKind, detail: string) => {
      setGeofenceEvents((prev) => {
        const entry: GeofenceEventEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          kind,
          timestamp: Date.now(),
          detail,
        };
        return [entry, ...prev].slice(0, 30);
      });
    },
    []
  );

  const clearGeofenceLog = useCallback(() => setGeofenceEvents([]), []);

  const precisionLabel = useMemo(() => {
    switch (scanPrecision) {
      case ScanPrecision.HIGH:
        return 'Alta (contínuo)';
      case ScanPrecision.MEDIUM:
        return 'Média (3 ciclos/min)';
      case ScanPrecision.LOW:
        return 'Baixa (1 ciclo/min)';
    }
  }, [scanPrecision]);

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
        scanPrecision: ScanPrecision;
        maxQueuedPayloads: MaxQueuedPayloads;
      }> = {}
    ) => {
      setLastError(null);
      const config = {
        businessToken: 'your-business-token',
        scanPrecision: scanPrecision,
        maxQueuedPayloads: maxQueuedPayloads,
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
    [scanPrecision, maxQueuedPayloads]
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

    const syncLifecycleSub = addSyncLifecycleListener((event) => {
      if (event.type === 'started') {
        console.log(`🚀 Sync started with ${event.beaconCount} beacons`);
      } else if (event.type === 'completed') {
        if (event.success) {
          console.log(`✅ Sync succeeded: ${event.beaconCount} beacons sent`);
          setLastError(null); // Clear error on success
        } else {
          console.log(`❌ Sync failed: ${event.error}`);
          setLastError(event.error || 'Sync failed');
        }
      }
    });

    const backgroundDetectionSub = addBackgroundDetectionListener((event) => {
      console.log(`🌙 Background: ${event.beaconCount} beacons detected`);
    });

    const scanningSub = addScanningListener((scanning) => {
      setIsScanning(scanning);
      setStatusMessage(scanning ? 'Scaneando...' : 'Parado');
      if (!scanning) {
        setBeacons([]);
      }
    });

    const errorSub = addErrorListener((error) => {
      setLastError(error.message);
      setStatusMessage(`Erro: ${error.message}`);
    });

    const regionSub = addBeaconRegionListener((event) => {
      if (event.type === 'enter') {
        setIsInBeaconRegion(true);
        pushGeofenceEvent(
          'region-enter',
          'iOS/Android reportou entrada na zona do beacon'
        );
      } else {
        setIsInBeaconRegion(false);
        pushGeofenceEvent('region-exit', 'Saiu da zona do beacon');
      }
    });

    const activeScanSub = addActiveScanListener((event) => {
      setIsActiveScan(event.isActive);
      pushGeofenceEvent(
        event.isActive ? 'scan-active' : 'scan-paused',
        event.isActive
          ? 'Scan ativo (ranging + BLE) LIGADO'
          : 'Scan ativo DESLIGADO — só monitoring de região'
      );
    });

    const locationCaptureSub = addLocationCaptureListener((event) => {
      if (event.type === 'started') {
        setIsCapturingLocation(true);
        setLastCaptureOpenReason(event.reason);
        pushGeofenceEvent(
          'capture-started',
          `Janela GPS aberta — motivo: ${event.reason}`
        );
      } else {
        setIsCapturingLocation(false);
        setLastCaptureOutcome(event.outcome);
        setLastCaptureCompletedAt(event.timestamp || Date.now());
        setLastCapturedLocation(event.location ?? null);
        if (event.location) {
          const acc = event.location.horizontalAccuracy ?? -1;
          pushGeofenceEvent(
            'capture-fix',
            `Fix: ${event.location.latitude.toFixed(5)}, ${event.location.longitude.toFixed(
              5
            )} ±${acc >= 0 ? Math.round(acc) : '?'}m | abriu: ${event.reason} | fechou: ${event.outcome}`
          );
        } else {
          pushGeofenceEvent(
            'capture-no-fix',
            `Sem fix — abriu: ${event.reason} | fechou: ${event.outcome}`
          );
        }
      }
    });

    return () => {
      beaconsSub.remove();
      syncLifecycleSub.remove();
      backgroundDetectionSub.remove();
      scanningSub.remove();
      errorSub.remove();
      regionSub.remove();
      activeScanSub.remove();
      locationCaptureSub.remove();
    };
  }, [pushGeofenceEvent, refreshPermissions]);

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
            <InfoRow label="Precisão" value={precisionLabel} />
            <InfoRow label="Fila Retry" value={`${maxQueuedPayloads}`} />
            <View style={styles.divider} />
            <Text style={styles.infoNote}>
              ✨ Sync automático: eventos em syncLifecycleListener
            </Text>
          </View>
        ) : null}

        {isScanning ? (
          <View style={styles.section}>
            <View style={styles.geofenceHeader}>
              <Text style={styles.sectionTitle}>Debug Geofence</Text>
              {geofenceEvents.length > 0 ? (
                <Pressable onPress={clearGeofenceLog}>
                  <Text style={styles.clearLogText}>Limpar</Text>
                </Pressable>
              ) : null}
            </View>

            <InfoRow
              label="Zona do beacon"
              value={isInBeaconRegion ? 'DENTRO' : 'fora'}
              valueColor={isInBeaconRegion ? '#4caf50' : '#9e9e9e'}
            />
            <InfoRow
              label="Scan ativo"
              value={isActiveScan ? 'LIGADO' : 'desligado'}
              valueColor={isActiveScan ? '#4caf50' : '#9e9e9e'}
            />
            <InfoRow
              label="Captura GPS"
              value={isCapturingLocation ? 'EM ANDAMENTO…' : 'idle'}
              valueColor={isCapturingLocation ? '#2196f3' : '#9e9e9e'}
            />

            <View style={styles.divider} />

            <InfoRow label="Última abertura" value={lastCaptureOpenReason} />
            <InfoRow label="Último fechamento" value={lastCaptureOutcome} />
            {lastCapturedLocation ? (
              <InfoRow
                label="Última coord"
                value={`${lastCapturedLocation.latitude.toFixed(5)}, ${lastCapturedLocation.longitude.toFixed(5)} ±${
                  lastCapturedLocation.horizontalAccuracy !== undefined
                    ? Math.round(lastCapturedLocation.horizontalAccuracy)
                    : '?'
                }m`}
              />
            ) : (
              <InfoRow label="Última coord" value="—" />
            )}
            {lastCaptureCompletedAt ? (
              <InfoRow
                label="Concluído em"
                value={`${formatTime(new Date(lastCaptureCompletedAt))}  (${formatAge(nowMs - lastCaptureCompletedAt)})`}
              />
            ) : null}

            {geofenceEvents.length > 0 ? (
              <>
                <View style={styles.divider} />
                <Text style={styles.eventLogTitle}>Eventos recentes</Text>
                {geofenceEvents.slice(0, 10).map((event) => {
                  const age = nowMs - event.timestamp;
                  const color = geofenceEventColor(event.kind);
                  return (
                    <View key={event.id} style={styles.eventRow}>
                      <View
                        style={[styles.eventDot, { backgroundColor: color }]}
                      />
                      <View style={styles.eventBody}>
                        <View style={styles.eventHeader}>
                          <Text style={[styles.eventTitle, { color }]}>
                            {geofenceEventTitle(event.kind)}
                          </Text>
                          <Text style={styles.eventTime}>
                            {formatTime(new Date(event.timestamp))} ·{' '}
                            {formatAge(age)}
                          </Text>
                        </View>
                        <Text style={styles.eventDetail}>{event.detail}</Text>
                      </View>
                    </View>
                  );
                })}
              </>
            ) : null}
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

          <Text style={styles.optionLabel}>Scan Precision</Text>
          <View style={styles.chipRow}>
            {[
              { value: ScanPrecision.HIGH, label: 'High' },
              { value: ScanPrecision.MEDIUM, label: 'Medium' },
              { value: ScanPrecision.LOW, label: 'Low' },
            ].map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  setScanPrecision(option.value);
                  configureSdk({
                    scanPrecision: option.value,
                  }).catch(() => null);
                }}
                style={[
                  styles.chip,
                  option.value === scanPrecision && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    option.value === scanPrecision && styles.chipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.optionLabel}>Max Queued Payloads</Text>
          <View style={styles.chipRow}>
            {[
              { value: MaxQueuedPayloads.SMALL, label: 'Small (50)' },
              { value: MaxQueuedPayloads.MEDIUM, label: 'Medium (100)' },
              { value: MaxQueuedPayloads.LARGE, label: 'Large (200)' },
              { value: MaxQueuedPayloads.XLARGE, label: 'XLarge (500)' },
            ].map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  setMaxQueuedPayloads(option.value);
                  configureSdk({ maxQueuedPayloads: option.value }).catch(
                    () => null
                  );
                }}
                style={[
                  styles.chip,
                  option.value === maxQueuedPayloads && styles.chipActive,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    option.value === maxQueuedPayloads && styles.chipTextActive,
                  ]}
                >
                  {option.label}
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
  infoNote: {
    color: '#9e9e9e',
    fontSize: 12,
    fontStyle: 'italic',
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
  autoFeature: {
    paddingVertical: 8,
  },
  autoFeatureText: {
    color: '#9e9e9e',
    fontSize: 13,
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
  geofenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearLogText: {
    color: '#bdbdbd',
    fontSize: 12,
  },
  eventLogTitle: {
    color: '#bdbdbd',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
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
  eventHeader: {
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
