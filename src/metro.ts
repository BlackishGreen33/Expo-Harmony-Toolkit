import { createRequire } from 'node:module';
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import semver from 'semver';

type ResolverContext = {
  originModulePath: string;
  resolveRequest: (context: ResolverContext, moduleName: string, platform: string | null) => unknown;
};

/** Pair an app's Harmony-only npm aliases with their native adapter overlays. */
export function createHarmonyPackageResolver(
  projectRoot: string,
  packages: Record<string, { source: string; adapter: string }>,
) {
  const projectRequire = createRequire(path.join(projectRoot, 'package.json'));
  const entries = Object.entries(packages).map(([name, { source, adapter }]) => {
    const sourceManifest = projectRequire.resolve(`${source}/package.json`);
    const adapterManifest = projectRequire.resolve(`${adapter}/package.json`);
    const sourcePackage = projectRequire(sourceManifest);
    const adapterPackage = projectRequire(adapterManifest);
    if (sourcePackage.name !== name || adapterPackage.harmony?.alias !== name) {
      throw new Error(`Harmony package mapping for ${name} must pair its original JS package with its adapter.`);
    }
    const peerVersion = adapterPackage.peerDependencies?.[name];
    if (typeof peerVersion === 'string' && !semver.satisfies(sourcePackage.version, peerVersion)) {
      throw new Error(`${adapter} requires ${name}@${peerVersion}; ${source} provides ${sourcePackage.version}.`);
    }
    return {
      name,
      sourceRoot: path.dirname(sourceManifest),
      adapterRoot: path.dirname(adapterManifest),
      redirectInternalImports: adapterPackage.harmony?.redirectInternalImports === true,
    };
  });
  const screens = entries.find((entry) => entry.name === 'react-native-screens');
  const routerManifest = path.join(projectRoot, 'node_modules/expo-router/package.json');
  const legacyScreensRouterRoot = screens &&
    !existsSync(path.join(screens.sourceRoot, 'experimental')) && existsSync(routerManifest)
    ? path.dirname(realpathSync(routerManifest)) : null;

  return (context: ResolverContext, moduleName: string, platform: string | null): unknown | null => {
    if (platform !== 'harmony') return null;

    // Router 56+ eagerly imports its experimental stack. Reuse its standard-Stack
    // fallback when the pinned Harmony Screens release has no experimental native API.
    if (legacyScreensRouterRoot && moduleName === './layouts/experimental-stack' &&
      context.originModulePath === path.join(legacyScreensRouterRoot, 'build/exports.js')) {
      const fallback = path.join(legacyScreensRouterRoot, 'build/layouts/experimental-stack/index.web.js');
      if (existsSync(fallback)) return context.resolveRequest(context, fallback, platform);
    }

    for (const entry of entries) {
      let relativePath: string;
      if (moduleName === entry.name || moduleName.startsWith(`${entry.name}/`)) {
        relativePath = moduleName.slice(entry.name.length).replace(/^\//, '');
      } else if (
        moduleName.startsWith('.') &&
        context.originModulePath.startsWith(entry.sourceRoot + path.sep)
      ) {
        relativePath = path.relative(
          entry.sourceRoot,
          path.resolve(path.dirname(context.originModulePath), moduleName),
        );
        if (!entry.redirectInternalImports || relativePath.startsWith('..')) return null;
      } else {
        continue;
      }

      // Adapter files import the original package for shared implementation.
      // Resolve those imports to the pinned JS source, avoiding adapter recursion.
      if (!context.originModulePath.startsWith(entry.adapterRoot + path.sep)) {
        try {
          return context.resolveRequest(context, path.join(entry.adapterRoot, relativePath), platform);
        } catch {
          // Adapters ship partial overlays; unchanged modules come from the matching JS release.
        }
      }
      return context.resolveRequest(context, path.join(entry.sourceRoot, relativePath), platform);
    }
    return null;
  };
}
