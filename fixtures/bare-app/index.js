import { registerRootComponent } from 'expo';
import React from 'react';
import { Text, View } from 'react-native';

function App() {
  return (
    <View>
      <Text>Expo Harmony bare workflow baseline</Text>
    </View>
  );
}

registerRootComponent(App);
