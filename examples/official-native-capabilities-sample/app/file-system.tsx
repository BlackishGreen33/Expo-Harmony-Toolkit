import * as FileSystem from 'expo-file-system';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function FileSystemPreviewScreen() {
  const [message, setMessage] = useState('Tap the action to exercise the preview bridge.');

  const runPreviewFlow = async () => {
    try {
      await FileSystem.writeAsStringAsync(
        `${FileSystem.documentDirectory ?? 'file:///expo-harmony/document/'}preview.txt`,
        'expo-harmony-preview',
      );
      setMessage('Preview bridge executed without throwing.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>expo-file-system preview</Text>
        <Text style={styles.body}>
          The preview shim makes bundle-time resolution deterministic while the Harmony runtime implementation is still being verified.
        </Text>
        <Text style={styles.meta}>documentDirectory: {FileSystem.documentDirectory ?? 'n/a'}</Text>
        <Pressable style={styles.button} onPress={runPreviewFlow}>
          <Text style={styles.buttonLabel}>Attempt preview write</Text>
        </Pressable>
        <Text style={styles.message}>{message}</Text>
        <Link href="/" style={styles.link}>
          Back to home
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#ffffff',
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
  },
  meta: {
    fontSize: 14,
    lineHeight: 20,
    color: '#134e4a',
  },
  button: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0f766e',
    alignItems: 'center',
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#111827',
  },
  link: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f766e',
  },
});
