import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const ROUTES = [
  {
    href: '/file-system' as const,
    title: 'expo-file-system',
    body: 'Create a sandbox directory, write and read a file, copy or move it, and clean the generated artifacts.',
  },
  {
    href: '/image-picker' as const,
    title: 'expo-image-picker',
    body: 'Request permissions, open the system library or camera UI, and inspect denied, canceled, or successful asset results.',
  },
  {
    href: '/location' as const,
    title: 'expo-location',
    body: 'Validate the supported subset: foreground permission, current and last-known fixes, plus geocode and reverse-geocode results.',
  },
  {
    href: '/camera' as const,
    title: 'expo-camera',
    body: 'Validate the supported subset: camera permission and still capture through the Harmony system camera UI.',
  },
];

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Expo Harmony Toolkit</Text>
          <Text style={styles.title}>Official Native Capabilities Sample</Text>
          <Text style={styles.body}>
            This is the canonical simulator-friendly walkthrough for the current preview native
            capabilities. Each route stays intentionally small, only demonstrates the supported core
            flow, and calls out unsupported edges instead of pretending to cover them.
          </Text>
          <View style={styles.boundaryCard}>
            <Text style={styles.boundaryTitle}>Current boundary</Text>
            <Text style={styles.boundaryLine}>All four routes stay in `preview` for v1.7.x.</Text>
            <Text style={styles.boundaryLine}>The goal here is clarity and usable simulator acceptance, not premature `verified` claims.</Text>
          </View>
          {ROUTES.map((route) => (
            <View key={route.href} style={styles.routeCard}>
              <Text style={styles.routeTitle}>{route.title}</Text>
              <Text style={styles.routeBody}>{route.body}</Text>
              <Link href={route.href} style={styles.link}>
                Open functional route
              </Link>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ecfeff',
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
  boundaryCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#f0fdfa',
    borderWidth: 1,
    borderColor: '#99f6e4',
    gap: 8,
  },
  boundaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#134e4a',
  },
  boundaryLine: {
    fontSize: 14,
    lineHeight: 20,
    color: '#115e59',
  },
  routeCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#f8fafc',
    gap: 8,
  },
  routeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  routeBody: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475467',
  },
  link: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f766e',
  },
});
