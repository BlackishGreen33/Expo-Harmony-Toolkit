import * as ImagePicker from 'expo-image-picker';
import { Link } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type CameraPermissionState = Awaited<ReturnType<typeof ImagePicker.getCameraPermissionsAsync>>;
type MediaPermissionState = Awaited<ReturnType<typeof ImagePicker.getMediaLibraryPermissionsAsync>>;
type PickerResult = Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>;
type PickerAsset = NonNullable<PickerResult['assets']>[number];

const SINGLE_IMAGE_OPTIONS = {
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsMultipleSelection: false,
  selectionLimit: 1,
} as const;

const MULTI_IMAGE_OPTIONS = {
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsMultipleSelection: true,
  selectionLimit: 3,
} as const;

const MIXED_LIBRARY_OPTIONS = {
  mediaTypes: [ImagePicker.MediaTypeOptions.Images, ImagePicker.MediaTypeOptions.Videos],
  allowsMultipleSelection: true,
  selectionLimit: 4,
} as const;

const CAMERA_PHOTO_OPTIONS = {
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
} as const;

const CAMERA_VIDEO_OPTIONS = {
  mediaTypes: ImagePicker.MediaTypeOptions.Videos,
} as const;

export default function ImagePickerPreviewScreen() {
  const [message, setMessage] = useState(
    'Validate single-select, multi-select, mixed library, system photo/video capture, and pending-result recovery.',
  );
  const [mediaPermission, setMediaPermission] = useState<MediaPermissionState | null>(null);
  const [cameraPermission, setCameraPermission] = useState<CameraPermissionState | null>(null);
  const [lastResult, setLastResult] = useState<PickerResult | null>(null);
  const [modeLabel, setModeLabel] = useState('none yet');

  const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

  const getPrimaryAsset = (result: PickerResult | null): PickerAsset | null =>
    result?.canceled ? null : result?.assets?.[0] ?? null;

  const summarizePermission = (
    label: 'Media' | 'Camera',
    permission: MediaPermissionState | CameraPermissionState,
  ) =>
    `${label} permission OK. status=${permission.status} granted=${String(permission.granted)} canAskAgain=${String(
      permission.canAskAgain,
    )}`;

  const summarizeResult = (label: string, result: PickerResult) => {
    if (result.canceled || !result.assets?.[0]) {
      return `${label} canceled. canceled=true assets=0`;
    }

    const asset = result.assets[0];
    return `${label} OK. assets=${result.assets.length} type=${String(asset.type ?? 'n/a')} mimeType=${String(
      asset.mimeType ?? 'n/a',
    )} duration=${String(asset.duration ?? 'n/a')}`;
  };

  const requestMediaPermission = async () => {
    try {
      const nextPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setMediaPermission(nextPermission);
      setMessage(summarizePermission('Media', nextPermission));
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const requestCameraPermission = async () => {
    try {
      const nextPermission = await ImagePicker.requestCameraPermissionsAsync();
      setCameraPermission(nextPermission);
      setMessage(summarizePermission('Camera', nextPermission));
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const checkMediaPermission = async () => {
    try {
      const nextPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
      setMediaPermission(nextPermission);
      setMessage(summarizePermission('Media', nextPermission));
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const checkCameraPermission = async () => {
    try {
      const nextPermission = await ImagePicker.getCameraPermissionsAsync();
      setCameraPermission(nextPermission);
      setMessage(summarizePermission('Camera', nextPermission));
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const runLibraryFlow = async (label: string, options: Record<string, unknown>) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync(options as never);
      setModeLabel(label);
      setLastResult(result);
      setMessage(summarizeResult(label, result));
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const runCameraFlow = async (label: string, options: Record<string, unknown>) => {
    try {
      const result = await ImagePicker.launchCameraAsync(options as never);
      setModeLabel(label);
      setLastResult(result);
      setMessage(summarizeResult(label, result));
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const inspectPendingResult = async () => {
    try {
      const result = await ImagePicker.getPendingResultAsync();

      if (!result) {
        setMessage('Pending result check OK. result=null');
        return;
      }

      setModeLabel('pending result');
      setLastResult(result);
      setMessage(summarizeResult('Pending result', result));
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const clearResult = () => {
    setModeLabel('none yet');
    setLastResult(null);
    setMessage('Cleared latest picker result.');
  };

  const firstAsset = getPrimaryAsset(lastResult);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>expo-image-picker functional check</Text>
          <Text style={styles.body}>
            This route validates the v1.7.2 preview subset: single and multi-select library flows,
            mixed image/video library selection, system photo/video capture, and one-shot pending
            result recovery.
          </Text>
          <View style={styles.messageBox}>
            <Text style={styles.message}>{message}</Text>
          </View>

          <View style={styles.buttonGroup}>
            <Pressable style={styles.button} onPress={requestMediaPermission}>
              <Text style={styles.buttonLabel}>Request media permission</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={checkMediaPermission}>
              <Text style={styles.buttonLabel}>Check media permission</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={requestCameraPermission}>
              <Text style={styles.buttonLabel}>Request camera permission</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={checkCameraPermission}>
              <Text style={styles.buttonLabel}>Check camera permission</Text>
            </Pressable>
            <Pressable
              style={styles.button}
              onPress={() => {
                void runLibraryFlow('Single image library', SINGLE_IMAGE_OPTIONS);
              }}
            >
              <Text style={styles.buttonLabel}>Single image library</Text>
            </Pressable>
            <Pressable
              style={styles.button}
              onPress={() => {
                void runLibraryFlow('Multi-select library', MULTI_IMAGE_OPTIONS);
              }}
            >
              <Text style={styles.buttonLabel}>Multi-select library</Text>
            </Pressable>
            <Pressable
              style={styles.button}
              onPress={() => {
                void runLibraryFlow('Mixed library selection', MIXED_LIBRARY_OPTIONS);
              }}
            >
              <Text style={styles.buttonLabel}>Mixed library selection</Text>
            </Pressable>
            <Pressable
              style={styles.button}
              onPress={() => {
                void runCameraFlow('Camera photo capture', CAMERA_PHOTO_OPTIONS);
              }}
            >
              <Text style={styles.buttonLabel}>Camera photo capture</Text>
            </Pressable>
            <Pressable
              style={styles.button}
              onPress={() => {
                void runCameraFlow('Camera video capture', CAMERA_VIDEO_OPTIONS);
              }}
            >
              <Text style={styles.buttonLabel}>Camera video capture</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={inspectPendingResult}>
              <Text style={styles.buttonLabel}>Check pending result</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={clearResult}>
              <Text style={styles.secondaryButtonLabel}>Clear latest result</Text>
            </Pressable>
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Permission snapshot</Text>
            <Text style={styles.resultLine}>media status: {mediaPermission?.status ?? 'not checked'}</Text>
            <Text style={styles.resultLine}>camera status: {cameraPermission?.status ?? 'not checked'}</Text>
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Latest picker result</Text>
            <Text style={styles.resultLine}>mode: {modeLabel}</Text>
            <Text style={styles.resultLine}>canceled: {String(lastResult?.canceled ?? false)}</Text>
            {firstAsset ? (
              <>
                <Text style={styles.resultLine}>uri: {firstAsset.uri}</Text>
                <Text style={styles.resultLine}>type: {String(firstAsset.type ?? 'n/a')}</Text>
                <Text style={styles.resultLine}>mimeType: {String(firstAsset.mimeType ?? 'n/a')}</Text>
                <Text style={styles.resultLine}>fileSize: {String(firstAsset.fileSize ?? 'n/a')}</Text>
                <Text style={styles.resultLine}>duration: {String(firstAsset.duration ?? 'n/a')}</Text>
                {firstAsset.type === 'image' ? (
                  <View style={styles.imageFrame}>
                    <Image source={{ uri: firstAsset.uri }} style={styles.image} resizeMode="cover" />
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={styles.resultLine}>No asset recorded yet.</Text>
            )}
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Preview boundary</Text>
            <Text style={styles.resultLine}>The current image-picker preview subset no longer keeps orange gaps in the public docs.</Text>
            <Text style={styles.resultLine}>It remains preview until device and release evidence are promoted.</Text>
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
    backgroundColor: '#f8fafc',
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
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1e3a8a',
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
    backgroundColor: '#2563eb',
    alignItems: 'center',
    minWidth: 220,
    flexGrow: 1,
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
    borderColor: '#bfdbfe',
    alignItems: 'center',
    minWidth: 220,
    flexGrow: 1,
  },
  secondaryButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  resultCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#f8fafc',
    gap: 6,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  resultLine: {
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
  },
  imageFrame: {
    marginTop: 10,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#dbeafe',
  },
  image: {
    width: '100%',
    height: 220,
  },
  link: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563eb',
  },
});
