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
const SDK_INT = isAndroid ? parseInt(Platform.Version as string, 10) : 0;

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

  const has = async (p: Permission) =>
    (await PermissionsAndroid.check(p)) === true;

  const fineLocation = await has(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
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

  return { fineLocation, btScan, btConnect, notifications, backgroundLocation };
}

/**
 * Solicita permissões na sequência correta:
 * 1) Foreground (Fine Location + BLE + Notifications)
 * 2) Background Location (em passo separado, se você pedir)
 */
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

  // Always ask fine location first (pré-12 exige; 12+ algumas OEMs ainda esperam)
  const fineLocation = await req(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    'Permissão de Localização',
    'Precisamos de localização para escanear beacons via Bluetooth.'
  );

  // Android 12+ BLE runtime
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
  return { ...current, fineLocation, btScan, btConnect, notifications };
}

/**
 * Solicita Background Location em passo separado (Android 10+).
 * Ideal chamar após o usuário entender por que é necessário.
 */
export async function requestBackgroundLocation(): Promise<boolean> {
  if (!isAndroid || SDK_INT < 29) return true;

  // Precisa do foreground antes:
  const fg = await checkPermissions();
  if (!fg.fineLocation) {
    // Dica: mostrar UI explicando que precisa liberar localização primeiro
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
    // Em alguns OEMs, pode ser necessário mandar para configurações
    await Linking.openSettings();
  }

  return res === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Fluxo completo recomendado:
 * - pede foreground
 * - opcionalmente pede background (se sua UX exigir scanning contínuo)
 */
export async function ensurePermissions(opts = { askBackground: true }) {
  await requestForegroundPermissions();
  if (opts.askBackground) {
    await requestBackgroundLocation();
  }
  return checkPermissions();
}
