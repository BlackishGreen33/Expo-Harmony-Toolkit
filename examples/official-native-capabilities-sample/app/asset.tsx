import { Asset } from 'expo-asset';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const REMOTE_ASSET_URI = 'https://example.com/expo-harmony-foundation.png';

export default function AssetFoundationScreen() {
  const [message, setMessage] = useState(
    'Validate expo-asset fromURI metadata and loadAsync bundle path for v1.9 app-foundation.',
  );
  const [assetSummary, setAssetSummary] = useState('No asset loaded yet.');

  const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

  const inspectRemoteAsset = async () => {
    try {
      const asset = Asset.fromURI(REMOTE_ASSET_URI);
      await asset.downloadAsync();
      setAssetSummary(`uri=${asset.uri} localUri=${String(asset.localUri)} downloaded=${String(asset.downloaded)}`);
      setMessage('Asset fromURI metadata OK.');
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const runLoadAsync = async () => {
    try {
      const assets = await Asset.loadAsync([REMOTE_ASSET_URI]);
      setAssetSummary(`loadAsync result count=${assets.length} first=${String(assets[0]?.uri ?? 'n/a')}`);
      setMessage('Asset loadAsync bundle path OK.');
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>expo-asset foundation check</Text>
          <Text style={styles.body}>
            This route validates the v1.9.0 Asset shim. Native resource resolution and cache parity
            remain promotion evidence, but app startup can keep importing expo-asset.
          </Text>
          <View style={styles.messageBox}>
            <Text style={styles.message}>{message}</Text>
          </View>
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Asset result</Text>
            <Text style={styles.resultLine}>{assetSummary}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.button} onPress={inspectRemoteAsset}>
              <Text style={styles.buttonLabel}>Inspect Asset.fromURI</Text>
            </Pressable>
            <Pressable style={styles.button} onPress={runLoadAsync}>
              <Text style={styles.buttonLabel}>Run Asset.loadAsync</Text>
            </Pressable>
          </View>
          <Link href="/" style={styles.link}>
            Back to home
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 560, borderRadius: 18, padding: 24, backgroundColor: '#ffffff', gap: 14 },
  title: { fontSize: 24, fontWeight: '700', color: '#111827' },
  body: { fontSize: 15, lineHeight: 22, color: '#475467' },
  messageBox: { borderRadius: 14, padding: 14, backgroundColor: '#eff6ff' },
  message: { fontSize: 14, lineHeight: 20, color: '#1e3a8a' },
  resultCard: { borderRadius: 14, padding: 14, backgroundColor: '#f8fafc', gap: 6 },
  resultTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  resultLine: { fontSize: 14, lineHeight: 20, color: '#475467' },
  actions: { gap: 10 },
  button: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#0f766e' },
  buttonLabel: { color: '#ffffff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  link: { fontSize: 15, fontWeight: '700', color: '#0f766e' },
});
