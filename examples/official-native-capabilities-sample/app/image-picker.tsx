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
type PickerSource = 'image library' | 'camera capture';

export default function ImagePickerPreviewScreen() {
  const [message, setMessage] = useState(
    'Choose one action to validate image-picker permissions, cancel paths, and returned assets step by step.',
  );
  const [mediaPermission, setMediaPermission] = useState<MediaPermissionState | null>(null);
  const [cameraPermission, setCameraPermission] = useState<CameraPermissionState | null>(null);
  const [lastResult, setLastResult] = useState<PickerResult | null>(null);
  const [lastResultSource, setLastResultSource] = useState<PickerSource | null>(null);

  const pickerOptions = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: false,
    selectionLimit: 1,
  } as const;

  const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

  const summarizePermission = (
    label: 'Media' | 'Camera',
    permission: MediaPermissionState | CameraPermissionState,
  ) =>
    `${label} permission OK. status=${permission.status} granted=${String(permission.granted)} canAskAgain=${String(
      permission.canAskAgain,
    )} access=${String('accessPrivileges' in permission ? permission.accessPrivileges ?? 'n/a' : 'n/a')}`;

  const summarizeAsset = (prefix: string, asset: PickerAsset) =>
    `${prefix} name=${String(asset.fileName ?? 'n/a')} type=${String(asset.type ?? 'n/a')} size=${String(
      asset.fileSize ?? 'n/a',
    )} width=${asset.width} height=${asset.height}`;

  const getFirstAsset = (result: PickerResult | null): PickerAsset | null =>
    result && !result.canceled ? result.assets?.[0] ?? null : null;

  const refreshMediaPermission = async () => {
    const nextPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
    setMediaPermission(nextPermission);
    return nextPermission;
  };

  const refreshCameraPermission = async () => {
    const nextPermission = await ImagePicker.getCameraPermissionsAsync();
    setCameraPermission(nextPermission);
    return nextPermission;
  };

  const formatPickerError = async (scope: 'Image library' | 'Camera capture', error: unknown) => {
    const rawError = formatError(error);

    if (rawError.includes('ohos.permission.READ_IMAGEVIDEO')) {
      try {
        const nextPermission = await refreshMediaPermission();
        return `${scope} blocked. mediaStatus=${nextPermission.status} granted=${String(
          nextPermission.granted,
        )} access=${String(nextPermission.accessPrivileges ?? 'n/a')}`;
      } catch {
        return `${scope} blocked. ${rawError}`;
      }
    }

    if (rawError.includes('ohos.permission.CAMERA')) {
      try {
        const nextPermission = await refreshCameraPermission();
        return `${scope} blocked. cameraStatus=${nextPermission.status} granted=${String(nextPermission.granted)}`;
      } catch {
        return `${scope} blocked. ${rawError}`;
      }
    }

    return rawError;
  };

  const inspectResult = (result: PickerResult, source: PickerSource) => {
    const asset = getFirstAsset(result);

    if (result.canceled || !asset) {
      return `Inspect OK. source=${source} canceled=true assets=0`;
    }

    return summarizeAsset(`Inspect OK. source=${source} canceled=false`, asset);
  };

  const syncMediaPermission = async () => {
    try {
      const nextPermission = await refreshMediaPermission();
      setMessage(summarizePermission('Media', nextPermission));
    } catch (error) {
      setMessage(formatError(error));
    }
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

  const syncCameraPermission = async () => {
    try {
      const nextPermission = await refreshCameraPermission();
      setMessage(summarizePermission('Camera', nextPermission));
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

  const launchImageLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
      setLastResult(result);
      setLastResultSource('image library');
      if (result.canceled || !result.assets?.[0]) {
        setMessage('Image library canceled. canceled=true assets=0');
        return;
      }

      const asset = result.assets[0];
      setMessage(summarizeAsset('Library pick OK.', asset));
    } catch (error) {
      setMessage(await formatPickerError('Image library', error));
    }
  };

  const launchCamera = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync(pickerOptions);
      setLastResult(result);
      setLastResultSource('camera capture');
      if (result.canceled || !result.assets?.[0]) {
        setMessage('Camera capture canceled. canceled=true assets=0');
        return;
      }

      const asset = result.assets[0];
      setMessage(summarizeAsset('Camera capture OK.', asset));
    } catch (error) {
      setMessage(await formatPickerError('Camera capture', error));
    }
  };

  const inspectLatestResult = () => {
    if (!lastResult || !lastResultSource) {
      setMessage('Inspect skipped. No picker result recorded yet.');
      return;
    }

    setMessage(inspectResult(lastResult, lastResultSource));
  };

  const clearResult = () => {
    setLastResult(null);
    setLastResultSource(null);
    setMessage('Cleared latest picker result.');
  };

  const runFullImageLibraryFlow = async () => {
    try {
      const nextPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setMediaPermission(nextPermission);

      if (!nextPermission.granted) {
        setMessage(
          `Full media flow stopped. status=${nextPermission.status} granted=${String(
            nextPermission.granted,
          )} access=${String(nextPermission.accessPrivileges ?? 'n/a')}`,
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
      setLastResult(result);
      setLastResultSource('image library');

      if (result.canceled || !result.assets?.[0]) {
        setMessage('Full media flow canceled. canceled=true assets=0');
        return;
      }

      setMessage(summarizeAsset('Full media flow OK.', result.assets[0]));
    } catch (error) {
      setMessage(await formatPickerError('Image library', error));
    }
  };

  const runFullCameraFlow = async () => {
    try {
      const nextCameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      setCameraPermission(nextCameraPermission);

      if (!nextCameraPermission.granted) {
        setMessage(
          `Full camera flow stopped. cameraStatus=${nextCameraPermission.status} granted=${String(
            nextCameraPermission.granted,
          )}`,
        );
        return;
      }

      const nextMediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setMediaPermission(nextMediaPermission);

      if (!nextMediaPermission.granted) {
        setMessage(
          `Full camera flow stopped. mediaStatus=${nextMediaPermission.status} granted=${String(
            nextMediaPermission.granted,
          )} access=${String(nextMediaPermission.accessPrivileges ?? 'n/a')}`,
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync(pickerOptions);
      setLastResult(result);
      setLastResultSource('camera capture');

      if (result.canceled || !result.assets?.[0]) {
        setMessage('Full camera flow canceled. canceled=true assets=0');
        return;
      }

      setMessage(summarizeAsset('Full camera flow OK.', result.assets[0]));
    } catch (error) {
      setMessage(await formatPickerError('Camera capture', error));
    }
  };

  const firstAsset = getFirstAsset(lastResult);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>expo-image-picker functional check</Text>
          <Text style={styles.body}>
            This route exposes single-step permission, pick, inspect, and clear actions so you can
            validate real asset returns, cancel paths, and denied permissions separately before
            running the full flows.
          </Text>
          <Text style={styles.meta}>MediaTypeOptions.Images: {String(ImagePicker.MediaTypeOptions.Images)}</Text>
          <View style={styles.messageBox}>
            <Text style={styles.message}>{message}</Text>
          </View>
          <View style={styles.buttonGroup}>
            <Pressable style={styles.button} onPress={requestMediaPermission}>
              <Text style={styles.buttonLabel}>Request media permission</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={syncMediaPermission}>
              <Text style={styles.buttonLabel}>Check media permission</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={requestCameraPermission}>
              <Text style={styles.buttonLabel}>Request camera permission</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={syncCameraPermission}>
              <Text style={styles.buttonLabel}>Check camera permission</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={launchImageLibrary}>
              <Text style={styles.buttonLabel}>Launch image library</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={launchCamera}>
              <Text style={styles.buttonLabel}>Launch camera capture</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={inspectLatestResult}>
              <Text style={styles.buttonLabel}>Inspect latest picker result</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={clearResult}>
              <Text style={styles.secondaryButtonLabel}>Clear latest result</Text>
            </Pressable>
          </View>
          <Pressable style={[styles.button, styles.primaryButton]} onPress={runFullImageLibraryFlow}>
            <Text style={styles.buttonLabel}>Run full media permission/pick flow</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.primaryButton]} onPress={runFullCameraFlow}>
            <Text style={styles.buttonLabel}>Run full camera permission/capture flow</Text>
          </Pressable>
          <Text style={styles.helper}>
            `Launch image library` and `Launch camera capture` open system UI. A returned
            `canceled=true` result is valid cancel-path evidence, and a denied permission message is
            expected when you reject the system prompt.
          </Text>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Media permission snapshot</Text>
            <Text style={styles.resultLine}>status: {mediaPermission?.status ?? 'not checked'}</Text>
            <Text style={styles.resultLine}>granted: {String(mediaPermission?.granted ?? false)}</Text>
            <Text style={styles.resultLine}>
              canAskAgain: {String(mediaPermission?.canAskAgain ?? false)}
            </Text>
            <Text style={styles.resultLine}>
              accessPrivileges: {String(mediaPermission?.accessPrivileges ?? 'n/a')}
            </Text>
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Camera permission snapshot</Text>
            <Text style={styles.resultLine}>status: {cameraPermission?.status ?? 'not checked'}</Text>
            <Text style={styles.resultLine}>granted: {String(cameraPermission?.granted ?? false)}</Text>
            <Text style={styles.resultLine}>
              canAskAgain: {String(cameraPermission?.canAskAgain ?? false)}
            </Text>
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Latest asset</Text>
            <Text style={styles.resultLine}>source: {lastResultSource ?? 'none yet'}</Text>
            <Text style={styles.resultLine}>canceled: {String(lastResult?.canceled ?? false)}</Text>
            {firstAsset ? (
              <>
                <Text style={styles.resultLine}>uri: {firstAsset.uri}</Text>
                <Text style={styles.resultLine}>fileName: {String(firstAsset.fileName ?? 'n/a')}</Text>
                <Text style={styles.resultLine}>fileSize: {String(firstAsset.fileSize ?? 'n/a')}</Text>
                <Text style={styles.resultLine}>width: {firstAsset.width}</Text>
                <Text style={styles.resultLine}>height: {firstAsset.height}</Text>
                <Text style={styles.resultLine}>mimeType: {String(firstAsset.mimeType ?? 'n/a')}</Text>
                <View style={styles.previewFrame}>
                  <Image
                    resizeMode="cover"
                    source={{ uri: firstAsset.uri }}
                    style={styles.previewImage}
                  />
                </View>
              </>
            ) : (
              <Text style={styles.resultLine}>No asset selected yet.</Text>
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
    backgroundColor: '#ecfccb',
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
    color: '#3f6212',
  },
  messageBox: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#f7fee7',
    borderWidth: 1,
    borderColor: '#bef264',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1f2937',
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
    backgroundColor: '#4d7c0f',
    alignItems: 'center',
    minWidth: 220,
    flexGrow: 1,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  primaryButton: {
    backgroundColor: '#3f6212',
  },
  secondaryButton: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#84cc16',
    alignItems: 'center',
    minWidth: 220,
    flexGrow: 1,
  },
  secondaryButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#365314',
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
  previewFrame: {
    marginTop: 8,
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d9f99d',
    backgroundColor: '#f7fee7',
  },
  previewImage: {
    width: '100%',
    aspectRatio: 1,
  },
  link: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4d7c0f',
  },
});
