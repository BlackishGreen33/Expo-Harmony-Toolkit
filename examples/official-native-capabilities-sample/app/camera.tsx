import {
  CameraView,
  CameraType,
  getCameraPermissionsAsync,
  requestCameraPermissionsAsync,
} from 'expo-camera';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type CameraPermission = Awaited<ReturnType<typeof getCameraPermissionsAsync>>;
type CameraCapture = Awaited<
  ReturnType<NonNullable<{ takePictureAsync?: (options?: Record<string, unknown>) => Promise<unknown> }>['takePictureAsync']>
>;

type CameraPreviewHandle = {
  takePictureAsync?: (options?: Record<string, unknown>) => Promise<CameraCapture>;
  pausePreview?: () => Promise<void>;
  resumePreview?: () => Promise<void>;
};

type CapturedPhoto = {
  uri: string;
  width: number;
  height: number;
  base64?: string;
  exif?: unknown;
};

export default function CameraFunctionalScreen() {
  const cameraRef = useRef<CameraPreviewHandle | null>(null);
  const [message, setMessage] = useState(
    'Choose one action to validate camera permission, preview state, and capture results step by step.',
  );
  const [permission, setPermission] = useState<CameraPermission | null>(null);
  const [previewPaused, setPreviewPaused] = useState(false);
  const [lastCapture, setLastCapture] = useState<CapturedPhoto | null>(null);

  const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

  const summarizePermission = (nextPermission: CameraPermission) =>
    `Camera permission OK. status=${nextPermission.status} granted=${String(
      nextPermission.granted,
    )} canAskAgain=${String(nextPermission.canAskAgain)}`;

  const summarizeCapture = (prefix: string, capture: CapturedPhoto) =>
    `${prefix} uri=${capture.uri} width=${capture.width} height=${capture.height}`;

  const checkPermission = async () => {
    try {
      const nextPermission = await getCameraPermissionsAsync();
      setPermission(nextPermission);
      setMessage(summarizePermission(nextPermission));
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const requestPermission = async () => {
    try {
      const nextPermission = await requestCameraPermissionsAsync();
      setPermission(nextPermission);
      setMessage(summarizePermission(nextPermission));
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const takePicture = async () => {
    try {
      const result = (await cameraRef.current?.takePictureAsync?.({
        quality: 0.8,
        skipProcessing: true,
      })) as CapturedPhoto | undefined;

      if (!result || typeof result.uri !== 'string') {
        setMessage('Capture returned no photo payload.');
        return;
      }

      setLastCapture({
        uri: result.uri,
        width: result.width,
        height: result.height,
        base64: result.base64,
        exif: result.exif,
      });
      setMessage(summarizeCapture('Capture OK.', result));
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const pausePreview = async () => {
    try {
      await cameraRef.current?.pausePreview?.();
      setPreviewPaused(true);
      setMessage('Preview paused.');
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const resumePreview = async () => {
    try {
      await cameraRef.current?.resumePreview?.();
      setPreviewPaused(false);
      setMessage('Preview resumed.');
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const inspectLastCapture = () => {
    if (!lastCapture) {
      setMessage('Inspect skipped. No capture recorded yet.');
      return;
    }

    setMessage(summarizeCapture('Inspect OK.', lastCapture));
  };

  const clearCapture = () => {
    setLastCapture(null);
    setMessage('Cleared last capture.');
  };

  const runFullFlow = async () => {
    try {
      const nextPermission = await requestCameraPermissionsAsync();
      setPermission(nextPermission);

      if (!nextPermission.granted) {
        setMessage(
          `Full camera flow stopped. status=${nextPermission.status} granted=${String(
            nextPermission.granted,
          )}`,
        );
        return;
      }

      const result = (await cameraRef.current?.takePictureAsync?.({
        quality: 0.8,
        skipProcessing: true,
      })) as CapturedPhoto | undefined;

      if (!result || typeof result.uri !== 'string') {
        setMessage('Full camera flow stopped. No capture payload returned.');
        return;
      }

      setLastCapture({
        uri: result.uri,
        width: result.width,
        height: result.height,
        base64: result.base64,
        exif: result.exif,
      });
      setMessage(summarizeCapture('Full camera flow OK.', result));
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>expo-camera functional check</Text>
          <Text style={styles.body}>
            This route keeps the camera sample focused on the core developer flow: permission state,
            preview lifecycle, capture, inspect, and clear. The goal is to make the first successful
            picture path obvious without extra app logic.
          </Text>
          <Text style={styles.meta}>CameraType.back: {String(CameraType.back)}</Text>
          <View style={styles.messageBox}>
            <Text style={styles.message}>{message}</Text>
          </View>

          <View style={styles.previewFrame}>
            <CameraView ref={cameraRef} facing={CameraType.back} style={styles.previewSurface} />
            <View style={styles.previewOverlay}>
              <Text style={styles.previewOverlayText}>
                {previewPaused ? 'Preview paused' : 'Preview active'}
              </Text>
            </View>
          </View>

          <View style={styles.buttonGroup}>
            <Pressable style={styles.button} onPress={requestPermission}>
              <Text style={styles.buttonLabel}>Request camera permission</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={checkPermission}>
              <Text style={styles.buttonLabel}>Check camera permission</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={takePicture}>
              <Text style={styles.buttonLabel}>Take picture</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={pausePreview}>
              <Text style={styles.buttonLabel}>Pause preview</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={resumePreview}>
              <Text style={styles.buttonLabel}>Resume preview</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={inspectLastCapture}>
              <Text style={styles.buttonLabel}>Inspect last capture</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={clearCapture}>
              <Text style={styles.secondaryButtonLabel}>Clear last capture</Text>
            </Pressable>
          </View>

          <Pressable style={[styles.button, styles.primaryButton]} onPress={runFullFlow}>
            <Text style={styles.buttonLabel}>Run full permission/capture flow</Text>
          </Pressable>
          <Text style={styles.helper}>
            `Take picture` should return the captured file payload and update the preview card below.
            `Pause preview` / `Resume preview` keep the lifecycle explicit for device-side acceptance.
          </Text>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Permission snapshot</Text>
            <Text style={styles.resultLine}>status: {permission?.status ?? 'not checked'}</Text>
            <Text style={styles.resultLine}>granted: {String(permission?.granted ?? false)}</Text>
            <Text style={styles.resultLine}>canAskAgain: {String(permission?.canAskAgain ?? false)}</Text>
            <Text style={styles.resultLine}>previewPaused: {String(previewPaused)}</Text>
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Last capture</Text>
            {lastCapture ? (
              <>
                <Text style={styles.resultLine}>uri: {lastCapture.uri}</Text>
                <Text style={styles.resultLine}>width: {lastCapture.width}</Text>
                <Text style={styles.resultLine}>height: {lastCapture.height}</Text>
                <View style={styles.imageFrame}>
                  <Image resizeMode="cover" source={{ uri: lastCapture.uri }} style={styles.image} />
                </View>
              </>
            ) : (
              <Text style={styles.resultLine}>No capture recorded yet.</Text>
            )}
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
  safeArea: {
    flex: 1,
    backgroundColor: '#fef3c7',
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#ffffff',
    gap: 14,
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
  messageBox: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1f2937',
  },
  previewFrame: {
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#111827',
    minHeight: 260,
  },
  previewSurface: {
    width: '100%',
    minHeight: 260,
  },
  previewOverlay: {
    position: 'absolute',
    right: 12,
    top: 12,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(17, 24, 39, 0.72)',
  },
  previewOverlayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  button: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#d97706',
    alignItems: 'center',
    minWidth: 220,
    flexGrow: 1,
  },
  primaryButton: {
    backgroundColor: '#b45309',
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
    borderWidth: 1,
    borderColor: '#fbbf24',
    alignItems: 'center',
    minWidth: 220,
    flexGrow: 1,
  },
  secondaryButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400e',
  },
  helper: {
    fontSize: 13,
    lineHeight: 18,
    color: '#4b5563',
  },
  resultCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#f8fafc',
    gap: 8,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  resultLine: {
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
  },
  imageFrame: {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
  },
  link: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d97706',
  },
});
