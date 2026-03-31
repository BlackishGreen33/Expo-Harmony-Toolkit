import * as ImagePicker from 'expo-image-picker';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function ImagePickerPreviewScreen() {
  const [message, setMessage] = useState('Tap the action to exercise the preview bridge.');

  const runPreviewFlow = async () => {
    try {
      await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });
      setMessage('Preview bridge executed without throwing.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>expo-image-picker preview</Text>
        <Text style={styles.body}>
          The preview shim reserves the import path and permission model so the toolkit can validate and bundle the project before native picker flows are promoted.
        </Text>
        <Text style={styles.meta}>MediaTypeOptions.Images: {String(ImagePicker.MediaTypeOptions.Images)}</Text>
        <Pressable style={styles.button} onPress={runPreviewFlow}>
          <Text style={styles.buttonLabel}>Attempt preview pick</Text>
        </Pressable>
        <Text style={styles.message}>{message}</Text>
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
    backgroundColor: '#ecfccb',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#ffffff',
    gap: 12,
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
  meta: {
    fontSize: 14,
    lineHeight: 20,
    color: '#3f6212',
  },
  button: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#4d7c0f',
    alignItems: 'center',
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#111827',
  },
  link: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4d7c0f',
  },
});
