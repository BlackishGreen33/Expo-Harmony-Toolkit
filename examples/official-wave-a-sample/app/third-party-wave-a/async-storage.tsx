import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const ROUTE_MARKER = 'EXPO_HARMONY_V2_ROUTE:async-storage';
const STORAGE_KEY = 'expo-harmony-v2-wave-a';

export default function AsyncStorageRoute() {
  const [message, setMessage] = useState('Ready to exercise the adapter-backed storage path.');

  const runStorageRoundtrip = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'ok');
      const value = await AsyncStorage.getItem(STORAGE_KEY);
      await AsyncStorage.removeItem(STORAGE_KEY);
      setMessage(`Roundtrip completed with value=${String(value)}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Async Storage adapter lane</Text>
      <Text>{message}</Text>
      <Pressable style={styles.button} onPress={runStorageRoundtrip}>
        <Text style={styles.buttonLabel}>Run storage roundtrip</Text>
      </Pressable>
      <Text style={styles.marker}>{ROUTE_MARKER}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: 18, borderRadius: 16, backgroundColor: '#ffffff' },
  title: { fontSize: 18, fontWeight: '700' },
  button: { alignSelf: 'flex-start', borderRadius: 10, padding: 10, backgroundColor: '#1d4ed8' },
  buttonLabel: { color: '#ffffff', fontWeight: '600' },
  marker: { fontSize: 12, color: '#475569' },
});
