import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

const SAMPLE_MARKER = 'EXPO_HARMONY_V2_SAMPLE:official-bare';

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.card}>
        <Text style={styles.title}>Official Bare Sample</Text>
        <Text style={styles.body}>
          This lane preserves existing Android and iOS native directories while the toolkit creates
          and validates an independent Harmony sidecar.
        </Text>
        <Text style={styles.marker}>{SAMPLE_MARKER}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    gap: 12,
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#334155',
  },
  marker: {
    fontSize: 12,
    color: '#475569',
  },
});
