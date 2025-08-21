import {
  PermissionsAndroid,
  Platform,
  Linking,
  type Permission,
} from 'react-native';

type PermissionResult = {
  fineLocation: boolean;
  btScan: boolean;
  btConnect: boolean;
  notifications: boolean;
  backgroundLocation: boolean;
};

const isAndroid = Platform.OS === 'android';
const SDK_INT = isAndroid ? Number(Platform.Version) : 0;

const has = async (p?: Permission) =>
  p ? (await PermissionsAndroid.check(p)) === true : true;

export async function checkPermissions(): Promise<PermissionResult> {
  if (!isAndroid) {
    return {
      fineLocation: true,
      btScan: true,
      btConnect: true,
      notifications: true,
      backgroundLocation: true,
    };
  }

  const hasFine = await has(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
  const hasCoarse = await has(
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
  );
  const fineOrCoarse = hasFine || hasCoarse;

  const btScan =
    SDK_INT >= 31
      ? await has(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN)
      : true;

  const btConnect =
    SDK_INT >= 31
      ? await has(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT)
      : true;

  const notifications =
    SDK_INT >= 33
      ? await has(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)
      : true;

  const backgroundLocation =
    SDK_INT >= 29
      ? await has(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION)
      : true;

  return {
    fineLocation: fineOrCoarse,
    btScan,
    btConnect,
    notifications,
    backgroundLocation,
  };
}

export async function requestForegroundPermissions(): Promise<PermissionResult> {
  if (!isAndroid) return checkPermissions();

  const req = async (p: Permission, title: string, msg: string) => {
    const res = await PermissionsAndroid.request(p, {
      title,
      message: msg,
      buttonPositive: 'OK',
      buttonNegative: 'Cancelar',
    });
    return res === PermissionsAndroid.RESULTS.GRANTED;
  };

  let fineGranted = await req(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    'Permissão de Localização',
    'Precisamos de localização para escanear beacons via Bluetooth.'
  );

  let coarseGranted = false;
  if (!fineGranted) {
    coarseGranted = await req(
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      'Permissão de Localização Aproximada',
      'Se preferir, conceda localização aproximada para permitir o escaneamento.'
    );
  }

  const btScan =
    SDK_INT >= 31
      ? await req(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          'Permissão de Bluetooth',
          'Precisamos de acesso ao Bluetooth para escanear beacons.'
        )
      : true;

  const btConnect =
    SDK_INT >= 31
      ? await req(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          'Permissão de Conexão Bluetooth',
          'Necessário para interagir com dispositivos BLE.'
        )
      : true;

  const notifications =
    SDK_INT >= 33
      ? await req(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          'Permissão de Notificações',
          'Usamos notificações para indicar o monitoramento em andamento.'
        )
      : true;

  const current = await checkPermissions();
  return {
    ...current,
    fineLocation: current.fineLocation || fineGranted || coarseGranted,
    btScan: current.btScan || btScan,
    btConnect: current.btConnect || btConnect,
    notifications: current.notifications || notifications,
  };
}

export async function requestBackgroundLocation(): Promise<boolean> {
  if (!isAndroid || SDK_INT < 29) return true;

  const fg = await checkPermissions();
  if (!fg.fineLocation && SDK_INT < 31) {
    return false;
  }

  const res = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
    {
      title: 'Permissão de Localização em Segundo Plano',
      message:
        'Para detectar beacons enquanto o app não está em uso, permita localização "sempre".',
      buttonPositive: 'Permitir',
      buttonNegative: 'Agora não',
    }
  );

  if (res === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    await Linking.openSettings();
  }

  return res === PermissionsAndroid.RESULTS.GRANTED;
}

export async function ensurePermissions(opts = { askBackground: true }) {
  await requestForegroundPermissions();
  if (opts.askBackground) {
    await requestBackgroundLocation();
  }
  return checkPermissions();
}
