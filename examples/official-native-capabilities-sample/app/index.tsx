import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Expo Harmony Toolkit</Text>
        <Text style={styles.title}>Official Native Capabilities Sample</Text>
        <Text style={styles.body}>
          This sample tracks preview-tier native capability bridges. It is expected to bundle on Harmony before the runtime implementation is promoted to verified.
        </Text>
        <Link href="/file-system" style={styles.link}>
          Open file-system preview route
        </Link>
        <Link href="/image-picker" style={styles.link}>
          Open image-picker preview route
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ecfeff',
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
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#0f766e',
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
  link: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f766e',
  },
});
