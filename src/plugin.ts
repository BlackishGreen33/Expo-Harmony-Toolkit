import fs from 'fs-extra';
import path from 'path';
import { ConfigPlugin, createRunOncePlugin, withDangerousMod } from 'expo/config-plugins';
import { DEFAULT_VALIDATED_MATRIX_ID } from './data/validatedMatrices';
import {
  ExpoHarmonyPluginProps,
  HarmonyIdentifiers,
} from './types';
import {
  PREBUILD_METADATA_FILENAME,
  GENERATED_DIR,
  TEMPLATE_VERSION,
  TOOLKIT_PACKAGE_NAME,
  TOOLKIT_VERSION,
} from './core/constants';
import { deriveHarmonyIdentifiers } from './core/project';
import { collectExpoPlugins, collectExpoSchemes } from './core/project';

export const withExpoHarmony: ConfigPlugin<ExpoHarmonyPluginProps> = (config, props = {}) => {
  validatePluginProps(props);

  const identifiers = deriveHarmonyIdentifiers(config, undefined, props);
  config.extra = {
    ...(config.extra ?? {}),
    expoHarmony: {
      bundleName: identifiers.bundleName,
      entryModuleName: identifiers.entryModuleName,
      templateVersion: props.templateVersion ?? TEMPLATE_VERSION,
      overwrite: props.overwrite ?? false,
    },
  };

  config = registerMetadataDangerousMod(config, 'android', identifiers, props);
  config = registerMetadataDangerousMod(config, 'ios', identifiers, props);

  return config;
};

export function buildPrebuildMetadata(
  config: Record<string, any>,
  identifiers: HarmonyIdentifiers,
  props: ExpoHarmonyPluginProps = {},
): Record<string, any> {
  return {
    generatedAt: new Date().toISOString(),
    generatedBy: `${TOOLKIT_PACKAGE_NAME}@${TOOLKIT_VERSION}`,
    matrixId: DEFAULT_VALIDATED_MATRIX_ID,
    templateVersion: props.templateVersion ?? TEMPLATE_VERSION,
    app: {
      name: config.name ?? null,
      slug: config.slug ?? null,
      version: config.version ?? null,
      schemes: collectExpoSchemes(config),
      plugins: collectExpoPlugins(config),
    },
    identifiers,
    props: {
      overwrite: props.overwrite ?? false,
    },
  };
}

function registerMetadataDangerousMod(
  config: any,
  platform: 'android' | 'ios',
  identifiers: HarmonyIdentifiers,
  props: ExpoHarmonyPluginProps,
) {
  return withDangerousMod(config as any, [
    platform,
    async (currentConfig) => {
      const metadata = buildPrebuildMetadata(currentConfig, identifiers, props);
      const projectRoot = currentConfig.modRequest.projectRoot;
      const targetPath = path.join(projectRoot, GENERATED_DIR, PREBUILD_METADATA_FILENAME);

      await fs.ensureDir(path.dirname(targetPath));
      await fs.writeJson(targetPath, metadata, { spaces: 2 });

      return currentConfig;
    },
  ]);
}

export function validatePluginProps(props: ExpoHarmonyPluginProps): void {
  if (props.bundleName !== undefined && !/^[a-zA-Z][a-zA-Z0-9_.]+$/.test(props.bundleName)) {
    throw new Error('[expo-harmony-toolkit] bundleName must be a valid identifier such as com.example.app');
  }

  if (props.entryModuleName !== undefined && props.entryModuleName.trim().length === 0) {
    throw new Error('[expo-harmony-toolkit] entryModuleName cannot be empty');
  }

  if (props.templateVersion !== undefined && props.templateVersion.trim().length === 0) {
    throw new Error('[expo-harmony-toolkit] templateVersion cannot be empty');
  }
}

export default createRunOncePlugin(withExpoHarmony, TOOLKIT_PACKAGE_NAME, TOOLKIT_VERSION);
