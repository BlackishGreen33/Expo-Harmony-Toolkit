import fs from 'fs-extra';
import path from 'path';
import semver from 'semver';

interface NormalizeKnownJavaScriptDependenciesOptions {
  restoreOnCompletion?: boolean;
}

const REANIMATED_CREATE_ANIMATED_COMPONENT_RELATIVE_PATHS = [
  path.join(
    'src',
    'createAnimatedComponent',
    'createAnimatedComponent.tsx',
  ),
  path.join(
    'lib',
    'module',
    'createAnimatedComponent',
    'createAnimatedComponent.js',
  ),
];

export async function normalizeKnownJavaScriptDependencies(
  projectRoot: string,
  packageJson: Record<string, unknown>,
  options: NormalizeKnownJavaScriptDependenciesOptions = {},
): Promise<() => Promise<void>> {
  if (!isReact19OrNewer(packageJson)) {
    return async () => {};
  }

  const shouldRestore = options.restoreOnCompletion === true;
  const originalContents = new Map<string, string>();

  const packageNames = new Map(
    ['react-native-reanimated', 'react-native-gesture-handler'].map((name) => [name, new Set([name])]),
  );
  for (const sectionName of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const section = packageJson[sectionName];
    if (!section || typeof section !== 'object' || Array.isArray(section)) continue;
    for (const [name, version] of Object.entries(section)) {
      if (typeof version !== 'string' || !/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(name)) continue;
      for (const [canonicalName, names] of packageNames) {
        if (version.startsWith(`npm:${canonicalName}@`)) names.add(name);
      }
    }
  }

  for (const relativePath of [...packageNames.get('react-native-reanimated')!].flatMap((name) =>
    REANIMATED_CREATE_ANIMATED_COMPONENT_RELATIVE_PATHS.map((file) =>
      path.join('node_modules', name, file),
    ),
  )) {
    const filePath = path.join(projectRoot, relativePath);

    if (!(await fs.pathExists(filePath))) {
      continue;
    }

    const currentContents = await fs.readFile(filePath, 'utf8');
    let nextContents = patchReanimatedCreateAnimatedComponentInvariant(currentContents);
    if (shouldRestore) {
      // New Fabric public instances renamed these fields; keep older host objects working too.
      nextContents = nextContents
        .replace('viewTag = hostInstance?._nativeTag;', 'viewTag = hostInstance?.__nativeTag ?? hostInstance?._nativeTag;')
        .replace('viewName = hostInstance?.viewConfig?.uiViewClassName;', 'viewName = (hostInstance?.__viewConfig ?? hostInstance?.viewConfig)?.uiViewClassName;')
        .replace('viewConfig = hostInstance?.viewConfig;', 'viewConfig = hostInstance?.__viewConfig ?? hostInstance?.viewConfig;');
    }

    if (nextContents === currentContents) {
      continue;
    }

    if (shouldRestore) {
      originalContents.set(filePath, currentContents);
    }

    await fs.writeFile(filePath, nextContents);
  }

  if (!shouldRestore) {
    return async () => {};
  }

  for (const [canonicalName, relativePath] of [
    ['react-native-reanimated', 'src/reanimated2/fabricUtils.ts'],
    ['react-native-gesture-handler', 'src/getShadowNodeFromRef.ts'],
  ]) {
    for (const name of packageNames.get(canonicalName)!) {
      const filePath = path.join(projectRoot, 'node_modules', name, relativePath);
      if (!(await fs.pathExists(filePath))) continue;
      const contents = await fs.readFile(filePath, 'utf8');
      const patched = contents.replace(
        /return findHostInstance_DEPRECATED\(ref\)\._internalInstanceHandle\.stateNode\s*\.node;/,
        "return require('react-native/Libraries/ReactPrivate/ReactNativePrivateInterface').getInternalInstanceHandleFromPublicInstance(findHostInstance_DEPRECATED(ref)).stateNode.node;",
      );
      if (patched !== contents) {
        originalContents.set(filePath, contents);
        await fs.writeFile(filePath, patched);
      }
    }
  }

  // RN 0.82's Fabric shim is ESM; legacy Reanimated/RNGH consumers use a named CommonJS lookup.
  // Keep the default export and the real renderer implementation, rather than replacing host lookup.
  const fabricPath = path.join(projectRoot, 'node_modules/@react-native-oh/react-native-harmony/Libraries/Renderer/shims/ReactFabric.js');
  if (await fs.pathExists(fabricPath)) {
    const contents = await fs.readFile(fabricPath, 'utf8');
    if (!contents.includes('export const findHostInstance_DEPRECATED')) {
      const patched = contents.replace(
        'export default ReactFabric;',
        'export const findHostInstance_DEPRECATED = ReactFabric.findHostInstance_DEPRECATED;\nexport default ReactFabric;',
      );
      if (patched !== contents) {
        originalContents.set(fabricPath, contents);
        await fs.writeFile(fabricPath, patched);
      }
    }
  }

  for (const name of packageNames.get('react-native-gesture-handler')!) {
    const detectorPath = path.join(projectRoot, 'node_modules', name, 'src/handlers/gestures/GestureDetector.tsx');
    if (!(await fs.pathExists(detectorPath))) continue;
    const contents = await fs.readFile(detectorPath, 'utf8');
    // RNOH's adapter does not install this optional Fabric view-flattening diagnostic.
    // Keep it active on runtimes that supply it; gesture registration itself is unchanged.
    const patched = contents.replace(
      /if \(isFabric\(\)\) \{(?=\s+const node = getShadowNodeFromRef\(ref\);)/,
      "if (isFabric() && typeof global.isFormsStackingContext === 'function') {",
    );
    if (patched !== contents) {
      originalContents.set(detectorPath, contents);
      await fs.writeFile(detectorPath, patched);
    }
  }

  // Expo Router 56+ toggles optimizations absent from older native Screens.
  // Apply this only during Harmony bundling; never persist edits to native builds.
  const routerFlagsPath = path.join(projectRoot, 'node_modules/expo-router/build/screensFeatureFlags.js');
  if (await fs.pathExists(routerFlagsPath)) {
    const contents = await fs.readFile(routerFlagsPath, 'utf8');
    const patched = contents.replace(
      /(^[ \t]*)(react_native_screens_\d+\.featureFlags)\.experiment(\.\w+ = [^;\n]+;)/gm,
      '$1if ($2?.experiment) $2.experiment$3',
    );
    if (patched !== contents) {
      originalContents.set(routerFlagsPath, contents);
      await fs.writeFile(routerFlagsPath, patched);
    }
  }

  return async () => {
    for (const [filePath, contents] of originalContents) {
      await fs.writeFile(filePath, contents);
    }
  };
}

function patchReanimatedCreateAnimatedComponentInvariant(contents: string): string {
  let nextContents = contents;

  nextContents = nextContents.replace("import invariant from 'invariant';\n", '');
  nextContents = nextContents.replace("import invariant from 'invariant';\r\n", '');

  if (nextContents.includes('supports only class components')) {
    nextContents = nextContents.replace(/  invariant\([\s\S]*?\);\r?\n/m, '');
  }

  return nextContents;
}

function isReact19OrNewer(packageJson: Record<string, unknown>): boolean {
  const reactVersion = resolveDeclaredDependencyVersion(packageJson, 'react');

  if (!reactVersion) {
    return false;
  }

  const coercedVersion = semver.coerce(reactVersion);
  return !!coercedVersion && semver.gte(coercedVersion, '19.0.0');
}

function resolveDeclaredDependencyVersion(
  packageJson: Record<string, unknown>,
  packageName: string,
): string | null {
  for (const sectionName of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const section = packageJson[sectionName];
    if (!section || typeof section !== 'object' || Array.isArray(section)) {
      continue;
    }

    const version = (section as Record<string, unknown>)[packageName];
    if (typeof version === 'string' && version.length > 0) {
      return version;
    }
  }

  return null;
}
