import * as Clipboard from 'expo-clipboard';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const CLIPBOARD_TEXT = 'expo-harmony-v1.9-clipboard';
const CLIPBOARD_URL = 'https://example.com/expo-harmony-clipboard';

export default function ClipboardFoundationScreen() {
  const [message, setMessage] = useState(
    'Validate expo-clipboard session shim strings, URL helpers, and hasStringAsync.',
  );
  const [clipboardValue, setClipboardValue] = useState('No clipboard read yet.');

  const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

  const writeString = async () => {
    try {
      await Clipboard.setStringAsync(CLIPBOARD_TEXT);
      setMessage('Clipboard setStringAsync OK.');
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const readString = async () => {
    try {
      const value = await Clipboard.getStringAsync();
      const hasString = await Clipboard.hasStringAsync();
      setClipboardValue(`${value} hasString=${String(hasString)}`);
      setMessage('Clipboard getStringAsync OK.');
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const writeUrl = async () => {
    try {
      await Clipboard.setUrlAsync(CLIPBOARD_URL);
      const value = await Clipboard.getUrlAsync();
      setClipboardValue(String(value));
      setMessage('Clipboard URL helpers OK.');
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>expo-clipboard foundation check</Text>
          <Text style={styles.body}>
            This route validates the v1.9.0 clipboard session shim. Real system pasteboard behavior
            stays pending until native adapter evidence is recorded.
          </Text>
          <View style={styles.messageBox}>
            <Text style={styles.message}>{message}</Text>
          </View>
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Clipboard result</Text>
            <Text style={styles.resultLine}>{clipboardValue}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.button} onPress={writeString}>
              <Text style={styles.buttonLabel}>Write clipboard string</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={readString}>
              <Text style={styles.buttonLabel}>Read clipboard string</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={writeUrl}>
              <Text style={styles.buttonLabel}>Write clipboard URL</Text>
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
