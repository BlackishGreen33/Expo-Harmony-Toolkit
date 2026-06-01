import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const ROUTES = [
  {
    href: '/asset' as const,
    title: 'expo-asset',
    body: 'Validate the v1.9 app-foundation Asset shim, fromURI metadata, and loadAsync bundle path.',
  },
  {
    href: '/clipboard' as const,
    title: 'expo-clipboard',
    body: 'Validate session clipboard string, URL helpers, and hasStringAsync without native pasteboard promotion.',
  },
  {
    href: '/device' as const,
    title: 'expo-device',
    body: 'Validate stable Harmony placeholder device metadata and getDeviceTypeAsync startup behavior.',
  },
  {
    href: '/file-system' as const,
    title: 'expo-file-system',
    body: 'Validate UTF-8/base64 sandbox I/O, append and partial reads, md5 info, and one remote download.',
  },
  {
    href: '/image-picker' as const,
    title: 'expo-image-picker',
    body: 'Validate single and multi-select library flows, mixed media selection, photo/video capture, and pending result recovery.',
  },
  {
    href: '/location' as const,
    title: 'expo-location',
    body: 'Validate foreground/background permission, current fix, watch start/stop, heading snapshot/watch, and geocode helpers.',
  },
  {
    href: '/camera' as const,
    title: 'expo-camera',
    body: 'Validate embedded preview, pause/resume, still capture, video recording controls, and microphone permission snapshots.',
  },
  {
    href: '/haptics' as const,
    title: 'expo-haptics',
    body: 'Validate no-op-safe selection, impact, and notification haptic calls for v1.9 bundle/debug coverage.',
  },
  {
    href: '/secure-store' as const,
    title: 'expo-secure-store',
    body: 'Validate session secure-store writes, reads, deletes, and availability without claiming encrypted persistence.',
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
            capabilities and v1.9 app-foundation modules. Each route demonstrates the documented
            baseline and keeps the preview boundary focused on device and release evidence.
          </Text>
          <View style={styles.boundaryCard}>
            <Text style={styles.boundaryTitle}>Current boundary</Text>
            <Text style={styles.boundaryLine}>All native capability and foundation routes stay in `preview` for v1.9.0.</Text>
            <Text style={styles.boundaryLine}>The goal here is credible bundle/debug acceptance without promoting any capability to `verified` early.</Text>
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
