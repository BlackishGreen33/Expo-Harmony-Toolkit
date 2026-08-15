import { enableScreens } from 'react-native-screens';
import { StyleSheet, Text, View } from 'react-native';

const ROUTE_MARKER = 'EXPO_HARMONY_V2_ROUTE:react-native-screens';
const FALLBACK = 'enableScreens(false)';

enableScreens(false);

export default function ScreensFallbackRoute() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Screens exception fallback</Text>
      <Text>{FALLBACK}</Text>
      <Text>This route disables the native screens path and makes no native success claim.</Text>
      <Text style={styles.marker}>{ROUTE_MARKER}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 18, borderRadius: 16, backgroundColor: '#ffffff' },
  title: { fontSize: 18, fontWeight: '700' },
  marker: { fontSize: 12, color: '#475569' },
});
