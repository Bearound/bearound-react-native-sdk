import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
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
  addBluetoothZoneListener,
  addBluetoothScanModeListener,
  addBluetoothStateListener,
  getSdkVersion,
  getBluetoothState,
  checkPermissions,
  ensurePermissions,
  ScanPrecision,
  MaxQueuedPayloads,
  type Beacon,
  type BeaconProximity,
  type BluetoothScanMode,
  type BluetoothState,
  type PermissionResult,
} from '@bearound/react-native-sdk';
import { TwoEyesModal } from './TwoEyesModal';
import { SettingsModal } from './SettingsModal';
import { LogModal } from './LogModal';
import {
  geofenceEventColor,
  geofenceEventTitle,
  type GeofenceEventEntry,
  type GeofenceEventKind,
  type AppStateBucket,
  type DetectionLogEntry,
} from './events';

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
      case 'bt':
        return 3;
      default:
        return 4;
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
    case 'bt':
      return 'Bluetooth';
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
    case 'bt':
      return '#2196f3';
    default:
      return '#9e9e9e';
  }
};

const formatTime = (date: Date) =>
  date.toLocaleTimeString('pt-BR', { hour12: false });

// iOS-only discoverySources → display badges (mirrors the native demo).
const sourceBadges = (
  sources?: Beacon['discoverySources']
): Array<{ label: string; color: string }> => {
  if (!sources || sources.length === 0) return [];
  const hasSU = sources.includes('serviceUUID');
  const hasCL = sources.includes('coreLocation');
  const hasName = sources.includes('name');
  const badges: Array<{ label: string; color: string }> = [];
  if (hasSU) badges.push({ label: 'Service UUID', color: '#7e57c2' });
  if (hasCL) badges.push({ label: 'iBeacon', color: '#5c6bc0' });
  if (hasName && !hasSU && !hasCL)
    badges.push({ label: 'Name', color: '#26a69a' });
  return badges;
};

const batteryColor = (mV: number) =>
  mV > 2800 ? '#4caf50' : mV > 2400 ? '#ff9800' : '#f44336';

// Bluetooth adapter state → label/color, mirroring the iOS native demo.
const BT_LABEL: Record<BluetoothState, string> = {
  poweredOn: 'Ligado',
  poweredOff: 'Desligado',
  unauthorized: 'Não autorizado',
  unsupported: 'Não suportado',
  resetting: 'Reiniciando',
  unknown: 'Verificando...',
};
const BT_COLOR: Record<BluetoothState, string> = {
  poweredOn: '#4caf50',
  poweredOff: '#f44336',
  unauthorized: '#f44336',
  unsupported: '#f44336',
  resetting: '#ff9800',
  unknown: '#ff9800',
};

const formatAge = (ms: number) => {
  const sec = Math.max(0, Math.floor(ms / 1000));
  if (sec < 60) return `${sec}s atrás`;
  if (sec < 3600) return `${Math.floor(sec / 60)}min ${sec % 60}s atrás`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}min atrás`;
};

export default function App() {
  const [scanPrecision, setScanPrecision] = useState(ScanPrecision.HIGH);
  const [maxQueuedPayloads, setMaxQueuedPayloads] = useState(
    MaxQueuedPayloads.MEDIUM
  );
  const [sortOption, setSortOption] = useState<SortOption>('proximity');
  const [isScanning, setIsScanning] = useState(false);
  // Two-eyes model: scanning works with EITHER location OR bluetooth (anyOf),
  // exactly like the iOS native SDK. Tracked independently.
  const [locationGranted, setLocationGranted] = useState(false);
  const [bluetoothState, setBluetoothState] =
    useState<BluetoothState>('unknown');
  const [permissionStatus, setPermissionStatus] = useState({
    location: 'Verificando...',
    notifications: 'Verificando...',
  });
  const [statusMessage, setStatusMessage] = useState('Pronto');
  const [beacons, setBeacons] = useState<Beacon[]>([]);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Sync info (mirrors the iOS native "Informações do Sync" card).
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [lastSyncCount, setLastSyncCount] = useState(0);
  const [lastSyncDuration, setLastSyncDuration] = useState<number | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<
    'success' | 'failed' | null
  >(null);
  const syncStartRef = useRef<number | null>(null);
  const lastEnteredRegionRef = useRef<number | null>(null);

  // v2.4 — Geofence Debug state
  const [isInBeaconRegion, setIsInBeaconRegion] = useState(false);
  const [lastEnteredRegionAt, setLastEnteredRegionAt] = useState<number | null>(
    null
  );
  const [lastExitedRegionAt, setLastExitedRegionAt] = useState<number | null>(
    null
  );
  const [isActiveScan, setIsActiveScan] = useState(false);
  const [geofenceEvents, setGeofenceEvents] = useState<GeofenceEventEntry[]>(
    []
  );

  // v2.5 — Two Eyes state (Bluetooth eye is iOS-only)
  const [locationEnterCount, setLocationEnterCount] = useState(0);
  const [isInBluetoothZone, setIsInBluetoothZone] = useState(false);
  const [lastBtEnterAt, setLastBtEnterAt] = useState<number | null>(null);
  const [lastBtExitAt, setLastBtExitAt] = useState<number | null>(null);
  const [btZoneEnterCount, setBtZoneEnterCount] = useState(0);
  const [btScanMode, setBtScanMode] = useState<BluetoothScanMode>('idle');
  const [btNextIdleScanAt, setBtNextIdleScanAt] = useState<number | null>(null);
  const [locationKeys, setLocationKeys] = useState<Set<string>>(new Set());
  const [bluetoothKeys, setBluetoothKeys] = useState<Set<string>>(new Set());
  const [sdkVersion, setSdkVersion] = useState('');
  const [showTwoEyes, setShowTwoEyes] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // State-aware detection log (Foreground / Background / Closed) + clear.
  const [detectionLog, setDetectionLog] = useState<DetectionLogEntry[]>([]);
  const [showLog, setShowLog] = useState(false);
  const appStateBucketRef = useRef<AppStateBucket>('foreground');
  const lastBeaconLogRef = useRef(0);

  const pushLog = useCallback((type: string, detail: string) => {
    setDetectionLog((prev) => {
      const entry: DetectionLogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        state: appStateBucketRef.current,
        type,
        detail,
      };
      return [entry, ...prev].slice(0, 300);
    });
  }, []);

  // Load the NATIVE persisted log (iOS-only — the Android SDK exposes no
  // detection-log API and always resolves [], which would wipe the optimistic
  // in-memory log; on Android we keep the JS log as the only source).
  const refreshLog = useCallback(async () => {
    if (Platform.OS !== 'ios') return;
    try {
      const entries = await BeAround.getPersistedLog();
      setDetectionLog(entries as unknown as DetectionLogEntry[]);
    } catch {
      // keep the optimistic in-memory log
    }
  }, []);

  useEffect(() => {
    // AppState only knows active/background/inactive — the native SDK is the
    // source of truth for `backgroundLocked`/`terminated`. Local optimistic
    // log entries from JS only tag foreground vs background.
    const map = (s: string): AppStateBucket =>
      s === 'active' ? 'foreground' : 'background';
    appStateBucketRef.current = map(AppState.currentState ?? 'active');
    refreshLog();
    const sub = AppState.addEventListener('change', (s) => {
      appStateBucketRef.current = map(s);
      if (s === 'active') refreshLog();
    });
    return () => sub.remove();
  }, [refreshLog]);

  // Refresh the persisted log periodically while the Log modal is open.
  useEffect(() => {
    if (!showLog) return;
    refreshLog();
    const t = setInterval(refreshLog, 3000);
    return () => clearInterval(t);
  }, [showLog, refreshLog]);

  const isIOS = Platform.OS === 'ios';

  // anyOf: the SDK detects beacons with EITHER eye — location OR bluetooth.
  const canScan = locationGranted || bluetoothState === 'poweredOn';

  const locationBeaconsNow = useMemo(
    () =>
      beacons.filter((b) => b.discoverySources?.includes('coreLocation'))
        .length,
    [beacons]
  );
  const bluetoothBeaconsNow = useMemo(
    () =>
      beacons.filter((b) =>
        b.discoverySources?.some((s) => s === 'serviceUUID' || s === 'name')
      ).length,
    [beacons]
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
    setLocationGranted(status.fineLocation);

    const locationStatus = status.fineLocation
      ? Platform.OS === 'android' && status.backgroundLocation
        ? 'Sempre (Background habilitado)'
        : 'Quando em uso'
      : 'Negada (só o olho Bluetooth funcionará)';

    const notificationStatus =
      Platform.OS === 'android'
        ? status.notifications
          ? 'Autorizada'
          : 'Negada'
        : 'Indisponível';

    setPermissionStatus({
      location: locationStatus,
      notifications: notificationStatus,
    });

    return status.fineLocation;
  }, []);

  const refreshPermissions = useCallback(async () => {
    const status = await checkPermissions();
    return updatePermissionStatus(status);
  }, [updatePermissionStatus]);

  const requestPermissions = useCallback(async () => {
    const status = await ensurePermissions({ askBackground: true });
    updatePermissionStatus(status);

    // NOTE: push is app-level now — the SDK no longer owns notifications, so the
    // example requests no notification permission via the bridge. POST_NOTIFICATIONS
    // (Android 13+) is still handled by ensurePermissions above.

    // Refresh the Bluetooth eye state (also prompts the BT permission on iOS).
    const bt = await getBluetoothState();
    setBluetoothState(bt);

    // anyOf: the SDK works with either eye. Only warn if NEITHER is available.
    const ok = status.fineLocation || bt === 'poweredOn';
    if (!ok) {
      Alert.alert(
        'Permissões',
        'Conceda a Localização OU mantenha o Bluetooth ligado para detectar beacons.'
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
        businessToken: 'ee2ec9c46d2b2ad99bddcdd0afe224e6',
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
    // Prompt for permissions but DO NOT block — the iOS native SDK never gates
    // scanning. Whichever eye is available (Location and/or Bluetooth) activates.
    await requestPermissions();

    try {
      await configureSdk();
      await BeAround.startScanning();

      // NOTE: push is app-level now — the SDK no longer posts notifications.
      // Android: keep the process alive in background via the foreground service.
      // No config: the notification shows just the app name (no subtitle).
      if (Platform.OS === 'android') {
        await BeAround.enableForegroundScanning().catch(() => null);
      }

      // Reset geofence session counters so each scan starts clean
      setGeofenceEvents([]);
      setLastEnteredRegionAt(null);
      setLastExitedRegionAt(null);
      // v2.5 — reset two-eyes session counters
      setLocationEnterCount(0);
      setBtZoneEnterCount(0);
      setIsInBluetoothZone(false);
      setLastBtEnterAt(null);
      setLastBtExitAt(null);
      setLocationKeys(new Set());
      setBluetoothKeys(new Set());

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

      // v2.5 — accumulate unique beacon keys per eye (iOS discoverySources).
      const locHits: string[] = [];
      const btHits: string[] = [];
      items.forEach((b) => {
        const key = `${b.major}.${b.minor}`;
        if (b.discoverySources?.includes('coreLocation')) locHits.push(key);
        if (
          b.discoverySources?.some((s) => s === 'serviceUUID' || s === 'name')
        )
          btHits.push(key);
      });
      if (locHits.length) {
        setLocationKeys((prev) => new Set([...prev, ...locHits]));
      }
      if (btHits.length) {
        setBluetoothKeys((prev) => new Set([...prev, ...btHits]));
      }

      if (items.length === 0) {
        setStatusMessage('Scaneando...');
      } else {
        setStatusMessage(
          `${items.length} beacon${items.length === 1 ? '' : 's'}`
        );
        // Throttle beacon-detection log entries to keep the log readable.
        if (Date.now() - lastBeaconLogRef.current > 4000) {
          lastBeaconLogRef.current = Date.now();
          pushLog('Beacons', `${items.length} detectado(s)`);
        }
      }
    });

    const syncLifecycleSub = addSyncLifecycleListener((event) => {
      if (event.type === 'started') {
        syncStartRef.current = Date.now();
        setLastSyncCount(event.beaconCount);
        pushLog('Sync iniciado', `${event.beaconCount} beacon(s) na fila`);
      } else if (event.type === 'completed') {
        const startedAt = syncStartRef.current;
        const durationMs = startedAt ? Date.now() - startedAt : 0;
        const enteredAt = lastEnteredRegionRef.current;
        syncStartRef.current = null;

        setLastSyncTime(Date.now());
        setLastSyncCount(event.beaconCount);
        setLastSyncDuration(durationMs);
        setLastSyncResult(event.success ? 'success' : 'failed');

        const durationLabel =
          durationMs >= 1000
            ? `${(durationMs / 1000).toFixed(1)}s`
            : `${durationMs}ms`;
        const enteredLabel = enteredAt
          ? new Date(enteredAt).toLocaleTimeString('pt-BR', { hour12: false })
          : '—';

        if (event.success) {
          setLastError(null);
          pushLog(
            'Sync OK',
            `${event.beaconCount} beacon(s) · ${durationLabel} · entrou ${enteredLabel}`
          );
        } else {
          setLastError(event.error || 'Sync failed');
          pushLog(
            'Sync falhou',
            `${event.beaconCount} beacon(s) · ${durationLabel} · ${event.error ?? 'erro'}`
          );
        }
      }
    });

    const backgroundDetectionSub = addBackgroundDetectionListener((event) => {
      console.log(`🌙 Background: ${event.beaconCount} beacons detected`);
      pushLog('Background', `${event.beaconCount} beacon(s) detectado(s)`);
    });

    const scanningSub = addScanningListener((scanning) => {
      setIsScanning(scanning);
      setStatusMessage(scanning ? 'Scaneando...' : 'Parado');
      pushLog('Scan', scanning ? 'Iniciado' : 'Parado');
      if (!scanning) {
        setBeacons([]);
      }
    });

    const errorSub = addErrorListener((error) => {
      setLastError(error.message);
      setStatusMessage(`Erro: ${error.message}`);
      pushLog('Erro', error.message);
    });

    const regionSub = addBeaconRegionListener((event) => {
      if (event.type === 'enter') {
        setIsInBeaconRegion(true);
        lastEnteredRegionRef.current = Date.now();
        setLastEnteredRegionAt(Date.now());
        setLocationEnterCount((c) => c + 1);
        pushGeofenceEvent(
          'region-enter',
          'iOS/Android reportou entrada na zona do beacon'
        );
        pushLog('Região', 'Entrou na zona do beacon');
      } else {
        setIsInBeaconRegion(false);
        setLastExitedRegionAt(Date.now());
        pushGeofenceEvent('region-exit', 'Saiu da zona do beacon');
        pushLog('Região', 'Saiu da zona do beacon');
      }
    });

    // v2.5 — Bluetooth "two eyes" zone (iOS-only; never fires on Android)
    const btZoneSub = addBluetoothZoneListener((event) => {
      if (event.type === 'enter') {
        setIsInBluetoothZone(true);
        setLastBtEnterAt(Date.now());
        setBtZoneEnterCount((c) => c + 1);
        pushGeofenceEvent(
          'bt-zone-enter',
          'BLE detectou beacon (CBCentralManager)'
        );
        pushLog('Zona BT', 'Entrou (BLE detectou beacon)');
      } else {
        setIsInBluetoothZone(false);
        setLastBtExitAt(Date.now());
        pushGeofenceEvent('bt-zone-exit', 'Zona BLE vazia (graça expirou)');
        pushLog('Zona BT', 'Saiu (zona BLE vazia)');
      }
    });

    const btScanModeSub = addBluetoothScanModeListener((event) => {
      setBtScanMode(event.mode);
      setBtNextIdleScanAt(event.nextIdleScanAt ?? null);
    });

    // Bluetooth eye availability — independent of location.
    getBluetoothState()
      .then(setBluetoothState)
      .catch(() => null);
    const btStateSub = addBluetoothStateListener(setBluetoothState);

    const activeScanSub = addActiveScanListener((event) => {
      setIsActiveScan(event.isActive);
      pushGeofenceEvent(
        event.isActive ? 'scan-active' : 'scan-paused',
        event.isActive
          ? 'Scan ativo (ranging + BLE) LIGADO'
          : 'Scan ativo DESLIGADO — só monitoring de região'
      );
    });

    getSdkVersion()
      .then(setSdkVersion)
      .catch(() => null);

    return () => {
      beaconsSub.remove();
      syncLifecycleSub.remove();
      backgroundDetectionSub.remove();
      scanningSub.remove();
      errorSub.remove();
      regionSub.remove();
      activeScanSub.remove();
      btZoneSub.remove();
      btScanModeSub.remove();
      btStateSub.remove();
    };
  }, [pushGeofenceEvent, pushLog, refreshPermissions]);

  // Auto-run: start scanning as soon as the app opens (mirrors the iOS native
  // demo, which configures + startScanning() on launch). Runs once.
  const didAutoStartRef = useRef(false);
  useEffect(() => {
    if (didAutoStartRef.current) {
      return;
    }
    didAutoStartRef.current = true;
    startScan();
  }, [startScan]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>BeAroundScan</Text>
        <Text style={styles.appBarSubtitle}>{statusMessage}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.eyesButton}
            onPress={() => setShowTwoEyes(true)}
          >
            <Text style={styles.eyesButtonText}>👁 👁 Abrir Dois Olhos</Text>
          </Pressable>
          <Pressable
            style={styles.settingsButton}
            onPress={() => setShowLog(true)}
          >
            <Text style={styles.settingsButtonText}>📋</Text>
          </Pressable>
          <Pressable
            style={styles.settingsButton}
            onPress={() => setShowSettings(true)}
          >
            <Text style={styles.settingsButtonText}>⚙︎</Text>
          </Pressable>
        </View>

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
                  { backgroundColor: BT_COLOR[bluetoothState] },
                ]}
              />
              <Text style={styles.permissionText}>Bluetooth</Text>
            </View>
            <Text
              style={[
                styles.permissionValue,
                { color: BT_COLOR[bluetoothState] },
              ]}
            >
              {BT_LABEL[bluetoothState]}
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
          <Text
            style={[
              styles.readyHint,
              { color: canScan ? '#4caf50' : '#ff9800' },
            ]}
          >
            {canScan
              ? '✓ Pronto para detectar (Localização e/ou Bluetooth)'
              : '⚠ Conceda Localização ou ligue o Bluetooth'}
          </Text>
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
            <Text style={styles.sectionTitle}>Informações do Sync</Text>
            <InfoRow
              label="Último sync"
              value={lastSyncTime ? formatTime(new Date(lastSyncTime)) : '--'}
            />
            <InfoRow label="Beacons sincronizados" value={`${lastSyncCount}`} />
            <InfoRow
              label="Duração"
              value={
                lastSyncDuration == null
                  ? '--'
                  : lastSyncDuration >= 1000
                    ? `${(lastSyncDuration / 1000).toFixed(1)}s`
                    : `${lastSyncDuration}ms`
              }
            />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Resultado</Text>
              <Text
                style={[
                  styles.infoValue,
                  {
                    color:
                      lastSyncResult === 'success'
                        ? '#4caf50'
                        : lastSyncResult === 'failed'
                          ? '#f44336'
                          : '#9e9e9e',
                  },
                ]}
              >
                {lastSyncResult === 'success'
                  ? 'Sucesso'
                  : lastSyncResult === 'failed'
                    ? 'Falha'
                    : 'Aguardando...'}
              </Text>
            </View>
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
            {lastEnteredRegionAt ? (
              <InfoRow
                label="Entrou às"
                value={`${formatTime(new Date(lastEnteredRegionAt))}  (${formatAge(nowMs - lastEnteredRegionAt)})`}
              />
            ) : null}
            {lastExitedRegionAt ? (
              <InfoRow
                label="Saiu às"
                value={`${formatTime(new Date(lastExitedRegionAt))}  (${formatAge(nowMs - lastExitedRegionAt)})`}
              />
            ) : null}
            <InfoRow
              label="Scan ativo"
              value={isActiveScan ? 'LIGADO' : 'desligado'}
              valueColor={isActiveScan ? '#4caf50' : '#9e9e9e'}
            />

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
                    {beacon.isStale ? (
                      <Text
                        style={[styles.beaconMetaText, { color: '#ff9800' }]}
                      >
                        stale
                      </Text>
                    ) : null}
                    {beacon.alreadySynced ? (
                      <Text
                        style={[styles.beaconMetaText, { color: '#4caf50' }]}
                      >
                        ✓ synced
                      </Text>
                    ) : null}
                  </View>

                  {sourceBadges(beacon.discoverySources).length > 0 ? (
                    <View style={styles.beaconBadgeRow}>
                      {sourceBadges(beacon.discoverySources).map((b) => (
                        <View
                          key={b.label}
                          style={[styles.sourceBadge, { borderColor: b.color }]}
                        >
                          <Text
                            style={[styles.sourceBadgeText, { color: b.color }]}
                          >
                            {b.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {beacon.metadata ? (
                    <View style={styles.beaconBadgeRow}>
                      <Text
                        style={[
                          styles.metaChip,
                          { color: batteryColor(beacon.metadata.batteryLevel) },
                        ]}
                      >
                        🔋 {beacon.metadata.batteryLevel}mV
                      </Text>
                      <Text style={styles.metaChip}>
                        🌡 {beacon.metadata.temperature}°C
                      </Text>
                      <Text style={styles.metaChip}>
                        🚶 {beacon.metadata.movements}
                      </Text>
                      <Text style={styles.metaChip}>
                        v{beacon.metadata.firmwareVersion}
                      </Text>
                      {beacon.txPower !== undefined ? (
                        <Text style={styles.metaChip}>tx {beacon.txPower}</Text>
                      ) : null}
                    </View>
                  ) : null}

                  {beacon.rssiSamples ? (
                    <Text style={styles.beaconMetaText}>
                      RSSI avg {Math.round(beacon.rssiSamples.avg)} dBm (
                      {beacon.rssiSamples.min}…{beacon.rssiSamples.max}, n=
                      {beacon.rssiSamples.count})
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.rssiText}>{beacon.rssi} dB</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <TwoEyesModal
        visible={showTwoEyes}
        onClose={() => setShowTwoEyes(false)}
        nowMs={nowMs}
        events={geofenceEvents}
        onClearLog={clearGeofenceLog}
        location={{
          available: true,
          isInZone: isInBeaconRegion,
          lastEnter: lastEnteredRegionAt,
          lastExit: lastExitedRegionAt,
          enterCount: locationEnterCount,
          beaconsNow: locationBeaconsNow,
          totalDetected: locationKeys.size,
          modeLabel: isActiveScan ? 'RANGING' : 'REGION',
          modeIsActive: isActiveScan,
          cadenceLabel: isActiveScan ? '~1Hz' : 'kernel-level',
          nextScanAt: null,
        }}
        bluetooth={{
          available: isIOS,
          isInZone: isInBluetoothZone,
          lastEnter: lastBtEnterAt,
          lastExit: lastBtExitAt,
          enterCount: btZoneEnterCount,
          beaconsNow: bluetoothBeaconsNow,
          totalDetected: bluetoothKeys.size,
          modeLabel: btScanMode === 'active' ? 'ATIVO' : 'STANDBY',
          modeIsActive: btScanMode === 'active',
          cadenceLabel: btScanMode === 'active' ? '10s tick' : '5min cycle',
          nextScanAt: btNextIdleScanAt,
        }}
      />

      <LogModal
        visible={showLog}
        onClose={() => setShowLog(false)}
        entries={detectionLog}
        onClear={() => {
          BeAround.clearPersistedLog().catch(() => null);
          setDetectionLog([]);
        }}
      />

      <SettingsModal
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        scanPrecision={scanPrecision}
        maxQueuedPayloads={maxQueuedPayloads}
        sdkVersion={sdkVersion}
        onChangePrecision={setScanPrecision}
        onChangeQueue={setMaxQueuedPayloads}
        onApply={() => {
          setShowSettings(false);
          if (isScanning) {
            configureSdk();
          }
        }}
      />
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
  headerActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  eyesButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
    backgroundColor: '#1565c0',
  },
  eyesButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  settingsButton: {
    width: 48,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#0f0f0f',
  },
  settingsButtonText: {
    color: '#bdbdbd',
    fontSize: 18,
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
  readyHint: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
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
  beaconBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  sourceBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  metaChip: {
    color: '#bdbdbd',
    fontSize: 11,
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
