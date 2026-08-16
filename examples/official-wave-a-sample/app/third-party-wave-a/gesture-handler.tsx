import { useState } from 'react';
import { GestureHandlerRootView, RectButton } from 'react-native-gesture-handler';
import { StyleSheet, Text, View } from 'react-native';

const ROUTE_MARKER = 'EXPO_HARMONY_V2_ROUTE:react-native-gesture-handler';

export default function GestureHandlerRoute() {
  const [gestureCount, setGestureCount] = useState(0);

  const handlePress = () => {
    setGestureCount((count) => count + 1);
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.title}>Gesture Handler adapter lane</Text>
        <Text>
          {
            'Canonical RectButton adapter probe; simulator callback evidence is blocked and device semantics are deferred.'
          }
        </Text>
        <Text testID="gesture-handler-result">Gesture callback count={gestureCount}</Text>
        <RectButton
          onPress={handlePress}
          testID="gesture-handler-action"
          style={styles.gestureTarget}
        >
          <Text style={styles.gestureTargetLabel}>Run tap gesture</Text>
        </RectButton>
        <Text style={styles.marker}>{ROUTE_MARKER}</Text>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  card: { gap: 8, padding: 18, borderRadius: 16, backgroundColor: '#ffffff' },
  title: { fontSize: 18, fontWeight: '700' },
  gestureTarget: {
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#1d4ed8',
  },
  gestureTargetLabel: { color: '#ffffff', fontWeight: '600' },
  marker: { fontSize: 12, color: '#475569' },
});
