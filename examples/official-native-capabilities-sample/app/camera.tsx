import {
  CameraType,
  CameraView,
  getCameraPermissionsAsync,
  getMicrophonePermissionsAsync,
  requestCameraPermissionsAsync,
  requestMicrophonePermissionsAsync,
} from 'expo-camera';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

type CameraPermission = Awaited<ReturnType<typeof getCameraPermissionsAsync>>;
type MicrophonePermission = Awaited<ReturnType<typeof getMicrophonePermissionsAsync>>;

type CameraHandle = {
  takePictureAsync?: (options?: Record<string, unknown>) => Promise<{
    uri: string;
    width: number;
    height: number;
  }>;
  pausePreview?: () => Promise<unknown>;
  resumePreview?: () => Promise<unknown>;
  recordAsync?: (options?: Record<string, unknown>) => Promise<{
    uri: string;
    duration?: number;
    fileSize?: number | null;
    mimeType?: string;
  }>;
  stopRecording?: () => Promise<unknown>;
  toggleRecordingAsync?: (options?: Record<string, unknown>) => Promise<unknown>;
};

export default function CameraFunctionalScreen() {
  const cameraRef = useRef<CameraHandle | null>(null);
  const [message, setMessage] = useState(
    'Validate embedded preview, pause/resume, still photo capture, microphone permission, and video recording controls.',
  );
  const [cameraPermission, setCameraPermission] = useState<CameraPermission | null>(null);
  const [microphonePermission, setMicrophonePermission] = useState<MicrophonePermission | null>(null);
  const [previewState, setPreviewState] = useState<'running' | 'paused'>('running');
  const [lastPhoto, setLastPhoto] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [lastVideo, setLastVideo] = useState<{
    uri: string;
    duration?: number;
    fileSize?: number | null;
    mimeType?: string;
  } | null>(null);

  const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

  const requestCameraPermission = async () => {
    try {
      const permission = await requestCameraPermissionsAsync();
      setCameraPermission(permission);
      setMessage(`Camera permission OK. status=${permission.status} granted=${String(permission.granted)}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      const permission = await requestMicrophonePermissionsAsync();
      setMicrophonePermission(permission);
      setMessage(`Microphone permission OK. status=${permission.status} granted=${String(permission.granted)}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const checkPermissions = async () => {
    try {
      const nextCamera = await getCameraPermissionsAsync();
      const nextMic = await getMicrophonePermissionsAsync();
      setCameraPermission(nextCamera);
      setMicrophonePermission(nextMic);
      setMessage(
        `Permission snapshot OK. camera=${nextCamera.status}/${String(nextCamera.granted)} microphone=${nextMic.status}/${String(nextMic.granted)}`,
      );
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const takePicture = async () => {
    try {
      const result = await cameraRef.current?.takePictureAsync?.({
        quality: 0.8,
        skipProcessing: true,
      });

      if (!result) {
        setMessage('Take picture returned no photo payload.');
        return;
      }

      setLastPhoto(result);
      setMessage(`Still photo result OK. uri=${result.uri}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const pausePreview = async () => {
    try {
      await cameraRef.current?.pausePreview?.();
      setPreviewState('paused');
      setMessage('Preview paused OK.');
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const resumePreview = async () => {
    try {
      await cameraRef.current?.resumePreview?.();
      setPreviewState('running');
      setMessage('Preview resumed OK.');
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const startRecording = async () => {
    try {
      const result = await cameraRef.current?.recordAsync?.({
        maxDuration: 10,
      });

      if (!result) {
        setMessage('Video recording returned no payload.');
        return;
      }

      setLastVideo(result);
      setMessage(`Video recording start/stop OK. uri=${result.uri}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const stopRecording = async () => {
    try {
      await cameraRef.current?.stopRecording?.();
      setMessage('Stop recording OK.');
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const toggleRecording = async () => {
    try {
      await cameraRef.current?.toggleRecordingAsync?.({
        maxDuration: 10,
      });
      setMessage('Toggle recording OK.');
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
            This route validates the v1.7.2 preview subset: embedded live preview, preview
            pause/resume, still capture, video recording controls, and microphone permission
            snapshots.
          </Text>
          <View style={styles.messageBox}>
            <Text style={styles.message}>{message}</Text>
          </View>

          <View style={styles.captureFrame}>
            <CameraView ref={cameraRef} facing={CameraType.back} style={styles.captureSurface} />
          </View>

          <View style={styles.buttonGroup}>
            <Pressable style={styles.button} onPress={requestCameraPermission}>
              <Text style={styles.buttonLabel}>Request camera permission</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={requestMicrophonePermission}>
              <Text style={styles.buttonLabel}>Request microphone permission</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={checkPermissions}>
              <Text style={styles.buttonLabel}>Check permission snapshot</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={pausePreview}>
              <Text style={styles.buttonLabel}>Pause preview</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={resumePreview}>
              <Text style={styles.buttonLabel}>Resume preview</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={takePicture}>
              <Text style={styles.buttonLabel}>Take picture</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={startRecording}>
              <Text style={styles.buttonLabel}>Start video recording</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={stopRecording}>
              <Text style={styles.buttonLabel}>Stop video recording</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={toggleRecording}>
              <Text style={styles.buttonLabel}>Toggle recording</Text>
            </Pressable>
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Preview state</Text>
            <Text style={styles.resultLine}>preview state: {previewState}</Text>
            <Text style={styles.resultLine}>camera status: {cameraPermission?.status ?? 'not checked'}</Text>
            <Text style={styles.resultLine}>microphone status: {microphonePermission?.status ?? 'not checked'}</Text>
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Still photo result</Text>
            {lastPhoto ? (
              <>
                <Text style={styles.resultLine}>uri: {lastPhoto.uri}</Text>
                <Text style={styles.resultLine}>width: {lastPhoto.width}</Text>
                <Text style={styles.resultLine}>height: {lastPhoto.height}</Text>
                <View style={styles.imageFrame}>
                  <Image resizeMode="cover" source={{ uri: lastPhoto.uri }} style={styles.image} />
                </View>
              </>
            ) : (
              <Text style={styles.resultLine}>No still photo yet.</Text>
            )}
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Video recording result</Text>
            {lastVideo ? (
              <>
                <Text style={styles.resultLine}>uri: {lastVideo.uri}</Text>
                <Text style={styles.resultLine}>duration: {String(lastVideo.duration ?? 'n/a')}</Text>
                <Text style={styles.resultLine}>fileSize: {String(lastVideo.fileSize ?? 'n/a')}</Text>
                <Text style={styles.resultLine}>mimeType: {String(lastVideo.mimeType ?? 'n/a')}</Text>
              </>
            ) : (
              <Text style={styles.resultLine}>No video recording yet.</Text>
            )}
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Preview boundary</Text>
            <Text style={styles.resultLine}>The current camera preview docs no longer keep orange gaps for preview, pause/resume, microphone, or video.</Text>
            <Text style={styles.resultLine}>This route still stays preview until device and release evidence are promoted.</Text>
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
  captureFrame: {
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#111827',
  },
  captureSurface: {
    width: '100%',
    minHeight: 220,
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
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  resultCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#fff7ed',
    gap: 6,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400e',
  },
  resultLine: {
    fontSize: 14,
    lineHeight: 20,
    color: '#78350f',
  },
  imageFrame: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#fde68a',
  },
  image: {
    width: '100%',
    height: 220,
  },
  link: {
    fontSize: 15,
    fontWeight: '600',
    color: '#d97706',
  },
});
