import { AppRegistry, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { enableScreens } from 'react-native-screens';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

enableScreens(false);
void AsyncStorage.setItem('expo-harmony-wave-a', 'ok');

function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView>
        <Text>Third-party Wave A</Text>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

AppRegistry.registerComponent('third-party-wave-a-fixture', () => App);
