import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Link, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const detailsUrl = Linking.createURL('/details');
const homeUrl = Linking.createURL('/');

export default function HomeScreen() {
  const pathname = usePathname();
  const router = useRouter();
  const observedUrl = Linking.useURL();
  const [message, setMessage] = useState(
    'Start with Inspect app-shell state, then open /details through router push or the generated deep link.',
  );

  const inspectShellState = () => {
    setMessage(
      `Inspect OK. appName=${Constants.expoConfig?.name ?? 'unknown'} pathname=${pathname} observedUrl=${observedUrl ?? 'none yet'}`,
    );
  };

  const pushDetailsRoute = () => {
    setMessage('Router push requested for /details.');
    router.push('/details');
  };

  const openDeepLink = async () => {
    try {
      setMessage(`Opening generated deep link: ${detailsUrl}`);
      await Linking.openURL(detailsUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Expo Harmony Toolkit</Text>
          <Text style={styles.title}>Official App Shell Sample</Text>
          <Text style={styles.body}>
            This sample is the minimal developer walkthrough for Expo Router, Expo Linking, and Expo
            Constants inside the Harmony app shell. Every action on this page maps to a core path that
            another developer should be able to understand immediately.
          </Text>

          <View style={styles.messageBox}>
            <Text style={styles.message}>{message}</Text>
          </View>

          <View style={styles.metaCard}>
            <Text style={styles.metaTitle}>Current app-shell state</Text>
            <Text style={styles.metaLine}>Constants.expoConfig?.name: {Constants.expoConfig?.name ?? 'unknown'}</Text>
            <Text style={styles.metaLine}>Current pathname: {pathname}</Text>
            <Text style={styles.metaLine}>Observed URL: {observedUrl ?? 'Open the scheme or navigate once to populate this.'}</Text>
            <Text style={styles.metaLine}>Home URL: {homeUrl}</Text>
            <Text style={styles.metaLine}>Generated details URL: {detailsUrl}</Text>
          </View>

          <View style={styles.metaCard}>
            <Text style={styles.metaTitle}>Success signals</Text>
            <Text style={styles.metaLine}>Home loads with the current pathname and generated URL cards.</Text>
            <Text style={styles.metaLine}>Router push opens `/details` and `Back to home` returns here.</Text>
            <Text style={styles.metaLine}>Opening the generated deep link also resolves to `/details` inside the same app shell.</Text>
          </View>

          <View style={styles.buttonGroup}>
            <Pressable style={styles.button} onPress={inspectShellState}>
              <Text style={styles.buttonLabel}>Inspect app-shell state</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={pushDetailsRoute}>
              <Text style={styles.buttonLabel}>Push /details with router</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={openDeepLink}>
              <Text style={styles.buttonLabel}>Open generated deep link</Text>
            </Pressable>
          </View>

          <Link href="/details" style={styles.link}>
            Open details with Link component
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#eef2ff',
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#ffffff',
    gap: 14,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#4338ca',
  },
  title: {
    fontSize: 28,
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
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1f2937',
  },
  metaCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#f8fafc',
    gap: 8,
  },
  metaTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  metaLine: {
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
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
    backgroundColor: '#4338ca',
    alignItems: 'center',
    minWidth: 220,
    flexGrow: 1,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  link: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4338ca',
  },
});
