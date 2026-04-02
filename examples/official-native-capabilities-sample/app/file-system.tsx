import * as FileSystem from 'expo-file-system';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const TARGET_CONTENTS = 'expo-harmony-functional';

export default function FileSystemPreviewScreen() {
  const documentDirectory = FileSystem.documentDirectory ?? null;
  const sandboxDirectory = documentDirectory ? `${documentDirectory}functional-dir/` : null;
  const workingFile = sandboxDirectory ? `${sandboxDirectory}preview.txt` : null;
  const copiedFile = sandboxDirectory ? `${sandboxDirectory}preview-copy.txt` : null;
  const movedFile = documentDirectory ? `${documentDirectory}preview-moved.txt` : null;
  const [message, setMessage] = useState(
    'Start with Create sandbox directory, then write, read, copy, move, and clean up the generated files.',
  );

  const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

  const ensureSandboxTargets = () => {
    if (!documentDirectory || !sandboxDirectory || !workingFile || !copiedFile || !movedFile) {
      setMessage('Sandbox file targets are unavailable because documentDirectory is missing.');
      return null;
    }

    return {
      sandboxDirectory,
      workingFile,
      copiedFile,
      movedFile,
    };
  };

  const createDirectory = async () => {
    const targets = ensureSandboxTargets();

    if (!targets) {
      return;
    }

    try {
      await FileSystem.makeDirectoryAsync(targets.sandboxDirectory, { intermediates: true });
      const info = await FileSystem.getInfoAsync(targets.sandboxDirectory);
      setMessage(
        `Create directory OK. exists=${String(info.exists)} isDirectory=${String(info.isDirectory)} uri=${targets.sandboxDirectory}`,
      );
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const writeFile = async () => {
    const targets = ensureSandboxTargets();

    if (!targets) {
      return;
    }

    try {
      await FileSystem.makeDirectoryAsync(targets.sandboxDirectory, { intermediates: true });
      await FileSystem.writeAsStringAsync(targets.workingFile, TARGET_CONTENTS);
      const afterWrite = await FileSystem.getInfoAsync(targets.workingFile);
      setMessage(
        `Write OK. exists=${String(afterWrite.exists)} size=${String(afterWrite.size ?? 0)} uri=${targets.workingFile}`,
      );
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const readFile = async () => {
    const targets = ensureSandboxTargets();

    if (!targets) {
      return;
    }

    try {
      const contents = await FileSystem.readAsStringAsync(targets.workingFile);
      setMessage(`Read OK. contents=${contents}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const inspectFile = async () => {
    const targets = ensureSandboxTargets();

    if (!targets) {
      return;
    }

    try {
      const info = await FileSystem.getInfoAsync(targets.workingFile);
      setMessage(
        `Info OK. exists=${String(info.exists)} isDirectory=${String(info.isDirectory)} size=${String(info.size ?? 0)}`,
      );
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const listDirectory = async () => {
    const targets = ensureSandboxTargets();

    if (!targets) {
      return;
    }

    try {
      const entries = await FileSystem.readDirectoryAsync(targets.sandboxDirectory);
      setMessage(`Directory OK. entries=${entries.length > 0 ? entries.join(', ') : '(empty)'}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const copyFile = async () => {
    const targets = ensureSandboxTargets();

    if (!targets) {
      return;
    }

    try {
      await FileSystem.copyAsync({
        from: targets.workingFile,
        to: targets.copiedFile,
      });
      const info = await FileSystem.getInfoAsync(targets.copiedFile);
      setMessage(`Copy OK. exists=${String(info.exists)} uri=${targets.copiedFile}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const moveCopiedFile = async () => {
    const targets = ensureSandboxTargets();

    if (!targets) {
      return;
    }

    try {
      await FileSystem.moveAsync({
        from: targets.copiedFile,
        to: targets.movedFile,
      });
      const info = await FileSystem.getInfoAsync(targets.movedFile);
      setMessage(`Move OK. exists=${String(info.exists)} uri=${targets.movedFile}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const clearArtifacts = async () => {
    const targets = ensureSandboxTargets();

    if (!targets) {
      return;
    }

    try {
      await FileSystem.deleteAsync(targets.workingFile, { idempotent: true });
      await FileSystem.deleteAsync(targets.copiedFile, { idempotent: true });
      await FileSystem.deleteAsync(targets.movedFile, { idempotent: true });
      await FileSystem.deleteAsync(targets.sandboxDirectory, { idempotent: true });
      setMessage('Cleanup OK. All generated files and directories were removed if present.');
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const runFunctionalFlow = async () => {
    const targets = ensureSandboxTargets();

    if (!targets) {
      return;
    }

    try {
      await FileSystem.makeDirectoryAsync(targets.sandboxDirectory, { intermediates: true });
      await FileSystem.writeAsStringAsync(targets.workingFile, TARGET_CONTENTS);
      const contents = await FileSystem.readAsStringAsync(targets.workingFile);
      await FileSystem.copyAsync({
        from: targets.workingFile,
        to: targets.copiedFile,
      });
      await FileSystem.moveAsync({
        from: targets.copiedFile,
        to: targets.movedFile,
      });
      const entries = await FileSystem.readDirectoryAsync(targets.sandboxDirectory);
      await FileSystem.deleteAsync(targets.workingFile, { idempotent: true });
      await FileSystem.deleteAsync(targets.movedFile, { idempotent: true });
      await FileSystem.deleteAsync(targets.sandboxDirectory, { idempotent: true });

      setMessage(
        `Functional flow OK. contents=${contents} remainingEntries=${entries.length} movedTarget=${targets.movedFile}`,
      );
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.title}>expo-file-system functional check</Text>
          <Text style={styles.body}>
            This route focuses on the supported sandbox file flow for v1.7.x: create a directory, write
            and read a file, inspect it, copy or move it, then delete the generated artifacts.
          </Text>
          <View style={styles.statusBox}>
            <Text style={styles.message}>{message}</Text>
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Current targets</Text>
            <Text style={styles.resultLine}>documentDirectory: {documentDirectory ?? 'n/a'}</Text>
            <Text style={styles.resultLine}>sandboxDirectory: {sandboxDirectory ?? 'n/a'}</Text>
            <Text style={styles.resultLine}>workingFile: {workingFile ?? 'n/a'}</Text>
            <Text style={styles.resultLine}>copiedFile: {copiedFile ?? 'n/a'}</Text>
            <Text style={styles.resultLine}>movedFile: {movedFile ?? 'n/a'}</Text>
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.actionButton} onPress={createDirectory}>
              <Text style={styles.buttonLabel}>Create sandbox directory</Text>
            </Pressable>
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
            <Pressable style={styles.actionButton} onPress={copyFile}>
              <Text style={styles.buttonLabel}>Copy file</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={moveCopiedFile}>
              <Text style={styles.buttonLabel}>Move copied file</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={clearArtifacts}>
              <Text style={styles.secondaryButtonLabel}>Clear generated artifacts</Text>
            </Pressable>
          </View>

          <Pressable style={[styles.actionButton, styles.primaryButton]} onPress={runFunctionalFlow}>
            <Text style={styles.buttonLabel}>Run full create/write/read/copy/move flow</Text>
          </Pressable>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Support boundary</Text>
            <Text style={styles.resultLine}>UTF-8 sandbox file I/O is the supported subset for this sample.</Text>
            <Text style={styles.resultLine}>`base64` encoding and `downloadAsync` stay outside the v1.7.x main path.</Text>
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
  secondaryButton: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#99f6e4',
    alignItems: 'center',
    minWidth: 220,
    flexGrow: 1,
  },
  secondaryButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#115e59',
  },
  primaryButton: {
    backgroundColor: '#115e59',
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
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
  resultCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#f8fafc',
    gap: 8,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  resultLine: {
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
  },
  link: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f766e',
  },
});
