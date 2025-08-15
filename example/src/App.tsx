import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as BeAround from 'bearound-react-sdk';
import { ensurePermissions } from 'bearound-react-sdk';

export default function App() {
  const [last, setLast] = useState<any>(null);
  const [permStatus, setPermStatus] = useState<any>(null);

  useEffect(() => {
    const sub = BeAround.addBeaconListener(setLast);
    const sub2 = BeAround.addStoppedListener(() => console.log('stopped'));
    return () => {
      sub.remove();
      sub2.remove();
    };
  }, []);

  const requestPerms = async () => {
    const status = await ensurePermissions({ askBackground: true });
    setPermStatus(status);
    const ok =
      status.fineLocation &&
      status.btScan &&
      status.btConnect &&
      status.notifications &&
      status.backgroundLocation;

    if (!ok) {
      Alert.alert(
        'Permissões',
        'Algumas permissões ainda não foram concedidas. Conceda todas para iniciar o monitoramento.'
      );
    } else {
      Alert.alert('Permissões', 'Todas as permissões concedidas 🎉');
    }
  };

  const startSdk = async () => {
    // se já temos o status, checa; senão tenta pedir
    const status =
      permStatus ?? (await ensurePermissions({ askBackground: true }));
    const ok =
      status.fineLocation &&
      status.btScan &&
      status.btConnect &&
      status.notifications &&
      status.backgroundLocation;

    if (!ok) {
      Alert.alert(
        'Permissões',
        'Conceda todas as permissões antes de iniciar.'
      );
      return;
    }
    await BeAround.initialize('', true); // clientToken vazio e debug=true (como você quer)
  };

  const stopSdk = async () => {
    await BeAround.stop();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      {/* App Bar */}
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>Bearound React Native SDK</Text>
      </View>

      {/* Área de botões */}
      <View style={styles.buttonsBlock}>
        <View style={styles.btn}>
          <Button
            title="Pedir permissões"
            color="#1976D2"
            onPress={requestPerms}
          />
        </View>
        <View style={styles.btn}>
          <Button title="Iniciar SDK" color="#1976D2" onPress={startSdk} />
        </View>
        <View style={styles.btn}>
          <Button title="Parar SDK" color="#1976D2" onPress={stopSdk} />
        </View>
      </View>

      {/* Último beacon encontrado (texto preto sobre cartão branco) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Último beacon</Text>
        <Text selectable style={styles.cardText}>
          {last ? JSON.stringify(last, null, 2) : '—'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  appBar: {
    height: 56,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: '#121212',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#2a2a2a',
  },
  appBarTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonsBlock: {
    marginTop: '30%', // ~30% da altura da view
    paddingHorizontal: 24,
  },
  btn: {
    marginBottom: 24, // espaçamento de 24px entre os botões
  },
  card: {
    marginTop: 24,
    marginHorizontal: 24,
    padding: 16,
    backgroundColor: '#fff', // cartão branco para texto preto
    borderRadius: 12,
  },
  cardTitle: {
    color: '#000',
    fontWeight: '700',
    marginBottom: 8,
  },
  cardText: {
    color: '#000', // texto do beacon em preto
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 12,
  },
});
