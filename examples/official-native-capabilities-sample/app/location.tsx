import * as Location from 'expo-location';
import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

type ForegroundPermission = Awaited<ReturnType<typeof Location.getForegroundPermissionsAsync>>;
type LocationPoint = Awaited<ReturnType<typeof Location.getCurrentPositionAsync>>;
type LocationSubscription = Awaited<ReturnType<typeof Location.watchPositionAsync>>;
type GeocodeResult = Awaited<ReturnType<typeof Location.geocodeAsync>>;
type ReverseGeocodeResult = Awaited<ReturnType<typeof Location.reverseGeocodeAsync>>;

const SAMPLE_ADDRESS = '1 Huawei Plaza, Shenzhen';

export default function LocationFunctionalScreen() {
  const watcherRef = useRef<LocationSubscription | null>(null);
  const [message, setMessage] = useState(
    'Choose one action to validate permission, current fix, last known fix, watch updates, and geocoding step by step.',
  );
  const [permission, setPermission] = useState<ForegroundPermission | null>(null);
  const [servicesEnabled, setServicesEnabled] = useState<boolean | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(null);
  const [lastKnownLocation, setLastKnownLocation] = useState<LocationPoint | null>(null);
  const [watchLocation, setWatchLocation] = useState<LocationPoint | null>(null);
  const [watchActive, setWatchActive] = useState(false);
  const [geocodeResults, setGeocodeResults] = useState<GeocodeResult | null>(null);
  const [reverseGeocodeResults, setReverseGeocodeResults] = useState<ReverseGeocodeResult | null>(
    null,
  );

  useEffect(() => {
    return () => {
      watcherRef.current?.remove?.();
      watcherRef.current = null;
    };
  }, []);

  const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

  const summarizePermission = (nextPermission: ForegroundPermission) =>
    `Foreground permission OK. status=${nextPermission.status} granted=${String(
      nextPermission.granted,
    )} canAskAgain=${String(nextPermission.canAskAgain)} accuracy=${String(
      nextPermission.android?.accuracy ?? nextPermission.ios?.accuracy ?? 'n/a',
    )}`;

  const summarizeLocation = (prefix: string, location: LocationPoint) =>
    `${prefix} latitude=${location.coords.latitude.toFixed(6)} longitude=${location.coords.longitude.toFixed(
      6,
    )} accuracy=${String(location.coords.accuracy ?? 'n/a')} heading=${String(
      location.coords.heading ?? 'n/a',
    )}`;

  const refreshPermission = async () => {
    const nextPermission = await Location.getForegroundPermissionsAsync();
    setPermission(nextPermission);
    return nextPermission;
  };

  const refreshProviderStatus = async () => {
    const nextServicesEnabled = await Location.hasServicesEnabledAsync();
    setServicesEnabled(nextServicesEnabled);
    return nextServicesEnabled;
  };

  const checkPermission = async () => {
    try {
      const nextPermission = await refreshPermission();
      const nextServicesEnabled = await refreshProviderStatus();
      setMessage(
        `${summarizePermission(nextPermission)} servicesEnabled=${String(nextServicesEnabled)}`,
      );
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const requestPermission = async () => {
    try {
      const nextPermission = await Location.requestForegroundPermissionsAsync();
      setPermission(nextPermission);
      const nextServicesEnabled = await refreshProviderStatus();
      setMessage(
        `${summarizePermission(nextPermission)} servicesEnabled=${String(nextServicesEnabled)}`,
      );
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const getCurrentPosition = async () => {
    try {
      const nextLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrentLocation(nextLocation);
      setMessage(summarizeLocation('Current position OK.', nextLocation));
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const getLastKnownPosition = async () => {
    try {
      const nextLocation = await Location.getLastKnownPositionAsync();

      if (!nextLocation) {
        setLastKnownLocation(null);
        setMessage('Last known position unavailable. result=null');
        return;
      }

      setLastKnownLocation(nextLocation);
      setMessage(summarizeLocation('Last known position OK.', nextLocation));
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const startWatch = async () => {
    try {
      watcherRef.current?.remove?.();
      watcherRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 0,
        },
        (nextLocation) => {
          setWatchLocation(nextLocation);
          setMessage(summarizeLocation('Watch update OK.', nextLocation));
        },
      );
      setWatchActive(true);
      setMessage('Watch started. Waiting for the next location callback.');
    } catch (error) {
      setWatchActive(false);
      watcherRef.current = null;
      setMessage(formatError(error));
    }
  };

  const stopWatch = () => {
    watcherRef.current?.remove?.();
    watcherRef.current = null;
    setWatchActive(false);
    setMessage('Watch stopped.');
  };

  const geocodeAddress = async () => {
    try {
      const nextResults = await Location.geocodeAsync(SAMPLE_ADDRESS);
      setGeocodeResults(nextResults);
      const firstResult = nextResults[0];

      if (!firstResult) {
        setMessage(`Geocode OK. address=${SAMPLE_ADDRESS} results=0`);
        return;
      }

      setMessage(
        `Geocode OK. address=${SAMPLE_ADDRESS} latitude=${firstResult.latitude} longitude=${firstResult.longitude}`,
      );
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const reverseGeocodeCurrentPosition = async () => {
    const targetLocation = currentLocation ?? lastKnownLocation ?? watchLocation;

    if (!targetLocation) {
      setMessage('Reverse geocode skipped. Capture a current, last known, or watch location first.');
      return;
    }

    try {
      const nextResults = await Location.reverseGeocodeAsync({
        latitude: targetLocation.coords.latitude,
        longitude: targetLocation.coords.longitude,
      });
      setReverseGeocodeResults(nextResults);
      const firstResult = nextResults[0];

      if (!firstResult) {
        setMessage('Reverse geocode OK. results=0');
        return;
      }

      setMessage(
        `Reverse geocode OK. city=${String(firstResult.city ?? 'n/a')} street=${String(
          firstResult.street ?? 'n/a',
        )} country=${String(firstResult.country ?? 'n/a')}`,
      );
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const clearSnapshots = () => {
    setCurrentLocation(null);
    setLastKnownLocation(null);
    setWatchLocation(null);
    setGeocodeResults(null);
    setReverseGeocodeResults(null);
    setMessage('Cleared stored location snapshots.');
  };

  const runFullFlow = async () => {
    try {
      const nextPermission = await Location.requestForegroundPermissionsAsync();
      setPermission(nextPermission);
      const nextServicesEnabled = await refreshProviderStatus();

      if (!nextPermission.granted) {
        setMessage(
          `Full location flow stopped. status=${nextPermission.status} granted=${String(
            nextPermission.granted,
          )} servicesEnabled=${String(nextServicesEnabled)}`,
        );
        return;
      }

      const nextLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrentLocation(nextLocation);
      stopWatch();
      watcherRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 0,
        },
        (incomingLocation) => {
          setWatchLocation(incomingLocation);
          setMessage(summarizeLocation('Watch update OK.', incomingLocation));
        },
      );
      setWatchActive(true);
      setMessage(
        `Full location flow OK. granted=${String(nextPermission.granted)} servicesEnabled=${String(
          nextServicesEnabled,
        )} latitude=${nextLocation.coords.latitude.toFixed(6)} longitude=${nextLocation.coords.longitude.toFixed(6)}`,
      );
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const renderLocationCard = (title: string, location: LocationPoint | null, emptyText: string) => (
    <View style={styles.resultCard}>
      <Text style={styles.resultTitle}>{title}</Text>
      {location ? (
        <>
          <Text style={styles.resultLine}>latitude: {location.coords.latitude}</Text>
          <Text style={styles.resultLine}>longitude: {location.coords.longitude}</Text>
          <Text style={styles.resultLine}>accuracy: {String(location.coords.accuracy ?? 'n/a')}</Text>
          <Text style={styles.resultLine}>heading: {String(location.coords.heading ?? 'n/a')}</Text>
          <Text style={styles.resultLine}>timestamp: {location.timestamp}</Text>
        </>
      ) : (
        <Text style={styles.resultLine}>{emptyText}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>expo-location functional check</Text>
          <Text style={styles.body}>
            This route exposes single-step permission, current fix, last known fix, watch updates, and
            geocoding actions so developers can validate the core Harmony location flow without extra app
            logic.
          </Text>
          <Text style={styles.meta}>Accuracy.Balanced: {String(Location.Accuracy.Balanced)}</Text>
          <Text style={styles.meta}>Sample address: {SAMPLE_ADDRESS}</Text>
          <View style={styles.messageBox}>
            <Text style={styles.message}>{message}</Text>
          </View>
          <View style={styles.buttonGroup}>
            <Pressable style={styles.button} onPress={requestPermission}>
              <Text style={styles.buttonLabel}>Request foreground permission</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={checkPermission}>
              <Text style={styles.buttonLabel}>Check foreground permission</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={getCurrentPosition}>
              <Text style={styles.buttonLabel}>Get current position</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={getLastKnownPosition}>
              <Text style={styles.buttonLabel}>Get last known position</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={startWatch}>
              <Text style={styles.buttonLabel}>Start watch updates</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={stopWatch}>
              <Text style={styles.buttonLabel}>Stop watch updates</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={geocodeAddress}>
              <Text style={styles.buttonLabel}>Geocode sample address</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={reverseGeocodeCurrentPosition}>
              <Text style={styles.buttonLabel}>Reverse geocode latest fix</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={clearSnapshots}>
              <Text style={styles.secondaryButtonLabel}>Clear stored snapshots</Text>
            </Pressable>
          </View>
          <Pressable style={[styles.button, styles.primaryButton]} onPress={runFullFlow}>
            <Text style={styles.buttonLabel}>Run full permission/current/watch flow</Text>
          </Pressable>
          <Text style={styles.helper}>
            `Start watch updates` keeps one foreground subscription active until you stop it. Use
            `Reverse geocode latest fix` after obtaining a location fix to confirm address lookup behavior.
          </Text>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Permission snapshot</Text>
            <Text style={styles.resultLine}>status: {permission?.status ?? 'not checked'}</Text>
            <Text style={styles.resultLine}>granted: {String(permission?.granted ?? false)}</Text>
            <Text style={styles.resultLine}>canAskAgain: {String(permission?.canAskAgain ?? false)}</Text>
            <Text style={styles.resultLine}>
              accuracy: {String(permission?.android?.accuracy ?? permission?.ios?.accuracy ?? 'n/a')}
            </Text>
            <Text style={styles.resultLine}>
              servicesEnabled: {servicesEnabled === null ? 'not checked' : String(servicesEnabled)}
            </Text>
            <Text style={styles.resultLine}>watchActive: {String(watchActive)}</Text>
          </View>

          {renderLocationCard('Current position', currentLocation, 'No current position yet.')}
          {renderLocationCard('Last known position', lastKnownLocation, 'No last known position yet.')}
          {renderLocationCard('Latest watch update', watchLocation, 'No watch update yet.')}

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Geocode result</Text>
            {geocodeResults?.[0] ? (
              <>
                <Text style={styles.resultLine}>latitude: {geocodeResults[0].latitude}</Text>
                <Text style={styles.resultLine}>longitude: {geocodeResults[0].longitude}</Text>
              </>
            ) : (
              <Text style={styles.resultLine}>No geocode result yet.</Text>
            )}
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Reverse geocode result</Text>
            {reverseGeocodeResults?.[0] ? (
              <>
                <Text style={styles.resultLine}>city: {String(reverseGeocodeResults[0].city ?? 'n/a')}</Text>
                <Text style={styles.resultLine}>
                  street: {String(reverseGeocodeResults[0].street ?? 'n/a')}
                </Text>
                <Text style={styles.resultLine}>
                  country: {String(reverseGeocodeResults[0].country ?? 'n/a')}
                </Text>
              </>
            ) : (
              <Text style={styles.resultLine}>No reverse geocode result yet.</Text>
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
    backgroundColor: '#eff6ff',
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
    color: '#1d4ed8',
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
    backgroundColor: '#2563eb',
    alignItems: 'center',
    minWidth: 220,
    flexGrow: 1,
  },
  primaryButton: {
    backgroundColor: '#1d4ed8',
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
    borderColor: '#93c5fd',
    alignItems: 'center',
    minWidth: 220,
    flexGrow: 1,
  },
  secondaryButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1d4ed8',
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
  link: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
});
