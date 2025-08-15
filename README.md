# 🐻 Bearound React Native SDK

SDK oficial para integrar a detecção segura de beacons BLE da **Bearound** em apps **React Native** (Android e iOS).

> ✅ Compatível com **New Architecture** (TurboModules) e compatível também com a arquitetura clássica.

---

## Sumário

* [Requisitos](#requisitos)
* [Instalação](#instalação)
* [Configuração de Permissões](#configuração-de-permissões)

  * [Android – Manifest](#android--manifest)
  * [iOS – Info.plist e Background Modes](#ios--infoplist-e-background-modes)
* [Uso Rápido](#uso-rápido)
* [API](#api)

  * [Tipos](#tipos)
  * [Funções](#funções)
  * [Eventos](#eventos)
* [Boas Práticas](#boas-práticas)
* [Solução de Problemas](#solução-de-problemas)
* [Licença](#licença)

---

## Requisitos

* **React Native** ≥ 0.73
* **Android**: minSdk **21+** (BLE), Android 12+ exige permissões BLE de runtime
* **iOS**: iOS **13+** (recomendado 15+), Bluetooth e Localização habilitados

> **Importante:** o SDK **não** funciona em simulador iOS para BLE (use dispositivo físico).

---

## Instalação

No projeto React Native:

```bash
# com yarn
yarn add bearound-react-native-sdk

# ou com npm
npm i bearound-react-native-sdk
```

### iOS

Na pasta `example/ios` (ou no seu app):

```bash
cd ios
pod install
```

> O pacote já inclui o framework nativo iOS como **vendored xcframework** no Podspec. Se o seu `Podfile` usa `use_frameworks!`, prefira **estático**:
>
> ```ruby
> use_frameworks! :linkage => :static
> ```

### Android

Nenhuma configuração extra de Gradle é necessária além das permissões. O SDK Android nativo é resolvido como dependência do módulo.

---

## Configuração de Permissões

### Android – Manifest

Adicione em `android/app/src/main/AndroidManifest.xml`:

```xml
<!-- Bluetooth / Localização / Foreground Service / Notificações -->
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.INTERNET" />
```

> **Runtime (Android 10+ / 12+)**: você **deve** solicitar `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `BLUETOOTH_SCAN` e `POST_NOTIFICATIONS` em tempo de execução quando aplicável. Este pacote expõe um helper [`ensurePermissions`](#funções) para facilitar.

### iOS – Info.plist e Background Modes

Em `Info.plist`:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>bluetooth-central</string>
  <string>location</string>
</array>

<key>NSBluetoothAlwaysUsageDescription</key>
<string>Usamos Bluetooth para detectar beacons próximos.</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>Precisamos da sua localização para identificar beacons próximos.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Precisamos da sua localização mesmo em segundo plano para identificar beacons.</string>

<key>NSUserTrackingUsageDescription</key>
<string>Precisamos de permissão para usar o IDFA em iOS 14+.</string>
```

> Ative **Background Modes** (Location + Bluetooth) no target do app.

---

## Uso Rápido

```tsx
import React, {useEffect, useState} from 'react';
import {Alert, Button, Text, View} from 'react-native';
import * as BeAround from 'bearound-react-native-sdk';
import {ensurePermissions} from 'bearound-react-native-sdk';

export default function App() {
  const [last, setLast] = useState<any>(null);

  useEffect(() => {
    // Registre ouvintes ANTES de inicializar para não perder eventos iniciais
    const sub = BeAround.addBeaconListener(setLast);
    const sub2 = BeAround.addStoppedListener(() => console.log('stopped'));
    return () => {
      sub.remove();
      sub2.remove();
    };
  }, []);

  const start = async () => {
    const status = await ensurePermissions({askBackground: true});
    const ok =
      status.fineLocation &&
      status.btScan &&
      status.btConnect &&
      status.notifications &&
      status.backgroundLocation;

    if (!ok) {
      Alert.alert('Permissões', 'Conceda todas as permissões para iniciar.');
      return;
    }

    await BeAround.initialize('<CLIENT_TOKEN>', true); // debug opcional
  };

  return (
    <View style={{padding: 24}}>
      <Button title="Start" onPress={start} />
      <Button title="Stop" onPress={() => BeAround.stop()} />
      <Text>{JSON.stringify(last, null, 2)}</Text>
    </View>
  );
}
```

---

## API

### Tipos

```ts
export type Beacon = {
  uuid: string;
  major: string;
  minor: string;
  rssi: number;
  bluetoothName?: string;
  bluetoothAddress?: string;
  distanceMeters?: number;
};
```

### Funções

```ts
// Inicializa o SDK nativo (Android/iOS) e começa o monitoramento
initialize(clientToken: string, debug?: boolean): Promise<void>;

// Interrompe o monitoramento e finaliza recursos nativos
stop(): Promise<void>;

// Helper para permissões Android (no-ops no iOS)
ensurePermissions(opts?: { askBackground?: boolean }): Promise<{
  fineLocation: boolean;
  btScan: boolean;
  btConnect: boolean;
  notifications: boolean;
  backgroundLocation: boolean;
}>;
```

### Eventos

Use `NativeEventEmitter` já encapsulado pelo pacote via **helpers**:

```ts
// Emite um único beacon quando detectado
addBeaconListener((b: Beacon) => void): EmitterSubscription;

// Emite quando o SDK é parado pelo `stop()`
addStoppedListener(() => void): EmitterSubscription;
```

> **Dica:** sempre remova os listeners no `useEffect`/`componentWillUnmount`.

---

## Boas Práticas

* Registre listeners **antes** de chamar `initialize()`.
* Solicite permissões com contexto ao usuário (use o `ensurePermissions`).
* Android: o serviço em primeiro plano usa o ícone do seu app; garanta um ícone adequado.
* iOS: teste **sempre** em dispositivo físico; ative Background Modes no target.
* Evite inicializar/encerrar repetidamente em sequência; prefira um ciclo de vida claro.

---

## Solução de Problemas

**Não recebo eventos de beacon**

* Verifique permissões de **Localização**/**Bluetooth** (e Background no Android 10+).
* Garanta que os listeners foram registrados **antes** do `initialize()`.
* Teste com um **beacon físico** (ou app como nRF Connect).

**iOS: erro ao compilar envolvendo headers/Codegen**

* Rode `cd ios && pod install` após instalar o pacote.
* Limpe Derived Data no Xcode e recompile.
* Se usar `use_frameworks!`, prefira `:linkage => :static`.

**Android: crash ao reinicializar**

* Evite chamar `initialize()` novamente sem `stop()`. Alguns scanners BLE não permitem alterar configurações após “consumers bound”.

**Permissões Android (API 31+)**

* Garanta `BLUETOOTH_SCAN` e `BLUETOOTH_CONNECT` em runtime. Use `ensurePermissions`.

---

## Licença

MIT © Bearound
