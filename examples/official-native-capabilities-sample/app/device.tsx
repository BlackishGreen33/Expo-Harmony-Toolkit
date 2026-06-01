import * as Device from 'expo-device';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function DeviceFoundationScreen() {
  const [message, setMessage] = useState(
    'Validate expo-device placeholder metadata and getDeviceTypeAsync for v1.9 app-foundation.',
  );
  const [deviceType, setDeviceType] = useState<string>('not checked');

  const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

  const inspectDeviceType = async () => {
    try {
      const nextDeviceType = await Device.getDeviceTypeAsync();
      setDeviceType(String(nextDeviceType));
      setMessage(`Device type OK. value=${String(nextDeviceType)}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>expo-device foundation check</Text>
          <Text style={styles.body}>
            This route validates the v1.9.0 device metadata shim. Real model, build, and hardware
            metadata remain device-side promotion evidence.
          </Text>
          <View style={styles.messageBox}>
            <Text style={styles.message}>{message}</Text>
          </View>
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Device metadata</Text>
            <Text style={styles.resultLine}>brand: {String(Device.brand)}</Text>
            <Text style={styles.resultLine}>manufacturer: {String(Device.manufacturer)}</Text>
            <Text style={styles.resultLine}>modelName: {String(Device.modelName)}</Text>
            <Text style={styles.resultLine}>osName: {String(Device.osName)}</Text>
            <Text style={styles.resultLine}>osVersion: {String(Device.osVersion)}</Text>
            <Text style={styles.resultLine}>isDevice: {String(Device.isDevice)}</Text>
            <Text style={styles.resultLine}>getDeviceTypeAsync: {deviceType}</Text>
          </View>
          <Pressable style={styles.button} onPress={inspectDeviceType}>
            <Text style={styles.buttonLabel}>Check device type</Text>
          </Pressable>
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
  button: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#0f766e' },
  buttonLabel: { color: '#ffffff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  link: { fontSize: 15, fontWeight: '700', color: '#0f766e' },
});
