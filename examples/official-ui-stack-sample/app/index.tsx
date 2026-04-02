import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Link, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

const detailsUrl = Linking.createURL('/details');
const MAX_SHIFT = 72;

export default function HomeScreen() {
  const motion = useSharedValue(0);
  const pathname = usePathname();
  const observedUrl = Linking.useURL();

  const runMotionDemo = () => {
    motion.value = 0;
    motion.value = withSequence(
      withSpring(1, {
        damping: 12,
        stiffness: 170,
      }),
      withSpring(0, {
        damping: 14,
        stiffness: 150,
      }),
    );
  };

  const animatedOrbStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: motion.value * MAX_SHIFT },
        { translateY: motion.value * -6 },
        { rotate: `${motion.value * 18}deg` },
        { scale: 1 + motion.value * 0.08 },
      ],
      backgroundColor: interpolateColor(motion.value, [0, 1], ['#818cf8', '#22d3ee']),
      shadowOpacity: 0.2 + motion.value * 0.16,
      shadowRadius: 18 + motion.value * 8,
      shadowOffset: { width: 0, height: 10 + motion.value * 4 },
    };
  });

  const animatedRailStyle = useAnimatedStyle(() => {
    return {
      borderColor: interpolateColor(motion.value, [0, 1], ['#d0d5dd', '#4f46e5']),
      backgroundColor: interpolateColor(motion.value, [0, 1], ['#eef2ff', '#dbeafe']),
    };
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.copyColumn}>
            <Text style={styles.eyebrow}>Expo Harmony Toolkit</Text>
            <Text style={styles.title}>Official UI Stack Sample</Text>
            <Text style={styles.body}>
              This is the public onboarding sample for the verified UI stack. It makes router, linking,
              constants, SVG, and reanimated success states visible without adding product logic on top.
            </Text>
          </View>
          <View style={styles.svgBadge}>
            <Svg width={92} height={92} viewBox="0 0 92 92">
              <Defs>
                <LinearGradient id="orbit" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#4f46e5" />
                  <Stop offset="100%" stopColor="#22d3ee" />
                </LinearGradient>
              </Defs>
              <Circle cx="46" cy="46" r="36" fill="none" stroke="url(#orbit)" strokeWidth="10" />
              <Path
                d="M30 50C37 36 54 30 66 36C58 40 53 47 51 56C44 58 37 56 30 50Z"
                fill="#4f46e5"
                opacity="0.9"
              />
            </Svg>
          </View>
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.metaTitle}>Current state</Text>
          <Text style={styles.metaLine}>Constants.expoConfig?.name: {Constants.expoConfig?.name ?? 'unknown'}</Text>
          <Text style={styles.metaLine}>Current pathname: {pathname}</Text>
          <Text style={styles.metaLine}>Observed URL: {observedUrl ?? 'none yet'}</Text>
          <Text style={styles.metaLine}>Generated details URL: {detailsUrl}</Text>
        </View>

        <View style={styles.metaCard}>
          <Text style={styles.metaTitle}>Success signals</Text>
          <Text style={styles.metaLine}>The orbit badge renders as a visible SVG shape.</Text>
          <Text style={styles.metaLine}>Pressing the motion rail moves and springs the orb on screen.</Text>
          <Text style={styles.metaLine}>Opening `/details` and returning keeps routing stable after the animation.</Text>
        </View>

        <Text style={styles.metaLabel}>Reanimated spring check</Text>
        <Text style={styles.metaHint}>Press the rail below to trigger a visible spring animation on-device.</Text>

        <Pressable accessibilityRole="button" onPress={runMotionDemo}>
          <Animated.View style={[styles.motionRail, animatedRailStyle]}>
            <Text style={styles.motionLabel}>Run reanimated spring</Text>
            <Animated.View style={[styles.motionOrb, animatedOrbStyle]} />
          </Animated.View>
        </Pressable>

        <Link href="/details" style={styles.link}>
          Open details route
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 28,
    padding: 24,
    gap: 14,
    backgroundColor: '#ffffff',
  },
  headerRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  copyColumn: {
    flex: 1,
    gap: 10,
  },
  svgBadge: {
    width: 92,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#4f46e5',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#101828',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#475467',
  },
  metaCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#f8fafc',
    gap: 8,
  },
  metaTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101828',
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667085',
  },
  metaLine: {
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
  },
  metaHint: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475467',
  },
  motionRail: {
    position: 'relative',
    height: 72,
    borderRadius: 999,
    borderWidth: 1,
    paddingLeft: 78,
    paddingRight: 20,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  motionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#101828',
  },
  motionOrb: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 999,
  },
  link: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#4f46e5',
  },
});
