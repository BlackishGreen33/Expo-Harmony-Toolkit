import LottieView from 'lottie-react-native';
import { StyleSheet, Text, View } from 'react-native';
import animationSource from '../assets/packaging-pulse.json';

const ROUTE_MARKER = 'EXPO_HARMONY_V2_ROUTE:lottie-react-native';

export default function LottieRoute() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Lottie covered route</Text>
      <LottieView source={animationSource} autoPlay={false} loop={false} style={styles.animation} />
      <Text style={styles.marker}>{ROUTE_MARKER}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 18, borderRadius: 16, backgroundColor: '#ffffff' },
  title: { fontSize: 18, fontWeight: '700' },
  animation: { width: 120, height: 120 },
  marker: { fontSize: 12, color: '#475569' },
});
