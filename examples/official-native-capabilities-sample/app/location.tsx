import * as Location from 'expo-location';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function LocationPreviewScreen() {
  const watcherRef = useRef<{ remove?: () => void } | null>(null);
  const [message, setMessage] = useState('Tap the actions to exercise the preview bridge.');

  const runPermissionFlow = async () => {
    try {
      await Location.requestForegroundPermissionsAsync();
      setMessage('Preview permission flow executed without throwing.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const runCurrentPositionFlow = async () => {
    try {
      await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setMessage('Preview current-position flow executed without throwing.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const runWatchFlow = async () => {
    try {
      watcherRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
        },
        () => undefined,
      );
      setMessage('Preview watch flow executed without throwing.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const stopWatchFlow = () => {
    watcherRef.current?.remove?.();
    watcherRef.current = null;
    setMessage('Preview watch state cleared.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>expo-location preview</Text>
        <Text style={styles.body}>
          The preview shim reserves foreground permission, current-position, and watchPosition flows so Batch B routes can bundle and render before native runtime promotion.
        </Text>
        <Text style={styles.meta}>Accuracy.Balanced: {String(Location.Accuracy.Balanced)}</Text>
        <Pressable style={styles.button} onPress={runPermissionFlow}>
          <Text style={styles.buttonLabel}>Attempt foreground permission</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={runCurrentPositionFlow}>
          <Text style={styles.buttonLabel}>Attempt current position</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={runWatchFlow}>
          <Text style={styles.buttonLabel}>Attempt watch start</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={stopWatchFlow}>
          <Text style={styles.secondaryButtonLabel}>Clear watch state</Text>
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
    backgroundColor: '#eff6ff',
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
    color: '#1d4ed8',
  },
  button: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  secondaryButton: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
  },
  secondaryButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#111827',
  },
  link: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
});
