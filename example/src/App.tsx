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
import * as BeAround from '@bearound/react-native-sdk';
import { ensurePermissions } from '@bearound/react-native-sdk';

export default function App() {
  const requestPerms = async () => {
    const status = await ensurePermissions({ askBackground: true });

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
    if (Platform.OS === 'android') {
      const status = await ensurePermissions({ askBackground: true });
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
    }

    await BeAround.initialize('', true);
    Alert.alert('Bearound', 'SDK iniciado');
  };

  const stopSdk = async () => {
    await BeAround.stop();
    Alert.alert('Bearound', 'SDK parado');
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
        {Platform.OS === 'android' && (
          <View style={styles.btn}>
            <Button
              title="Pedir permissões"
              color="#1976D2"
              onPress={requestPerms}
            />
          </View>
        )}
        <View style={styles.btn}>
          <Button title="Iniciar SDK" color="#1976D2" onPress={startSdk} />
        </View>
        <View style={styles.btn}>
          <Button title="Parar SDK" color="#1976D2" onPress={stopSdk} />
        </View>
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
    marginTop: '30%',
    paddingHorizontal: 24,
  },
  btn: {
    marginBottom: 24,
  },
});
