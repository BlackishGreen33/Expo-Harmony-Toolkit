import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

const CHECKPOINTS = [
  {
    title: 'What this sample validates',
    body: 'The shortest managed Expo Harmony path: doctor, init, bundle, and the generated sidecar baseline.',
  },
  {
    title: 'Success looks like',
    body: 'The page renders, the bundle builds, and generated Harmony files stay small and deterministic.',
  },
  {
    title: 'Intentionally excluded',
    body: 'No router, no UI-stack adapters, and no native capability demos. Use the other official samples for those flows.',
  },
];

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Expo Harmony Toolkit</Text>
        <Text style={styles.title}>Official Minimal Sample</Text>
        <Text style={styles.body}>
          This is the smallest onboarding sample in the repo. Its job is not to look impressive. Its
          job is to make the minimal managed Expo to Harmony chain obvious and reproducible.
        </Text>
        <View style={styles.chainBox}>
          <Text style={styles.chainLabel}>Core chain</Text>
          <Text style={styles.chainValue}>doctor -&gt; init -&gt; bundle -&gt; build-hap</Text>
        </View>
        {CHECKPOINTS.map((checkpoint) => (
          <View key={checkpoint.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{checkpoint.title}</Text>
            <Text style={styles.sectionBody}>{checkpoint.body}</Text>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f4f6',
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
    gap: 14,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#4b5563',
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
  chainBox: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 6,
  },
  chainLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#6b7280',
  },
  chainValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  section: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#f8fafc',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475467',
  },
});
