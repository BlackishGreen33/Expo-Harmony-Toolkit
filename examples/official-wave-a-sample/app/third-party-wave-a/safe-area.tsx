import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text } from 'react-native';

const ROUTE_MARKER = 'EXPO_HARMONY_V2_ROUTE:react-native-safe-area-context';

export default function SafeAreaRoute() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.card}>
        <Text style={styles.title}>Safe-area covered limitation</Text>
        <Text>
          Packaging is covered through the toolkit shim; native inset measurement remains a documented
          limitation and is not promoted by this sample.
        </Text>
        <Text style={styles.marker}>{ROUTE_MARKER}</Text>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 18, borderRadius: 16, backgroundColor: '#ffffff' },
  title: { fontSize: 18, fontWeight: '700' },
  marker: { fontSize: 12, color: '#475569' },
});
