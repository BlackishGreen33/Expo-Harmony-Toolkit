import fs from 'fs-extra';
import JSON5 from 'json5';
import path from 'path';
import {
  GENERATED_DIR,
  SIGNING_LOCAL_EXAMPLE_FILENAME,
  SIGNING_LOCAL_FILENAME,
} from './constants';

type JsonRecord = Record<string, unknown>;

type BuildProfile = JsonRecord & {
  app?: JsonRecord & {
    signingConfigs?: JsonRecord[];
    products?: JsonRecord[];
  };
};

type SigningLocalAppFragment = {
  signingConfigs?: JsonRecord[];
  products?: JsonRecord[];
};

export function getSigningLocalPath(projectRoot: string): string {
  return path.join(projectRoot, GENERATED_DIR, SIGNING_LOCAL_FILENAME);
}

export function getSigningLocalExamplePath(projectRoot: string): string {
  return path.join(projectRoot, GENERATED_DIR, SIGNING_LOCAL_EXAMPLE_FILENAME);
}

export async function readSigningLocalConfig(projectRoot: string): Promise<SigningLocalAppFragment | null> {
  const signingLocalPath = getSigningLocalPath(projectRoot);

  if (!(await fs.pathExists(signingLocalPath))) {
    return null;
  }

  const rawConfig = (await fs.readJson(signingLocalPath)) as unknown;
  return normalizeSigningLocalConfig(rawConfig);
}

export function mergeSigningLocalConfigIntoBuildProfile(
  rawBuildProfileContents: string,
  signingLocalConfig: SigningLocalAppFragment | null,
): string {
  if (!signingLocalConfig) {
    return rawBuildProfileContents;
  }

  const parsed = JSON5.parse(rawBuildProfileContents) as BuildProfile;
  const merged = mergeSigningLocalConfig(parsed, signingLocalConfig);

  return JSON.stringify(merged, null, 2) + '\n';
}

export function hasSigningConfiguration(
  rawBuildProfileContents: string | null,
  signingLocalConfig: SigningLocalAppFragment | null = null,
): boolean {
  if (hasSigningLocalConfiguration(signingLocalConfig)) {
    return true;
  }

  if (!rawBuildProfileContents) {
    return false;
  }

  try {
    const parsed = JSON5.parse(rawBuildProfileContents) as BuildProfile;
    return hasNonEmptySigningConfigList(parsed.app?.signingConfigs);
  } catch (_error) {
    return false;
  }
}

export function hasSigningLocalConfiguration(
  signingLocalConfig: SigningLocalAppFragment | null,
): boolean {
  return hasNonEmptySigningConfigList(signingLocalConfig?.signingConfigs);
}

export function renderSigningLocalExampleConfig(): string {
  return (
    JSON.stringify(
      {
        signingConfigs: [
          {
            name: 'default',
            type: 'HarmonyOS',
            material: {
              storeFile: './signing/release.p12',
              storePassword: '<replace-with-store-password>',
              keyAlias: '<replace-with-key-alias>',
              keyPassword: '<replace-with-key-password>',
              signAlg: 'SHA256withECDSA',
              profile: './signing/release.p7b',
              certpath: './signing/release.cer',
            },
          },
        ],
        products: [
          {
            name: 'default',
            signingConfig: 'default',
          },
        ],
      },
      null,
      2,
    ) + '\n'
  );
}

function normalizeSigningLocalConfig(rawConfig: unknown): SigningLocalAppFragment {
  const candidate =
    rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)
      ? 'app' in rawConfig &&
        rawConfig.app &&
        typeof rawConfig.app === 'object' &&
        !Array.isArray(rawConfig.app)
        ? (rawConfig.app as JsonRecord)
        : (rawConfig as JsonRecord)
      : {};

  const signingConfigs = Array.isArray(candidate.signingConfigs)
    ? candidate.signingConfigs.filter(isJsonRecord)
    : undefined;
  const products = Array.isArray(candidate.products)
    ? candidate.products.filter(isJsonRecord)
    : undefined;

  return {
    ...(signingConfigs ? { signingConfigs } : {}),
    ...(products ? { products } : {}),
  };
}

function mergeSigningLocalConfig(
  buildProfile: BuildProfile,
  signingLocalConfig: SigningLocalAppFragment,
): BuildProfile {
  const nextBuildProfile: BuildProfile = {
    ...buildProfile,
    app: isJsonRecord(buildProfile.app)
      ? {
          ...buildProfile.app,
        }
      : {},
  };

  if (Array.isArray(signingLocalConfig.signingConfigs)) {
    nextBuildProfile.app!.signingConfigs = signingLocalConfig.signingConfigs.map((entry) => ({ ...entry }));
  }

  if (Array.isArray(signingLocalConfig.products)) {
    const currentProducts = Array.isArray(nextBuildProfile.app!.products)
      ? nextBuildProfile.app!.products.map((entry) => ({ ...entry }))
      : [];

    for (const incomingProduct of signingLocalConfig.products) {
      const incomingName =
        typeof incomingProduct.name === 'string' && incomingProduct.name.length > 0
          ? incomingProduct.name
          : null;
      const existingIndex =
        incomingName === null
          ? -1
          : currentProducts.findIndex((entry) => entry.name === incomingName);

      if (existingIndex >= 0) {
        currentProducts[existingIndex] = {
          ...currentProducts[existingIndex],
          ...incomingProduct,
        };
        continue;
      }

      currentProducts.push({ ...incomingProduct });
    }

    nextBuildProfile.app!.products = currentProducts;
  }

  return nextBuildProfile;
}

function hasNonEmptySigningConfigList(signingConfigs: unknown): boolean {
  return Array.isArray(signingConfigs) && signingConfigs.some(isJsonRecord);
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
