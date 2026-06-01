import * as SecureStore from 'expo-secure-store';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const STORAGE_KEY = 'expo-harmony-v1.9-secure-store';
const STORAGE_VALUE = 'foundation-baseline';

export default function SecureStoreFoundationScreen() {
  const [message, setMessage] = useState(
    'Validate expo-secure-store session shim writes, reads, deletes, and availability.',
  );
  const [latestValue, setLatestValue] = useState<string | null>(null);

  const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

  const checkAvailability = async () => {
    try {
      const available = await SecureStore.isAvailableAsync();
      setMessage(`Secure store availability OK. available=${String(available)}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const writeValue = async () => {
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, STORAGE_VALUE);
      setMessage(`Write secure-store value OK. key=${STORAGE_KEY}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const readValue = async () => {
    try {
      const value = await SecureStore.getItemAsync(STORAGE_KEY);
      setLatestValue(value);
      setMessage(`Read secure-store value OK. value=${String(value)}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const deleteValue = async () => {
    try {
      await SecureStore.deleteItemAsync(STORAGE_KEY);
      setLatestValue(null);
      setMessage('Delete secure-store value OK.');
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>expo-secure-store foundation check</Text>
          <Text style={styles.body}>
            This route validates the v1.9.0 app-foundation shim. It keeps JS startup and bundle/debug
            paths stable, but encrypted persistence still requires native device evidence.
          </Text>
          <View style={styles.messageBox}>
            <Text style={styles.message}>{message}</Text>
          </View>
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Latest value</Text>
            <Text style={styles.resultLine}>{latestValue ?? 'No value read yet.'}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.button} onPress={checkAvailability}>
              <Text style={styles.buttonLabel}>Check availability</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={writeValue}>
              <Text style={styles.buttonLabel}>Write secure value</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={readValue}>
              <Text style={styles.buttonLabel}>Read secure value</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={deleteValue}>
              <Text style={styles.buttonLabel}>Delete secure value</Text>
            </Pressable>
          </View>
          <Link href="/" style={styles.link}>
            Back to home
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 560, borderRadius: 18, padding: 24, backgroundColor: '#ffffff', gap: 14 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  body: { fontSize: 15, lineHeight: 22, color: '#475467' },
  messageBox: { borderRadius: 14, padding: 14, backgroundColor: '#eff6ff' },
  message: { fontSize: 14, lineHeight: 20, color: '#1e3a8a' },
  resultCard: { borderRadius: 14, padding: 14, backgroundColor: '#f8fafc', gap: 6 },
  resultTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  resultLine: { fontSize: 14, lineHeight: 20, color: '#475467' },
  actions: { gap: 10 },
  button: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#0f766e' },
  buttonLabel: { color: '#ffffff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  link: { fontSize: 15, fontWeight: '700', color: '#0f766e' },
});
