import { StyleSheet, Text, View } from 'react-native';

const ROUTE_MARKER = 'EXPO_HARMONY_V2_ROUTE:expo-notifications';
const FALLBACK = 'Disable push or use a manual sidecar.';

export default function NotificationsFallbackRoute() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Notifications exception fallback</Text>
      <Text>{FALLBACK}</Text>
      <Text>No notifications native API is imported or invoked by this route.</Text>
      <Text style={styles.marker}>{ROUTE_MARKER}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 18, borderRadius: 16, backgroundColor: '#ffffff' },
  title: { fontSize: 18, fontWeight: '700' },
  marker: { fontSize: 12, color: '#475569' },
});
