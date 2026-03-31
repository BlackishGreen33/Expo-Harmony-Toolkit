export const TOOLKIT_PACKAGE_NAME = 'expo-harmony-toolkit';
export const CLI_NAME = 'expo-harmony';
export const TOOLKIT_VERSION = '1.6.0';
export const TEMPLATE_VERSION = 'rnoh-0.82.18';
export const RNOH_VERSION = '0.82.18';
export const RNOH_CLI_VERSION = '0.82.18';
export const SUPPORTED_EXPO_SDKS = [53, 55];
export const GENERATED_DIR = '.expo-harmony';
export const GENERATED_SHIMS_DIR = `${GENERATED_DIR}/shims`;
export const MANIFEST_FILENAME = 'manifest.json';
export const DOCTOR_REPORT_FILENAME = 'doctor-report.json';
export const ENV_REPORT_FILENAME = 'env-report.json';
export const BUILD_REPORT_FILENAME = 'build-report.json';
export const TOOLKIT_CONFIG_FILENAME = 'toolkit-config.json';
export const PREBUILD_METADATA_FILENAME = 'prebuild-metadata.json';
export const DEFAULT_HVIGOR_PLUGIN_FILENAME = `rnoh-hvigor-plugin-${RNOH_CLI_VERSION}.tgz`;
export const STRICT_DOCTOR_EXIT_CODE = 2;
export const STRICT_ENV_EXIT_CODE = 3;
export const HARMONY_ROUTER_ENTRY_FILENAME = 'index.harmony.js';
export const HARMONY_RUNTIME_PRELUDE_RELATIVE_PATH = `${GENERATED_SHIMS_DIR}/runtime-prelude.js`;

export const DESIRED_PACKAGE_SCRIPTS: Record<string, string> = {
  'harmony:doctor': 'expo-harmony doctor',
  'harmony:init': 'expo-harmony init',
  'harmony:sync-template': 'expo-harmony sync-template',
  'harmony:env': 'expo-harmony env',
  'harmony:bundle': 'expo-harmony bundle',
  'harmony:build:debug': 'expo-harmony build-hap --mode debug',
  'harmony:build:release': 'expo-harmony build-hap --mode release',
};
