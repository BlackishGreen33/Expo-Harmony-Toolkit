import { StyleSheet, Text, View } from 'react-native';

const ROUTE_MARKER = 'EXPO_HARMONY_V2_ROUTE:jpush-react-native';
const FALLBACK = 'Disable push or use a manual sidecar.';

export default function JPushFallbackRoute() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>JPush exception fallback</Text>
      <Text>{FALLBACK}</Text>
      <Text>No registration, delivery, or native initialization success is claimed.</Text>
      <Text style={styles.marker}>{ROUTE_MARKER}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 18, borderRadius: 16, backgroundColor: '#ffffff' },
  title: { fontSize: 18, fontWeight: '700' },
  marker: { fontSize: 12, color: '#475569' },
});
