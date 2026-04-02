import * as Linking from 'expo-linking';
import { Link, usePathname } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

const detailsUrl = Linking.createURL('/details');

export default function DetailsScreen() {
  const pathname = usePathname();
  const observedUrl = Linking.useURL();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>Details Route</Text>
        <Text style={styles.body}>
          If you reached this screen from router push, the Link component, or the generated deep link,
          then the app-shell routing path is behaving correctly for this sample.
        </Text>
        <View style={styles.metaCard}>
          <Text style={styles.metaLine}>Current pathname: {pathname}</Text>
          <Text style={styles.metaLine}>Observed URL: {observedUrl ?? 'none yet'}</Text>
          <Text style={styles.metaLine}>Expected details URL: {detailsUrl}</Text>
        </View>
        <Link href="/" style={styles.link}>
          Back to home
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#ffffff',
    gap: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
  },
  metaCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#eef2ff',
    gap: 8,
  },
  metaLine: {
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
  },
  link: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4338ca',
  },
});
