import { StyleSheet, Text, View } from 'react-native';

const ROUTE_MARKER = 'EXPO_HARMONY_V2_ROUTE:react-native-skia';
const FALLBACK = 'Use a non-Skia renderer or disable the surface.';

export default function SkiaFallbackRoute() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Skia exception fallback</Text>
      <Text>{FALLBACK}</Text>
      <View style={styles.fallbackSurface}>
        <Text>React Native View fallback renderer</Text>
      </View>
      <Text style={styles.marker}>{ROUTE_MARKER}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 18, borderRadius: 16, backgroundColor: '#ffffff' },
  title: { fontSize: 18, fontWeight: '700' },
  fallbackSurface: { padding: 16, borderRadius: 12, backgroundColor: '#fae8ff' },
  marker: { fontSize: 12, color: '#475569' },
});
