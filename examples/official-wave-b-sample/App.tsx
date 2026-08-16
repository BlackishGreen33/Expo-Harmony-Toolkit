import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import JPushFallbackRoute from './app/third-party-wave-b/jpush';
import LottieRoute from './app/third-party-wave-b/lottie';
import MediaLibraryRoute from './app/third-party-wave-b/media-library';
import NotificationsFallbackRoute from './app/third-party-wave-b/notifications';
import SkiaFallbackRoute from './app/third-party-wave-b/skia';
import WebViewRoute from './app/third-party-wave-b/webview';

const SAMPLE_MARKER = 'EXPO_HARMONY_V2_SAMPLE:official-wave-b';
const ROUTES = [
  { id: 'webview', label: 'WebView', Component: WebViewRoute },
  { id: 'media-library', label: 'Media Library', Component: MediaLibraryRoute },
  { id: 'lottie', label: 'Lottie', Component: LottieRoute },
  { id: 'notifications', label: 'Notifications fallback', Component: NotificationsFallbackRoute },
  { id: 'jpush', label: 'JPush fallback', Component: JPushFallbackRoute },
  { id: 'skia', label: 'Skia fallback', Component: SkiaFallbackRoute },
] as const;

export default function App() {
  const [selectedRoute, setSelectedRoute] = useState<(typeof ROUTES)[number]['id']>('webview');
  const route = ROUTES.find((candidate) => candidate.id === selectedRoute) ?? ROUTES[0];
  const SelectedRoute = route.Component;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Official Wave B Sample</Text>
        <Text style={styles.marker}>{SAMPLE_MARKER}</Text>
        <View style={styles.navigation}>
          {ROUTES.map((candidate) => (
            <Pressable
              key={candidate.id}
              style={styles.button}
              onPress={() => setSelectedRoute(candidate.id)}
            >
              <Text style={styles.buttonLabel}>{candidate.label}</Text>
            </Pressable>
          ))}
        </View>
        <SelectedRoute />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fdf4ff' },
  content: { gap: 16, padding: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#4a044e' },
  marker: { fontSize: 12, color: '#475569' },
  navigation: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#a21caf' },
  buttonLabel: { color: '#ffffff', fontWeight: '600' },
});
