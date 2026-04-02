import * as Location from 'expo-location';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

type ForegroundPermission = Awaited<ReturnType<typeof Location.getForegroundPermissionsAsync>>;
type BackgroundPermission = Awaited<ReturnType<typeof Location.getBackgroundPermissionsAsync>>;
type LocationPoint = Awaited<ReturnType<typeof Location.getCurrentPositionAsync>>;
type HeadingPoint = Awaited<ReturnType<typeof Location.getHeadingAsync>>;

const SAMPLE_ADDRESS = '1 Huawei Plaza, Shenzhen';

export default function LocationFunctionalScreen() {
  const [message, setMessage] = useState(
    'Validate foreground/background permission, current and watch updates, plus heading snapshot and heading watch.',
  );
  const [foregroundPermission, setForegroundPermission] = useState<ForegroundPermission | null>(null);
  const [backgroundPermission, setBackgroundPermission] = useState<BackgroundPermission | null>(null);
  const [servicesEnabled, setServicesEnabled] = useState<boolean | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(null);
  const [watchUpdates, setWatchUpdates] = useState<LocationPoint[]>([]);
  const [headingSnapshot, setHeadingSnapshot] = useState<HeadingPoint | null>(null);
  const [headingUpdates, setHeadingUpdates] = useState<HeadingPoint[]>([]);
  const watchRef = useRef<{ remove: () => void } | null>(null);
  const headingWatchRef = useRef<{ remove: () => void } | null>(null);

  const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

  const requestForegroundPermission = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      setForegroundPermission(permission);
      setMessage(`Foreground permission OK. status=${permission.status} granted=${String(permission.granted)}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const requestBackgroundPermission = async () => {
    try {
      const permission = await Location.requestBackgroundPermissionsAsync();
      setBackgroundPermission(permission);
      setMessage(`Background permission OK. status=${permission.status} granted=${String(permission.granted)}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const captureCurrentPosition = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrentLocation(location);
      setMessage(`Current position OK. latitude=${location.coords.latitude.toFixed(6)} longitude=${location.coords.longitude.toFixed(6)}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const startWatchPosition = async () => {
    try {
      watchRef.current?.remove();
      setWatchUpdates([]);
      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 1,
        } as never,
        (update) => {
          setWatchUpdates((current) => [...current, update].slice(-6));
        },
      );
      setMessage('Start watch position OK.');
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const stopWatchPosition = () => {
    watchRef.current?.remove();
    watchRef.current = null;
    setMessage('Stop watch position OK.');
  };

  const captureHeading = async () => {
    try {
      const heading = await Location.getHeadingAsync();
      setHeadingSnapshot(heading);
      setMessage(`Heading snapshot OK. magHeading=${heading.magHeading} trueHeading=${String(heading.trueHeading)}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const startWatchHeading = async () => {
    try {
      headingWatchRef.current?.remove();
      setHeadingUpdates([]);
      headingWatchRef.current = await Location.watchHeadingAsync((heading) => {
        setHeadingUpdates((current) => [...current, heading].slice(-6));
      });
      setMessage('Start heading watch OK.');
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const stopWatchHeading = () => {
    headingWatchRef.current?.remove();
    headingWatchRef.current = null;
    setMessage('Stop heading watch OK.');
  };

  const refreshProviderState = async () => {
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      setServicesEnabled(enabled);
      setMessage(`Provider status OK. servicesEnabled=${String(enabled)}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const geocodeAddress = async () => {
    try {
      const results = await Location.geocodeAsync(SAMPLE_ADDRESS);
      setMessage(`Geocode OK. results=${results.length} address=${SAMPLE_ADDRESS}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const reverseGeocodeLatestFix = async () => {
    if (!currentLocation) {
      setMessage('Reverse geocode skipped. Capture a current fix first.');
      return;
    }

    try {
      const results = await Location.reverseGeocodeAsync({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });
      setMessage(`Reverse geocode OK. results=${results.length}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>expo-location functional check</Text>
          <Text style={styles.body}>
            This route validates the v1.7.2 preview subset: foreground/background permissions,
            current fix, watch start/stop, heading snapshot/watch, and geocode helpers.
          </Text>
          <View style={styles.messageBox}>
            <Text style={styles.message}>{message}</Text>
          </View>
          <View style={styles.buttonGroup}>
            <Pressable style={styles.button} onPress={requestForegroundPermission}>
              <Text style={styles.buttonLabel}>Request foreground permission</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={requestBackgroundPermission}>
              <Text style={styles.buttonLabel}>Request background permission</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={refreshProviderState}>
              <Text style={styles.buttonLabel}>Check provider status</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={captureCurrentPosition}>
              <Text style={styles.buttonLabel}>Get current position</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={startWatchPosition}>
              <Text style={styles.buttonLabel}>Start watch position</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={stopWatchPosition}>
              <Text style={styles.buttonLabel}>Stop watch position</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={captureHeading}>
              <Text style={styles.buttonLabel}>Get heading snapshot</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={startWatchHeading}>
              <Text style={styles.buttonLabel}>Start heading watch</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={stopWatchHeading}>
              <Text style={styles.buttonLabel}>Stop heading watch</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={geocodeAddress}>
              <Text style={styles.buttonLabel}>Geocode sample address</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={reverseGeocodeLatestFix}>
              <Text style={styles.buttonLabel}>Reverse geocode latest fix</Text>
            </Pressable>
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Permission snapshot</Text>
            <Text style={styles.resultLine}>foreground: {foregroundPermission?.status ?? 'not checked'}</Text>
            <Text style={styles.resultLine}>background: {backgroundPermission?.status ?? 'not checked'}</Text>
            <Text style={styles.resultLine}>servicesEnabled: {String(servicesEnabled ?? false)}</Text>
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Latest location</Text>
            {currentLocation ? (
              <>
                <Text style={styles.resultLine}>latitude: {currentLocation.coords.latitude}</Text>
                <Text style={styles.resultLine}>longitude: {currentLocation.coords.longitude}</Text>
                <Text style={styles.resultLine}>accuracy: {String(currentLocation.coords.accuracy ?? 'n/a')}</Text>
              </>
            ) : (
              <Text style={styles.resultLine}>No current fix yet.</Text>
            )}
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Watch updates</Text>
            <Text style={styles.resultLine}>update count: {watchUpdates.length}</Text>
            {watchUpdates.map((update, index) => (
              <Text key={`${update.timestamp}-${index}`} style={styles.resultLine}>
                #{index + 1} lat={update.coords.latitude} lng={update.coords.longitude}
              </Text>
            ))}
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Heading updates</Text>
            <Text style={styles.resultLine}>snapshot: {headingSnapshot ? `${headingSnapshot.magHeading}` : 'none yet'}</Text>
            <Text style={styles.resultLine}>heading update count: {headingUpdates.length}</Text>
            {headingUpdates.map((update, index) => (
              <Text key={`${update.magHeading}-${index}`} style={styles.resultLine}>
                #{index + 1} mag={update.magHeading} true={String(update.trueHeading)}
              </Text>
            ))}
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Preview boundary</Text>
            <Text style={styles.resultLine}>The public location docs no longer keep orange gaps for watch, background permission, or heading.</Text>
            <Text style={styles.resultLine}>The contract still stays preview until device and release evidence are promoted.</Text>
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
    backgroundColor: '#fefce8',
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
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
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
    backgroundColor: '#fffbeb',
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
  link: {
    fontSize: 15,
    fontWeight: '600',
    color: '#d97706',
  },
});
