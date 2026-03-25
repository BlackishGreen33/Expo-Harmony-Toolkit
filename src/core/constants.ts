export const TOOLKIT_PACKAGE_NAME = 'expo-harmony-toolkit';
export const CLI_NAME = 'expo-harmony';
export const TOOLKIT_VERSION = '1.0.0';
export const TEMPLATE_VERSION = 'rnoh-0.82.18';
export const RNOH_VERSION = '0.82.18';
export const RNOH_CLI_VERSION = '0.82.18';
export const SUPPORTED_EXPO_SDKS = [53, 55];
export const GENERATED_DIR = '.expo-harmony';
export const GENERATED_SHIMS_DIR = `${GENERATED_DIR}/shims`;
export const MANIFEST_FILENAME = 'manifest.json';
export const DOCTOR_REPORT_FILENAME = 'doctor-report.json';
export const TOOLKIT_CONFIG_FILENAME = 'toolkit-config.json';
export const PREBUILD_METADATA_FILENAME = 'prebuild-metadata.json';
export const DEFAULT_HVIGOR_PLUGIN_FILENAME = `rnoh-hvigor-plugin-${RNOH_CLI_VERSION}.tgz`;
export const STRICT_DOCTOR_EXIT_CODE = 2;
export const HARMONY_ROUTER_ENTRY_FILENAME = 'index.harmony.js';
export const HARMONY_RUNTIME_PRELUDE_RELATIVE_PATH = `${GENERATED_SHIMS_DIR}/runtime-prelude.js`;

export const DESIRED_PACKAGE_SCRIPTS: Record<string, string> = {
  'harmony:doctor': 'expo-harmony doctor',
  'harmony:init': 'expo-harmony init',
  'harmony:sync-template': 'expo-harmony sync-template',
  'bundle:harmony':
    'react-native bundle-harmony --dev false --entry-file index.js --bundle-output harmony/entry/src/main/resources/rawfile/bundle.harmony.js --assets-dest harmony/entry/src/main/resources/rawfile/assets --config ./metro.harmony.config.js',
};
