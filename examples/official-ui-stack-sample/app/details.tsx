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
        <Text style={styles.title}>UI Stack Details</Text>
        <Text style={styles.body}>
          This screen confirms that the verified UI-stack route can still resolve after SVG rendering
          and reanimated interactions on the home page.
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
    backgroundColor: '#f5f7ff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 28,
    padding: 24,
    gap: 14,
    backgroundColor: '#ffffff',
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
    color: '#4f46e5',
  },
});
