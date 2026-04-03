import fs from 'fs-extra';
import JSON5 from 'json5';
import os from 'os';
import path from 'path';
import { UI_STACK_ADAPTER_PACKAGE_NAMES, UI_STACK_VALIDATED_ADAPTERS } from '../data/uiStack';
import { PackageJson, TemplateFileDefinition } from '../types';

export const AUTOLINKED_FILE_PATHS = [
  path.join('harmony', 'oh-package.json5'),
  path.join('harmony', 'entry', 'src', 'main', 'ets', 'RNOHPackagesFactory.ets'),
  path.join('harmony', 'entry', 'src', 'main', 'cpp', 'RNOHPackagesFactory.h'),
  path.join('harmony', 'entry', 'src', 'main', 'cpp', 'autolinking.cmake'),
] as const;

type PackageJsonNormalizer = (
  packageJson: Record<string, unknown>,
) => Record<string, unknown> | null;

const HARMONY_PACKAGE_JSON_NORMALIZERS: Record<string, PackageJsonNormalizer> = {
  '@react-native-oh-tpl/react-native-gesture-handler': (packageJson) => {
    const harmony =
      packageJson.harmony && typeof packageJson.harmony === 'object' && !Array.isArray(packageJson.harmony)
        ? { ...packageJson.harmony }
        : null;

    if (!harmony || !('codegenConfig' in harmony)) {
      return null;
    }

    delete harmony.codegenConfig;
    return {
      ...packageJson,
      harmony,
    };
  },
};

type ManagedAutolinkingEntry = {
  adapterPackageName: string;
  etsImportPath: string;
  etsPackageName: string;
  cppHeaderName: string;
  cppPackageName: string;
  cmakeTargetName: string;
};

type AutolinkingArtifacts = {
  ohPackageContents: string;
  etsFactoryContents: string;
  cppFactoryContents: string;
  cmakeContents: string;
};

export class AutolinkingFailureError extends Error {
  constructor(
    stage: string,
    command: string,
    options: {
      cause?: string;
      missingFiles?: string[];
    } = {},
  ) {
    const details: string[] = [
      `Harmony autolinking failed during ${stage}.`,
      `Command: ${command}`,
    ];

    if (options.missingFiles && options.missingFiles.length > 0) {
      details.push(`Missing files: ${options.missingFiles.join(', ')}`);
    }

    if (options.cause) {
      details.push(`Cause: ${options.cause}`);
    }

    super(details.join(' '));
    this.name = 'AutolinkingFailureError';
  }
}

export async function buildAutolinkedManagedFiles(
  projectRoot: string,
  harmonyRootPackageContents: string,
): Promise<TemplateFileDefinition[]> {
  const generated = await generateAutolinkingArtifacts(projectRoot, harmonyRootPackageContents);

  return [
    {
      relativePath: AUTOLINKED_FILE_PATHS[0],
      contents: generated.ohPackageContents,
    },
    {
      relativePath: AUTOLINKED_FILE_PATHS[1],
      contents: generated.etsFactoryContents,
    },
    {
      relativePath: AUTOLINKED_FILE_PATHS[2],
      contents: generated.cppFactoryContents,
    },
    {
      relativePath: AUTOLINKED_FILE_PATHS[3],
      contents: generated.cmakeContents,
    },
  ];
}

export async function normalizeKnownHarmonyPackageJsons(
  projectRoot: string,
): Promise<() => Promise<void>> {
  const originalContentsByPath = new Map<string, string>();

  for (const [packageName, normalizePackageJson] of Object.entries(HARMONY_PACKAGE_JSON_NORMALIZERS)) {
    const packageJsonPath = resolveProjectPackageJson(projectRoot, packageName);

    if (!packageJsonPath || originalContentsByPath.has(packageJsonPath)) {
      continue;
    }

    try {
      const currentContents = await fs.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(currentContents) as Record<string, unknown>;
      const normalizedPackageJson = normalizePackageJson(packageJson);

      if (!normalizedPackageJson) {
        continue;
      }

      originalContentsByPath.set(packageJsonPath, currentContents);
      await fs.writeFile(packageJsonPath, JSON.stringify(normalizedPackageJson, null, 2) + '\n');
    } catch {
      // Ignore malformed adapter package metadata and let downstream tooling surface the failure.
    }
  }

  return async () => {
    for (const [packageJsonPath, originalContents] of originalContentsByPath) {
      await fs.writeFile(packageJsonPath, originalContents);
    }
  };
}

async function generateAutolinkingArtifacts(
  projectRoot: string,
  harmonyRootPackageContents: string,
): Promise<AutolinkingArtifacts> {
  const rnohCliPackageJsonPath = resolveProjectPackageJson(
    projectRoot,
    '@react-native-oh/react-native-harmony-cli',
  );
  const managedOhPackageContents = await buildManagedHarmonyRootPackageContents(
    projectRoot,
    harmonyRootPackageContents,
  );
  const managedAutolinkingEntries = await resolveManagedAutolinkingEntries(projectRoot);

  if (!rnohCliPackageJsonPath) {
    return createEmptyAutolinkingArtifacts(managedOhPackageContents, managedAutolinkingEntries);
  }

  const restoreNormalizedHarmonyPackageJsons = await normalizeKnownHarmonyPackageJsons(projectRoot);

  try {
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'expo-harmony-autolinking-'));

    try {
      const temporaryHarmonyRoot = path.join(temporaryRoot, 'harmony');
      const commandDescription = buildRnohLinkHarmonyCommand(projectRoot, temporaryHarmonyRoot);

      await fs.ensureDir(path.join(temporaryHarmonyRoot, 'entry', 'src', 'main', 'ets'));
      await fs.ensureDir(path.join(temporaryHarmonyRoot, 'entry', 'src', 'main', 'cpp'));
      await fs.writeFile(path.join(temporaryHarmonyRoot, 'oh-package.json5'), harmonyRootPackageContents);
      await runRnohLinkHarmonyCommand(
        projectRoot,
        rnohCliPackageJsonPath,
        temporaryHarmonyRoot,
        commandDescription,
      );

      await assertGeneratedAutolinkingFilesExist(temporaryHarmonyRoot, commandDescription);

      let normalizedEtsFactoryContents: string;
      let normalizedCppFactoryContents: string;
      let normalizedCmakeContents: string;

      try {
        normalizedEtsFactoryContents = await normalizeAutolinkingEtsFactoryContents(
          projectRoot,
          await fs.readFile(
            path.join(temporaryHarmonyRoot, 'entry', 'src', 'main', 'ets', 'RNOHPackagesFactory.ets'),
            'utf8',
          ),
        );
        normalizedCppFactoryContents = await normalizeAutolinkingCppFactoryContents(
          projectRoot,
          await fs.readFile(
            path.join(temporaryHarmonyRoot, 'entry', 'src', 'main', 'cpp', 'RNOHPackagesFactory.h'),
            'utf8',
          ),
        );
        normalizedCmakeContents = await fs.readFile(
          path.join(temporaryHarmonyRoot, 'entry', 'src', 'main', 'cpp', 'autolinking.cmake'),
          'utf8',
        );
      } catch (error) {
        throw new AutolinkingFailureError('normalize-generated-files', commandDescription, {
          cause: getErrorMessage(error),
        });
      }

      return {
        ohPackageContents: managedOhPackageContents,
        etsFactoryContents: injectManagedAutolinkingIntoEtsFactory(
          normalizedEtsFactoryContents,
          managedAutolinkingEntries,
        ),
        cppFactoryContents: injectManagedAutolinkingIntoCppFactory(
          normalizedCppFactoryContents,
          managedAutolinkingEntries,
        ),
        cmakeContents: injectManagedAutolinkingIntoCmake(
          normalizedCmakeContents,
          managedAutolinkingEntries,
        ),
      };
    } finally {
      await fs.remove(temporaryRoot);
    }
  } finally {
    await restoreNormalizedHarmonyPackageJsons();
  }
}

async function resolveManagedAutolinkingEntries(projectRoot: string): Promise<ManagedAutolinkingEntry[]> {
  const entries: Array<ManagedAutolinkingEntry | null> = await Promise.all(
    UI_STACK_VALIDATED_ADAPTERS.map(async (adapter) => {
      if (adapter.supportsAutolinking || !adapter.managedAutolinking) {
        return null;
      }

      const dependencySpecifier = await resolveHarmonyAdapterHarDependency(
        projectRoot,
        adapter.adapterPackageName,
      );

      if (!dependencySpecifier) {
        return null;
      }

      return {
        adapterPackageName: adapter.adapterPackageName,
        ...adapter.managedAutolinking,
      } satisfies ManagedAutolinkingEntry;
    }),
  );

  return entries.filter((entry): entry is ManagedAutolinkingEntry => entry !== null);
}

async function normalizeAutolinkingEtsFactoryContents(
  projectRoot: string,
  contents: string,
): Promise<string> {
  let normalizedContents = contents
    .replace(
      /import type \{\s*RNPackageContext\s*,\s*RNOHPackage\s*\} from '@rnoh\/react-native-openharmony';/,
      "import type { RNPackageContext, RNPackage } from '@rnoh/react-native-openharmony';",
    )
    .replace(
      /export function createRNOHPackages\(([^)]*)\):\s*RNOHPackage\[\]/,
      'export function createRNOHPackages($1): RNPackage[]',
    );

  const gestureHandlerPackageJsonPath = resolveProjectPackageJson(
    projectRoot,
    '@react-native-oh-tpl/react-native-gesture-handler',
  );

  if (!gestureHandlerPackageJsonPath) {
    return normalizedContents;
  }

  try {
    const gestureHandlerPackageJson = (await fs.readJson(gestureHandlerPackageJsonPath)) as PackageJson & {
      harmony?: {
        codegenConfig?: unknown;
      };
    };

    if (gestureHandlerPackageJson.harmony?.codegenConfig) {
      return normalizedContents;
    }
  } catch {
    return normalizedContents;
  }

  let gestureHandlerPackageImportName: string | null = null;
  normalizedContents = normalizedContents.replace(
    /import\s+([A-Za-z_$][\w$]*)\s+from ['"]@react-native-oh-tpl\/react-native-gesture-handler['"];?/,
    (_match, importName: string) => {
      gestureHandlerPackageImportName = importName;
      return "import { GestureHandlerPackage } from '@react-native-oh-tpl/react-native-gesture-handler/ts';";
    },
  );

  if (!gestureHandlerPackageImportName) {
    return normalizedContents;
  }

  return normalizedContents.replace(
    new RegExp(`new\\s+${escapeRegExp(gestureHandlerPackageImportName)}\\(ctx\\)`, 'g'),
    'new GestureHandlerPackage(ctx)',
  );
}

function injectManagedAutolinkingIntoEtsFactory(
  contents: string,
  entries: readonly ManagedAutolinkingEntry[],
): string {
  if (entries.length === 0) {
    return contents;
  }

  const missingImports = entries
    .filter((entry) => !contents.includes(`from '${entry.etsImportPath}'`))
    .map((entry) => `import { ${entry.etsPackageName} } from '${entry.etsImportPath}';`);

  if (missingImports.length > 0) {
    contents = contents.replace(
      "import type { RNPackageContext, RNPackage } from '@rnoh/react-native-openharmony';",
      `import type { RNPackageContext, RNPackage } from '@rnoh/react-native-openharmony';\n${missingImports.join('\n')}`,
    );
  }

  const missingFactoryEntries = entries
    .filter((entry) => !contents.includes(`new ${entry.etsPackageName}(ctx)`))
    .map((entry) => `    new ${entry.etsPackageName}(ctx),`);

  if (missingFactoryEntries.length > 0) {
    contents = contents.replace(/return \[\n/, `return [\n${missingFactoryEntries.join('\n')}\n`);
  }

  return contents;
}

async function normalizeAutolinkingCppFactoryContents(
  projectRoot: string,
  contents: string,
): Promise<string> {
  const gestureHandlerPackageJsonPath = resolveProjectPackageJson(
    projectRoot,
    '@react-native-oh-tpl/react-native-gesture-handler',
  );

  if (!gestureHandlerPackageJsonPath) {
    return contents;
  }

  try {
    const gestureHandlerPackageJson = (await fs.readJson(gestureHandlerPackageJsonPath)) as PackageJson & {
      harmony?: {
        codegenConfig?: unknown;
      };
    };

    if (gestureHandlerPackageJson.harmony?.codegenConfig) {
      return contents;
    }
  } catch {
    return contents;
  }

  return contents
    .replace(
      /#include "ReactNativeOhTplReactNativeGestureHandlerPackage\.h"/,
      '#include "RnohReactNativeHarmonyGestureHandlerPackage.h"',
    )
    .replace(
      /\brnoh::ReactNativeOhTplReactNativeGestureHandlerPackage\b/g,
      'rnoh::RnohReactNativeHarmonyGestureHandlerPackage',
    );
}

function injectManagedAutolinkingIntoCppFactory(
  contents: string,
  entries: readonly ManagedAutolinkingEntry[],
): string {
  if (entries.length === 0) {
    return contents;
  }

  const missingIncludes = entries
    .filter((entry) => !contents.includes(`#include "${entry.cppHeaderName}"`))
    .map((entry) => `#include "${entry.cppHeaderName}"`);

  if (missingIncludes.length > 0) {
    contents = contents.replace(
      '#include "RNOH/Package.h"',
      `#include "RNOH/Package.h"\n${missingIncludes.join('\n')}`,
    );
  }

  const missingFactoryEntries = entries
    .filter((entry) => !contents.includes(`std::make_shared<rnoh::${entry.cppPackageName}>(ctx)`))
    .map((entry) => `    std::make_shared<rnoh::${entry.cppPackageName}>(ctx),`);

  if (missingFactoryEntries.length > 0) {
    contents = contents.replace(/return \{\n/, `return {\n${missingFactoryEntries.join('\n')}\n`);
  }

  return contents;
}

function injectManagedAutolinkingIntoCmake(
  contents: string,
  entries: readonly ManagedAutolinkingEntry[],
): string {
  if (entries.length === 0) {
    return contents;
  }

  const missingSubdirectories = entries
    .filter((entry) => !contents.includes(`./${entry.cmakeTargetName}`))
    .map(
      (entry) =>
        `    add_subdirectory("\${OH_MODULES_DIR}/${entry.adapterPackageName}/src/main/cpp" ./${entry.cmakeTargetName})`,
    );

  if (missingSubdirectories.length > 0) {
    contents = contents.replace(
      /function\(autolink_libraries target\)\n/,
      `function(autolink_libraries target)\n${missingSubdirectories.join('\n')}\n`,
    );
  }

  const missingLibraryTargets = entries
    .filter((entry) => !contents.includes(`        ${entry.cmakeTargetName}`))
    .map((entry) => `        ${entry.cmakeTargetName}`);

  if (missingLibraryTargets.length > 0) {
    contents = contents.replace(
      /set\(AUTOLINKED_LIBRARIES\n/,
      `set(AUTOLINKED_LIBRARIES\n${missingLibraryTargets.join('\n')}\n`,
    );
  }

  return contents;
}

async function runRnohLinkHarmonyCommand(
  projectRoot: string,
  rnohCliPackageJsonPath: string,
  harmonyProjectPath: string,
  commandDescription: string,
): Promise<void> {
  const rnohCliRoot = path.dirname(rnohCliPackageJsonPath);
  let commandLinkHarmony:
    | {
        func: (_argv: unknown[], _config: unknown, rawArgs: Record<string, unknown>) => Promise<void>;
      }
    | undefined;

  try {
    ({ commandLinkHarmony } = require(path.join(rnohCliRoot, 'dist', 'commands', 'link-harmony.js')) as {
      commandLinkHarmony: {
        func: (_argv: unknown[], _config: unknown, rawArgs: Record<string, unknown>) => Promise<void>;
      };
    });
  } catch (error) {
    throw new AutolinkingFailureError('load-link-harmony', commandDescription, {
      cause: getErrorMessage(error),
    });
  }

  try {
    await commandLinkHarmony.func([], {}, {
      harmonyProjectPath,
      nodeModulesPath: path.join(projectRoot, 'node_modules'),
      cmakeAutolinkPathRelativeToHarmony: './entry/src/main/cpp/autolinking.cmake',
      cppRnohPackagesFactoryPathRelativeToHarmony: './entry/src/main/cpp/RNOHPackagesFactory.h',
      etsRnohPackagesFactoryPathRelativeToHarmony: './entry/src/main/ets/RNOHPackagesFactory.ets',
      ohPackagePathRelativeToHarmony: './oh-package.json5',
      includeNpmPackages: UI_STACK_ADAPTER_PACKAGE_NAMES,
    });
  } catch (error) {
    throw new AutolinkingFailureError('link-harmony', commandDescription, {
      cause: getErrorMessage(error),
    });
  }
}

function buildRnohLinkHarmonyCommand(projectRoot: string, harmonyProjectPath: string): string {
  return [
    'link-harmony',
    `--harmonyProjectPath ${harmonyProjectPath}`,
    `--nodeModulesPath ${path.join(projectRoot, 'node_modules')}`,
    '--cmakeAutolinkPathRelativeToHarmony ./entry/src/main/cpp/autolinking.cmake',
    '--cppRnohPackagesFactoryPathRelativeToHarmony ./entry/src/main/cpp/RNOHPackagesFactory.h',
    '--etsRnohPackagesFactoryPathRelativeToHarmony ./entry/src/main/ets/RNOHPackagesFactory.ets',
    '--ohPackagePathRelativeToHarmony ./oh-package.json5',
  ].join(' ');
}

async function assertGeneratedAutolinkingFilesExist(
  harmonyProjectPath: string,
  commandDescription: string,
): Promise<void> {
  const requiredFiles = [
    path.join(harmonyProjectPath, 'entry', 'src', 'main', 'ets', 'RNOHPackagesFactory.ets'),
    path.join(harmonyProjectPath, 'entry', 'src', 'main', 'cpp', 'RNOHPackagesFactory.h'),
    path.join(harmonyProjectPath, 'entry', 'src', 'main', 'cpp', 'autolinking.cmake'),
  ];
  const missingFiles = requiredFiles.filter((filePath) => !fs.existsSync(filePath));

  if (missingFiles.length > 0) {
    throw new AutolinkingFailureError('validate-generated-files', commandDescription, {
      missingFiles: missingFiles.map((filePath) => path.relative(harmonyProjectPath, filePath)),
    });
  }
}

async function buildManagedHarmonyRootPackageContents(
  projectRoot: string,
  harmonyRootPackageContents: string,
): Promise<string> {
  const parsedPackageJson = JSON5.parse(harmonyRootPackageContents) as {
    dependencies?: Record<string, string>;
  };
  const dependencies = {
    ...(parsedPackageJson.dependencies ?? {}),
    ...(await readPreservedHarmonyRootDependencies(projectRoot)),
  };

  for (const adapter of UI_STACK_VALIDATED_ADAPTERS) {
    const dependencySpecifier = await resolveHarmonyAdapterHarDependency(
      projectRoot,
      adapter.adapterPackageName,
    );

    if (dependencySpecifier) {
      dependencies[adapter.adapterPackageName] = dependencySpecifier;
    }
  }

  parsedPackageJson.dependencies = sortRecordByKey(dependencies);
  return JSON5.stringify(parsedPackageJson, null, 2) + '\n';
}

async function readPreservedHarmonyRootDependencies(
  projectRoot: string,
): Promise<Record<string, string>> {
  const harmonyRootPackagePath = path.join(projectRoot, 'harmony', 'oh-package.json5');

  if (!(await fs.pathExists(harmonyRootPackagePath))) {
    return {};
  }

  const currentHarmonyRootPackage = JSON5.parse(
    await fs.readFile(harmonyRootPackagePath, 'utf8'),
  ) as {
    dependencies?: Record<string, unknown>;
  };
  const preservedDependencies: Record<string, string> = {};
  const validatedAdapterPackageNames = new Set<string>(UI_STACK_ADAPTER_PACKAGE_NAMES);

  for (const [packageName, specifier] of Object.entries(
    currentHarmonyRootPackage.dependencies ?? {},
  )) {
    if (typeof specifier !== 'string') {
      continue;
    }

    if (validatedAdapterPackageNames.has(packageName)) {
      continue;
    }

    preservedDependencies[packageName] = specifier;
  }

  return preservedDependencies;
}

async function resolveHarmonyAdapterHarDependency(
  projectRoot: string,
  adapterPackageName: string,
): Promise<string | null> {
  const adapterEntry = UI_STACK_VALIDATED_ADAPTERS.find(
    (candidate) => candidate.adapterPackageName === adapterPackageName,
  );

  if (!adapterEntry) {
    return null;
  }

  const adapterRoot = path.join(projectRoot, 'node_modules', ...adapterPackageName.split('/'));
  const harPath = path.join(adapterRoot, 'harmony', adapterEntry.harmonyHarFileName);

  if (!(await fs.pathExists(harPath))) {
    return null;
  }

  const relativeHarPath = path.relative(path.join(projectRoot, 'harmony'), harPath).replace(/\\/g, '/');
  return `file:${relativeHarPath}`;
}

function createEmptyAutolinkingArtifacts(
  harmonyRootPackageContents: string,
  managedAutolinkingEntries: readonly ManagedAutolinkingEntry[],
): AutolinkingArtifacts {
  return {
    ohPackageContents: harmonyRootPackageContents,
    etsFactoryContents: injectManagedAutolinkingIntoEtsFactory(
      `/*
 * This file was generated by Expo Harmony Toolkit autolinking.
 * DO NOT modify it manually, your changes WILL be overwritten.
 */
import type { RNPackageContext, RNPackage } from '@rnoh/react-native-openharmony';

export function createRNOHPackages(_ctx: RNPackageContext): RNPackage[] {
  return [];
}
`,
      managedAutolinkingEntries,
    ),
    cppFactoryContents: injectManagedAutolinkingIntoCppFactory(
      `/*
 * This file was generated by Expo Harmony Toolkit autolinking.
 * DO NOT modify it manually, your changes WILL be overwritten.
 */
#pragma once
#include "RNOH/Package.h"

std::vector<rnoh::Package::Shared> createRNOHPackages(const rnoh::Package::Context &_ctx) {
  return {};
}
`,
      managedAutolinkingEntries,
    ),
    cmakeContents: injectManagedAutolinkingIntoCmake(
      `# This file was generated by Expo Harmony Toolkit autolinking.
# DO NOT modify it manually, your changes WILL be overwritten.
cmake_minimum_required(VERSION 3.5)

function(autolink_libraries target)
  set(AUTOLINKED_LIBRARIES
  )

  foreach(lib \${AUTOLINKED_LIBRARIES})
    target_link_libraries(\${target} PUBLIC \${lib})
  endforeach()
endfunction()
`,
      managedAutolinkingEntries,
    ),
  };
}

function resolveProjectPackageJson(projectRoot: string, request: string): string | null {
  const directPackageJsonPath = path.join(projectRoot, 'node_modules', ...request.split('/'), 'package.json');

  if (fs.existsSync(directPackageJsonPath)) {
    return directPackageJsonPath;
  }

  try {
    return require.resolve(path.join(request, 'package.json'), {
      paths: [projectRoot],
    });
  } catch {
    return null;
  }
}

function sortRecordByKey(record: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
