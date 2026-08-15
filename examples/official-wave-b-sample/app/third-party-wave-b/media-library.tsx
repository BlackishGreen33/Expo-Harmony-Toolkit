import * as MediaLibrary from 'expo-media-library';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const ROUTE_MARKER = 'EXPO_HARMONY_V2_ROUTE:expo-media-library';

export default function MediaLibraryRoute() {
  const [message, setMessage] = useState('Permission lookup has not run.');

  const inspectPermission = async () => {
    try {
      const permission = await MediaLibrary.getPermissionsAsync();
      setMessage(`Media permission status=${permission.status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Media Library covered route</Text>
      <Text>{message}</Text>
      <Pressable style={styles.button} onPress={inspectPermission}>
        <Text style={styles.buttonLabel}>Inspect media permission</Text>
      </Pressable>
      <Text style={styles.marker}>{ROUTE_MARKER}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: 18, borderRadius: 16, backgroundColor: '#ffffff' },
  title: { fontSize: 18, fontWeight: '700' },
  button: { alignSelf: 'flex-start', borderRadius: 10, padding: 10, backgroundColor: '#a21caf' },
  buttonLabel: { color: '#ffffff', fontWeight: '600' },
  marker: { fontSize: 12, color: '#475569' },
});
