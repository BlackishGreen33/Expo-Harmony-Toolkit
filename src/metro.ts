import { createRequire } from 'node:module';
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

  return (context: ResolverContext, moduleName: string, platform: string | null): unknown | null => {
    if (platform !== 'harmony') return null;

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
