import * as Haptics from 'expo-haptics';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function HapticsFoundationScreen() {
  const [message, setMessage] = useState(
    'Validate expo-haptics no-op-safe selection, impact, and notification calls.',
  );

  const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

  const runSelection = async () => {
    try {
      await Haptics.selectionAsync();
      setMessage('Haptics selectionAsync OK.');
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const runImpact = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setMessage('Haptics impactAsync OK.');
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const runNotification = async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessage('Haptics notificationAsync OK.');
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>expo-haptics foundation check</Text>
          <Text style={styles.body}>
            This route validates the v1.9.0 haptics shim. Calls resolve safely for bundle/debug
            coverage, while physical feedback remains device-side promotion evidence.
          </Text>
          <View style={styles.messageBox}>
            <Text style={styles.message}>{message}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.button} onPress={runSelection}>
              <Text style={styles.buttonLabel}>Run selectionAsync</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={runImpact}>
              <Text style={styles.buttonLabel}>Run impactAsync</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={runNotification}>
              <Text style={styles.buttonLabel}>Run notificationAsync</Text>
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
  actions: { gap: 10 },
  button: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#0f766e' },
  buttonLabel: { color: '#ffffff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  link: { fontSize: 15, fontWeight: '700', color: '#0f766e' },
});
