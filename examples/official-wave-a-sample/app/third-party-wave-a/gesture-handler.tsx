import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, Text, View } from 'react-native';

const ROUTE_MARKER = 'EXPO_HARMONY_V2_ROUTE:react-native-gesture-handler';

export default function GestureHandlerRoute() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>Gesture Handler adapter lane</Text>
        <Text>The canonical GestureHandlerRootView is bundled with the Harmony adapter installed.</Text>
        <Text style={styles.marker}>{ROUTE_MARKER}</Text>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  card: { gap: 8, padding: 18, borderRadius: 16, backgroundColor: '#ffffff' },
  title: { fontSize: 18, fontWeight: '700' },
  marker: { fontSize: 12, color: '#475569' },
});
