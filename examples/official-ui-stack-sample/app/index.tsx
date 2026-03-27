import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { Link } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedView = Animated.createAnimatedComponent(View);
const detailsUrl = Linking.createURL('/details');
const MAX_DRAG = 76;

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

export default function HomeScreen() {
  const translateX = useSharedValue(0);

  const gesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = clamp(event.translationX, -MAX_DRAG, MAX_DRAG);
    })
    .onEnd(() => {
      translateX.value = withSpring(0, {
        damping: 15,
        stiffness: 180,
      });
    });

  const animatedOrbStyle = useAnimatedStyle(() => {
    const progress = (translateX.value + MAX_DRAG) / (MAX_DRAG * 2);

    return {
      transform: [
        { translateX: translateX.value },
        { rotate: `${translateX.value / 9}deg` },
      ],
      backgroundColor: interpolateColor(progress, [0, 0.5, 1], ['#c4b5fd', '#818cf8', '#22d3ee']),
      shadowOpacity: 0.24,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
    };
  });

  const animatedRailStyle = useAnimatedStyle(() => {
    const progress = Math.abs(translateX.value) / MAX_DRAG;

    return {
      borderColor: interpolateColor(progress, [0, 1], ['#d0d5dd', '#818cf8']),
      backgroundColor: interpolateColor(progress, [0, 1], ['#eef2ff', '#e0e7ff']),
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
              This sample validates Expo Router, Expo Linking, Expo Constants, reanimated, gesture-handler, and SVG inside the Harmony UI-stack matrix.
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

        <Text style={styles.metaLabel}>Constants.expoConfig?.name</Text>
        <Text style={styles.metaValue}>{Constants.expoConfig?.name ?? 'unknown'}</Text>

        <Text style={styles.metaLabel}>Linking.createURL('/details')</Text>
        <Text style={styles.metaValue}>{detailsUrl}</Text>

        <Text style={styles.metaLabel}>Gesture + reanimated</Text>
        <Text style={styles.metaHint}>Drag the orb left or right and release to watch it spring back.</Text>

        <GestureDetector gesture={gesture}>
          <AnimatedView style={[styles.gestureRail, animatedRailStyle]}>
            <AnimatedView style={[styles.gestureOrb, animatedOrbStyle]} />
          </AnimatedView>
        </GestureDetector>

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
  metaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667085',
  },
  metaValue: {
    fontSize: 15,
    lineHeight: 22,
    color: '#101828',
  },
  metaHint: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475467',
  },
  gestureRail: {
    height: 72,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  gestureOrb: {
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
