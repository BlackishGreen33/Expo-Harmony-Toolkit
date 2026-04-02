import * as FileSystem from 'expo-file-system';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function FileSystemPreviewScreen() {
  const documentDirectory = FileSystem.documentDirectory ?? null;
  const targetUri = `${documentDirectory ?? 'file:///expo-harmony/document/'}preview.txt`;
  const targetContents = 'expo-harmony-functional';
  const [message, setMessage] = useState('Choose one action to validate sandbox file I/O step by step.');

  const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

  const writeFile = async () => {
    try {
      await FileSystem.writeAsStringAsync(targetUri, targetContents);
      const afterWrite = await FileSystem.getInfoAsync(targetUri);
      setMessage(
        `Write OK. exists=${String(afterWrite.exists)} size=${String(afterWrite.size ?? 0)} uri=${targetUri}`,
      );
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const readFile = async () => {
    try {
      const contents = await FileSystem.readAsStringAsync(targetUri);
      setMessage(`Read OK. contents=${contents}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const inspectFile = async () => {
    try {
      const info = await FileSystem.getInfoAsync(targetUri);
      setMessage(
        `Info OK. exists=${String(info.exists)} isDirectory=${String(info.isDirectory)} size=${String(info.size ?? 0)}`,
      );
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const listDirectory = async () => {
    if (!documentDirectory) {
      setMessage('List sandbox directory unavailable because documentDirectory is missing.');
      return;
    }

    try {
      const entries = await FileSystem.readDirectoryAsync(documentDirectory);
      setMessage(
        `Directory OK. entries=${entries.length > 0 ? entries.join(', ') : '(empty)'}`,
      );
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const deleteFile = async () => {
    try {
      const beforeDelete = await FileSystem.getInfoAsync(targetUri);

      if (!beforeDelete.exists) {
        setMessage('Delete skipped. preview.txt does not exist.');
        return;
      }

      await FileSystem.deleteAsync(targetUri);
      const afterDelete = await FileSystem.getInfoAsync(targetUri);
      setMessage(`Delete OK. existsAfterDelete=${String(afterDelete.exists)}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const openSandboxUri = async () => {
    if (!documentDirectory) {
      setMessage('Open sandbox URI unavailable because documentDirectory is missing.');
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(documentDirectory);

      if (!canOpen) {
        setMessage('Open sandbox URI is not supported by the current Harmony runtime handler.');
        return;
      }

      await Linking.openURL(documentDirectory);
      setMessage(
        'Open sandbox URI requested. Actual system folder handoff depends on the current Harmony runtime handler.',
      );
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const runFunctionalFlow = async () => {
    try {
      await FileSystem.writeAsStringAsync(targetUri, targetContents);
      const afterWrite = await FileSystem.getInfoAsync(targetUri);
      const contents = await FileSystem.readAsStringAsync(targetUri);
      await FileSystem.deleteAsync(targetUri);
      const afterDelete = await FileSystem.getInfoAsync(targetUri);

      setMessage(
        `Functional flow OK. existsAfterWrite=${String(afterWrite.exists)} contents=${contents} existsAfterDelete=${String(afterDelete.exists)}`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.title}>expo-file-system functional check</Text>
          <Text style={styles.body}>
            This route exposes single-step sandbox file actions so you can validate write, read, inspect,
            list, and delete behavior separately before running the full flow.
          </Text>
          <Text style={styles.meta}>documentDirectory: {documentDirectory ?? 'n/a'}</Text>
          <Text style={styles.meta}>target file: {targetUri}</Text>
          <View style={styles.statusBox}>
            <Text style={styles.message}>{message}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.actionButton} onPress={writeFile}>
              <Text style={styles.buttonLabel}>Write file</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={readFile}>
              <Text style={styles.buttonLabel}>Read file</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={inspectFile}>
              <Text style={styles.buttonLabel}>Inspect file</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={listDirectory}>
              <Text style={styles.buttonLabel}>List sandbox directory</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={deleteFile}>
              <Text style={styles.buttonLabel}>Delete file</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={openSandboxUri}>
              <Text style={styles.buttonLabel}>Open sandbox URI</Text>
            </Pressable>
          </View>
          <Pressable style={[styles.actionButton, styles.primaryButton]} onPress={runFunctionalFlow}>
            <Text style={styles.buttonLabel}>Run full write/read/delete flow</Text>
          </Pressable>
          <Text style={styles.helper}>
            `Open sandbox URI` is exploratory. Whether a system folder UI appears depends on the active
            Harmony handler.
          </Text>
          <Link href="/" style={styles.link}>
            Back to home
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0fdfa',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 560,
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
    color: '#134e4a',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    minWidth: 220,
    flexGrow: 1,
  },
  primaryButton: {
    backgroundColor: '#115e59',
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  helper: {
    fontSize: 13,
    lineHeight: 18,
    color: '#4b5563',
  },
  statusBox: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#99f6e4',
    minHeight: 72,
    justifyContent: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#111827',
  },
  link: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f766e',
  },
});
