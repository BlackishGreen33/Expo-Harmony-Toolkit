import { Asset, useAssets } from 'expo-asset';
import * as Clipboard from 'expo-clipboard';
import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { SafeAreaView, useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';

// Deterministic 1x1 red RGBA PNG, generated locally with zlib and valid PNG CRCs.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
const BUNDLED = require('../assets/native-check.svg');

export default function FoundationCheck() {
  const [status, setStatus] = useState('Ready');
  const [assets, assetError] = useAssets([BUNDLED]);
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const run = async () => {
    let step = 'secure storage';
    const check = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
    try {
      setStatus(step);
      const a = { keychainService: 'foundation-check-a' };
      const b = { keychainService: 'foundation-check-b' };
      await SecureStore.setItemAsync('sample', 'native-value', a);
      check(await SecureStore.getItemAsync('sample', a) === 'native-value', 'native read');
      check(await SecureStore.getItemAsync('sample', b) === null, 'service isolation');
      SecureStore.setItem('sample', 'sync-value', a);
      check(SecureStore.getItem('sample', a) === 'sync-value', 'sync read');
      await SecureStore.deleteItemAsync('sample', a);
      check(await SecureStore.getItemAsync('sample', a) === null, 'delete');
      step = 'asset bytes'; setStatus(step);
      const [bundled, data] = await Asset.loadAsync([BUNDLED, 'data:image/png;base64,' + PNG]);
      check(!!bundled.localUri && !!data.localUri, 'local asset URIs');
      check((await FileSystem.readAsStringAsync(bundled.localUri!)).includes('Expo Harmony native asset'), 'bundled bytes');
      check(await FileSystem.readAsStringAsync(data.localUri!, { encoding: FileSystem.EncodingType.Base64 }) === PNG, 'data URI bytes');
      check(!!assets?.[0]?.downloaded && !assetError, 'useAssets completion');
      step = 'clipboard text'; setStatus(step);
      await Clipboard.setStringAsync('native clipboard');
      check(await Clipboard.getStringAsync() === 'native clipboard', 'pasteboard text');
      await Clipboard.setStringAsync('<b>native clipboard</b>', { inputFormat: Clipboard.StringFormat.HTML });
      check((await Clipboard.getStringAsync({ preferredFormat: Clipboard.StringFormat.HTML })).includes('native clipboard'), 'pasteboard HTML');
      step = 'clipboard URL'; setStatus(step);
      await Clipboard.setUrlAsync('https://example.test/native-check');
      check(await Clipboard.getUrlAsync() === 'https://example.test/native-check', 'pasteboard URL');
      step = 'clipboard image'; setStatus(step);
      await Clipboard.setImageAsync(PNG);
      const image = await Clipboard.getImageAsync({ format: 'png' });
      check(image?.size.width === 1 && image.size.height === 1, 'pasteboard image dimensions');
      check(await Clipboard.hasImageAsync(), 'pasteboard image type');
      step = 'device metadata'; setStatus(step);
      check(!!Device.osVersion && Device.modelName !== 'Harmony preview device', 'OS metadata');
      check(await Device.getDeviceTypeAsync() > Device.DeviceType.UNKNOWN, 'device type');
      setStatus('PASS: storage async/sync/isolation/delete, asset bytes/hook, clipboard text/HTML/URL/image, device');
    } catch (error) {
      setStatus('FAIL ' + step + ': ' + (error instanceof Error ? error.message : JSON.stringify(error)));
    }
  };
  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: 'white' }}>
      <ScrollView>
        <Text style={{ fontSize: 22 }}>Native foundation checks</Text>
        <Text>EXPO_HARMONY_NATIVE_FOUNDATION_CHECK</Text>
        <Text>Insets: {JSON.stringify(insets)}</Text>
        <Text>Frame: {JSON.stringify(frame)}</Text>
        <Text>Asset hook: {assetError ? String(assetError) : assets?.[0]?.localUri ?? 'loading'}</Text>
        <Text>Device: {Device.modelName}; physical={String(Device.isDevice)}; OS={Device.osVersion}</Text>
        <Pressable onPress={run} style={{ padding: 16, backgroundColor: '#dbeafe', marginVertical: 16 }}>
          <Text>Run native foundation checks</Text>
        </Pressable>
        <Text selectable>{status}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
