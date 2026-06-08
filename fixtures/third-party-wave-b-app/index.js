import { AppRegistry, Text, View } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import WebView from 'react-native-webview';
import LottieView from 'lottie-react-native';
import { Canvas } from '@shopify/react-native-skia';

void MediaLibrary.getPermissionsAsync();
void WebView;
void LottieView;
void Canvas;

function App() {
  return (
    <View>
      <Text>Third-party Wave B</Text>
    </View>
  );
}

AppRegistry.registerComponent('third-party-wave-b-fixture', () => App);
