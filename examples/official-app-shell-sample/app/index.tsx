import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

const detailsUrl = Linking.createURL('/details');

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Expo Harmony Toolkit</Text>
        <Text style={styles.title}>Official App Shell Sample</Text>
        <Text style={styles.body}>
          This sample validates Expo Router, Expo Linking, and Expo Constants inside the Harmony app-shell matrix.
        </Text>
        <Text style={styles.metaLabel}>Constants.expoConfig?.name</Text>
        <Text style={styles.metaValue}>{Constants.expoConfig?.name ?? 'unknown'}</Text>
        <Text style={styles.metaLabel}>Linking.createURL('/details')</Text>
        <Text style={styles.metaValue}>{detailsUrl}</Text>
        <Link href="/details" style={styles.link}>
          Open details route
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#ffffff',
    gap: 12,
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
  metaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  metaValue: {
    fontSize: 14,
    lineHeight: 20,
    color: '#111827',
  },
  link: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#4338ca',
  },
});
