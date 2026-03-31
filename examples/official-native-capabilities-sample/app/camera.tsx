import { CameraView, CameraType, requestCameraPermissionsAsync } from 'expo-camera';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function CameraPreviewScreen() {
  const cameraRef = useRef<{ takePictureAsync?: (options?: Record<string, unknown>) => Promise<unknown> } | null>(null);
  const [message, setMessage] = useState('Tap the actions to exercise the preview bridge.');

  const runPermissionFlow = async () => {
    try {
      await requestCameraPermissionsAsync();
      setMessage('Preview camera permission flow executed without throwing.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const runCaptureFlow = async () => {
    try {
      await cameraRef.current?.takePictureAsync?.({
        quality: 0.5,
        skipProcessing: true,
      });
      setMessage('Preview camera capture flow executed without throwing.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>expo-camera preview</Text>
        <Text style={styles.body}>
          The preview shim renders a managed camera surface and keeps permission and capture entrypoints stable while Harmony-native runtime validation catches up.
        </Text>
        <Text style={styles.meta}>CameraType.back: {String(CameraType.back)}</Text>
        <CameraView ref={cameraRef} facing={CameraType.back} style={styles.previewSurface} />
        <Pressable style={styles.button} onPress={runPermissionFlow}>
          <Text style={styles.buttonLabel}>Attempt camera permission</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={runCaptureFlow}>
          <Text style={styles.buttonLabel}>Attempt preview capture</Text>
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
    backgroundColor: '#fef3c7',
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
    color: '#b45309',
  },
  previewSurface: {
    width: '100%',
  },
  button: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#d97706',
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
    color: '#d97706',
  },
});
