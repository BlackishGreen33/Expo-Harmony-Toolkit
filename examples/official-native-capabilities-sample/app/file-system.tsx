import * as FileSystem from 'expo-file-system';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const UTF8_CONTENT = 'expo-harmony-functional-v1.7.2';
const BASE64_CONTENT = 'ZXhwby1oYXJtb255LWJhc2U2NC1yb3VuZHRyaXA=';
const DOWNLOAD_URL = 'https://example.com/';

export default function FileSystemPreviewScreen() {
  const documentDirectory = FileSystem.documentDirectory ?? null;
  const sandboxDirectory = documentDirectory ? `${documentDirectory}functional-dir/` : null;
  const workingFile = sandboxDirectory ? `${sandboxDirectory}preview.txt` : null;
  const downloadTarget = sandboxDirectory ? `${sandboxDirectory}download.txt` : null;
  const [message, setMessage] = useState(
    'Validate UTF-8/base64 writes, append/partial reads, md5 info, and one sandbox download.',
  );

  const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

  const ensureTargets = () => {
    if (!sandboxDirectory || !workingFile || !downloadTarget) {
      setMessage('Sandbox targets are unavailable because documentDirectory is missing.');
      return null;
    }

    return {
      sandboxDirectory,
      workingFile,
      downloadTarget,
    };
  };

  const createDirectory = async () => {
    const targets = ensureTargets();

    if (!targets) {
      return;
    }

    try {
      await FileSystem.makeDirectoryAsync(targets.sandboxDirectory, { intermediates: true });
      setMessage(`Create directory OK. uri=${targets.sandboxDirectory}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const writeUtf8 = async () => {
    const targets = ensureTargets();

    if (!targets) {
      return;
    }

    try {
      await FileSystem.makeDirectoryAsync(targets.sandboxDirectory, { intermediates: true });
      await FileSystem.writeAsStringAsync(targets.workingFile, UTF8_CONTENT);
      setMessage(`Write UTF-8 OK. contents=${UTF8_CONTENT}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const writeBase64 = async () => {
    const targets = ensureTargets();

    if (!targets) {
      return;
    }

    try {
      await FileSystem.writeAsStringAsync(targets.workingFile, BASE64_CONTENT, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setMessage('Base64 roundtrip write OK.');
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const appendFile = async () => {
    const targets = ensureTargets();

    if (!targets) {
      return;
    }

    try {
      await FileSystem.writeAsStringAsync(targets.workingFile, '-append', {
        append: true,
      } as never);
      setMessage('Append write OK.');
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const readFullFile = async () => {
    const targets = ensureTargets();

    if (!targets) {
      return;
    }

    try {
      const contents = await FileSystem.readAsStringAsync(targets.workingFile);
      setMessage(`Read full OK. contents=${contents}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const readPartialFile = async () => {
    const targets = ensureTargets();

    if (!targets) {
      return;
    }

    try {
      const contents = await FileSystem.readAsStringAsync(targets.workingFile, {
        position: 0,
        length: 12,
      } as never);
      setMessage(`Partial read OK. contents=${contents}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const inspectMd5 = async () => {
    const targets = ensureTargets();

    if (!targets) {
      return;
    }

    try {
      const info = await FileSystem.getInfoAsync(targets.workingFile, { md5: true });
      setMessage(`MD5 info OK. exists=${String(info.exists)} md5=${String((info as { md5?: string }).md5 ?? 'n/a')}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const downloadRemoteFile = async () => {
    const targets = ensureTargets();

    if (!targets) {
      return;
    }

    try {
      const result = await FileSystem.downloadAsync(DOWNLOAD_URL, targets.downloadTarget, {
        md5: true,
      } as never);
      setMessage(`Download remote file OK. status=${String((result as { status?: number }).status ?? 'n/a')} uri=${targets.downloadTarget}`);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const clearArtifacts = async () => {
    const targets = ensureTargets();

    if (!targets) {
      return;
    }

    try {
      await FileSystem.deleteAsync(targets.downloadTarget, { idempotent: true });
      await FileSystem.deleteAsync(targets.workingFile, { idempotent: true });
      await FileSystem.deleteAsync(targets.sandboxDirectory, { idempotent: true });
      setMessage('Cleanup OK. Generated files were removed if present.');
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const runFullFlow = async () => {
    const targets = ensureTargets();

    if (!targets) {
      return;
    }

    try {
      await FileSystem.makeDirectoryAsync(targets.sandboxDirectory, { intermediates: true });
      await FileSystem.writeAsStringAsync(targets.workingFile, UTF8_CONTENT);
      await FileSystem.writeAsStringAsync(targets.workingFile, '-append', {
        append: true,
      } as never);
      await FileSystem.readAsStringAsync(targets.workingFile, {
        position: 0,
        length: 10,
      } as never);
      await FileSystem.getInfoAsync(targets.workingFile, { md5: true });
      await FileSystem.downloadAsync(DOWNLOAD_URL, targets.downloadTarget, { md5: true } as never);
      setMessage('Full file-system flow OK.');
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
            This route validates the v1.7.2 preview subset: UTF-8 and base64 writes, append and
            partial reads, md5 info snapshots, and remote download into the app sandbox.
          </Text>
          <View style={styles.statusBox}>
            <Text style={styles.message}>{message}</Text>
          </View>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Current targets</Text>
            <Text style={styles.resultLine}>documentDirectory: {documentDirectory ?? 'n/a'}</Text>
            <Text style={styles.resultLine}>sandboxDirectory: {sandboxDirectory ?? 'n/a'}</Text>
            <Text style={styles.resultLine}>workingFile: {workingFile ?? 'n/a'}</Text>
            <Text style={styles.resultLine}>downloadTarget: {downloadTarget ?? 'n/a'}</Text>
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.actionButton} onPress={createDirectory}>
              <Text style={styles.buttonLabel}>Create sandbox directory</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={writeUtf8}>
              <Text style={styles.buttonLabel}>Write UTF-8 file</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={writeBase64}>
              <Text style={styles.buttonLabel}>Base64 roundtrip</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={appendFile}>
              <Text style={styles.buttonLabel}>Append file</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={readFullFile}>
              <Text style={styles.buttonLabel}>Read full file</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={readPartialFile}>
              <Text style={styles.buttonLabel}>Read partial file</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={inspectMd5}>
              <Text style={styles.buttonLabel}>Check md5 info</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={downloadRemoteFile}>
              <Text style={styles.buttonLabel}>Download remote file</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={clearArtifacts}>
              <Text style={styles.secondaryButtonLabel}>Clear generated artifacts</Text>
            </Pressable>
          </View>

          <Pressable style={[styles.actionButton, styles.primaryButton]} onPress={runFullFlow}>
            <Text style={styles.buttonLabel}>Run full file-system flow</Text>
          </Pressable>

          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Preview boundary</Text>
            <Text style={styles.resultLine}>All current expo-file-system preview gaps are closed to a documented yellow subset.</Text>
            <Text style={styles.resultLine}>This route still remains preview because device and release evidence are not promoted to verified yet.</Text>
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
    padding: 14,
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: '#134e4a',
  },
  resultCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#f8fafc',
    gap: 6,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  resultLine: {
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
  },
  link: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f766e',
  },
});
