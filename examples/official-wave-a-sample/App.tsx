import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorageRoute from './app/third-party-wave-a/async-storage';
import GestureHandlerRoute from './app/third-party-wave-a/gesture-handler';
import SafeAreaRoute from './app/third-party-wave-a/safe-area';
import ScreensFallbackRoute from './app/third-party-wave-a/screens';

const SAMPLE_MARKER = 'EXPO_HARMONY_V2_SAMPLE:official-wave-a';
const ROUTES = [
  { id: 'gesture-handler', label: 'Gesture Handler', Component: GestureHandlerRoute },
  { id: 'async-storage', label: 'Async Storage', Component: AsyncStorageRoute },
  { id: 'safe-area', label: 'Safe Area', Component: SafeAreaRoute },
  { id: 'screens', label: 'Screens fallback', Component: ScreensFallbackRoute },
] as const;

export default function App() {
  const [selectedRoute, setSelectedRoute] = useState<(typeof ROUTES)[number]['id']>('gesture-handler');
  const route = ROUTES.find((candidate) => candidate.id === selectedRoute) ?? ROUTES[0];
  const SelectedRoute = route.Component;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Official Wave A Sample</Text>
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
  safeArea: { flex: 1, backgroundColor: '#eff6ff' },
  content: { gap: 16, padding: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#172554' },
  marker: { fontSize: 12, color: '#475569' },
  navigation: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#1d4ed8' },
  buttonLabel: { color: '#ffffff', fontWeight: '600' },
});
