import WebView from 'react-native-webview';
import { StyleSheet, Text, View } from 'react-native';

const ROUTE_MARKER = 'EXPO_HARMONY_V2_ROUTE:react-native-webview';

export default function WebViewRoute() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>WebView covered route</Text>
      <Text>The canonical WebView package is statically bundled with its Harmony adapter installed.</Text>
      <WebView source={{ html: '<h1>Expo Harmony WebView packaging route</h1>' }} style={styles.webView} />
      <Text style={styles.marker}>{ROUTE_MARKER}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 18, borderRadius: 16, backgroundColor: '#ffffff' },
  title: { fontSize: 18, fontWeight: '700' },
  webView: { minHeight: 180 },
  marker: { fontSize: 12, color: '#475569' },
});
