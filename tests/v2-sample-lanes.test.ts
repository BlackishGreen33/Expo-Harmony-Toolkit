import fs from 'fs-extra';
import path from 'node:path';
import { CAPABILITY_DEFINITIONS } from '../src/data/capabilities';
import { V2_PACKAGING_CATALOG } from '../src/data/v2Packaging';
import { CoverageProfile, DoctorTargetTier, EligibilityStatus } from '../src/types';

const { GENERATED_SAMPLE_OUTPUT_PATHS } = require('../scripts/sample-workspace.js') as {
  GENERATED_SAMPLE_OUTPUT_PATHS: readonly string[];
};

interface V2SampleProject {
  readonly id: string;
  readonly root: string;
  readonly entry: string;
  readonly targetTier: DoctorTargetTier;
  readonly expectedCoverageProfile: CoverageProfile;
  readonly expectedEligibility: EligibilityStatus;
  readonly marker: string;
  readonly capabilityRoutePrefix?: string;
  readonly capabilityRouteDirectory?: string;
  readonly capabilityRouteFiles?: Readonly<Record<string, string>>;
}

interface V2SampleLaneGroup {
  readonly id: string;
  readonly projects: readonly V2SampleProject[];
}

const {
  V2_SAMPLE_LANE_GROUPS,
  V2_SAMPLE_PROJECTS,
} = require('../scripts/v2-sample-lanes.js') as {
  V2_SAMPLE_LANE_GROUPS: readonly V2SampleLaneGroup[];
  V2_SAMPLE_PROJECTS: readonly V2SampleProject[];
};

const repoRoot = path.join(__dirname, '..');
const expectedGroupIds = [
  'managed-verified',
  'preview-foundation',
  'bare',
  'wave-a',
  'wave-b',
];
const exceptionByPackage = new Map<string, (typeof V2_PACKAGING_CATALOG.exceptions)[number]>(
  V2_PACKAGING_CATALOG.exceptions.flatMap((exception) =>
    exception.packageNames.map((packageName) => [packageName, exception] as const),
  ),
);

function resolveRouteProject(sampleRoute: string): V2SampleProject {
  const mappedProjects = V2_SAMPLE_PROJECTS.filter(
    (candidate) => candidate.capabilityRouteFiles?.[sampleRoute],
  );
  if (mappedProjects.length > 1) {
    throw new Error(`Multiple v2 sample projects own capability route ${sampleRoute}.`);
  }
  if (mappedProjects[0]) {
    return mappedProjects[0];
  }

  const project = [...V2_SAMPLE_PROJECTS]
    .filter(
      (candidate) =>
        candidate.capabilityRoutePrefix && sampleRoute.startsWith(candidate.capabilityRoutePrefix),
    )
    .sort(
      (left, right) =>
        (right.capabilityRoutePrefix?.length ?? 0) -
        (left.capabilityRoutePrefix?.length ?? 0),
    )[0];

  if (!project) {
    throw new Error(`No v2 sample project owns capability route ${sampleRoute}.`);
  }

  return project;
}

function resolveRouteFile(project: V2SampleProject, sampleRoute: string): string {
  const mappedRouteFile = project.capabilityRouteFiles?.[sampleRoute];
  if (mappedRouteFile) {
    return path.join(repoRoot, project.root, mappedRouteFile);
  }

  const prefix = project.capabilityRoutePrefix ?? '';
  const relativeRoute = sampleRoute.slice(prefix.length).replace(/^\//, '');
  return path.join(
    repoRoot,
    project.root,
    project.capabilityRouteDirectory ?? 'app',
    `${relativeRoute}.tsx`,
  );
}

async function collectReachableSources(
  projectRoot: string,
  pendingFiles: readonly string[],
  visitedFiles: readonly string[] = [],
  sources: readonly string[] = [],
): Promise<readonly string[]> {
  const [sourcePath, ...remainingFiles] = pendingFiles;
  if (!sourcePath) {
    return sources;
  }

  if (visitedFiles.includes(sourcePath)) {
    return collectReachableSources(projectRoot, remainingFiles, visitedFiles, sources);
  }

  const source = await fs.readFile(sourcePath, 'utf8');
  const importPattern = /\bimport\s+(?:[^'\"]+\s+from\s+)?['\"](\.[^'\"]+)['\"]/g;
  const importedFiles = Array.from(source.matchAll(importPattern)).flatMap((match) => {
    const importBase = path.resolve(path.dirname(sourcePath), match[1]);
    const candidates = [
      importBase,
      `${importBase}.js`,
      `${importBase}.jsx`,
      `${importBase}.ts`,
      `${importBase}.tsx`,
      path.join(importBase, 'index.js'),
      path.join(importBase, 'index.ts'),
      path.join(importBase, 'index.tsx'),
    ];
    const importedFile = candidates.find(
      (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
    );

    return importedFile?.startsWith(projectRoot) ? [importedFile] : [];
  });

  return collectReachableSources(
    projectRoot,
    [...remainingFiles, ...importedFiles],
    [...visitedFiles, sourcePath],
    [...sources, source],
  );
}

async function readEntryReachabilitySource(project: V2SampleProject): Promise<string> {
  const projectRoot = path.join(repoRoot, project.root);
  const entryPath = path.join(projectRoot, project.entry);
  const reachableSource = (await collectReachableSources(projectRoot, [entryPath])).join('\n');

  if (
    reachableSource.includes("'expo-router/entry'") ||
    reachableSource.includes('"expo-router/entry"')
  ) {
    const routerIndexSource = await fs.readFile(path.join(projectRoot, 'app', 'index.tsx'), 'utf8');
    return `${reachableSource}\n${routerIndexSource}`;
  }

  return reachableSource;
}

describe('v2 sample lane manifest', () => {
  it('defines exactly five groups and seven physical projects', () => {
    expect(V2_SAMPLE_LANE_GROUPS.map((group) => group.id)).toEqual(expectedGroupIds);
    expect(V2_SAMPLE_LANE_GROUPS.map((group) => group.projects.length)).toEqual([3, 1, 1, 1, 1]);
    expect(V2_SAMPLE_PROJECTS).toEqual(V2_SAMPLE_LANE_GROUPS.flatMap((group) => group.projects));
    expect(V2_SAMPLE_PROJECTS).toHaveLength(7);
  });

  it('keeps project roots, package files, entries, profiles, dispositions, and markers explicit and unique', async () => {
    const roots = V2_SAMPLE_PROJECTS.map((project) => project.root);
    const markers = V2_SAMPLE_PROJECTS.map((project) => project.marker);

    expect(new Set(roots).size).toBe(roots.length);
    expect(new Set(markers).size).toBe(markers.length);

    for (const project of V2_SAMPLE_PROJECTS) {
      const projectRoot = path.join(repoRoot, project.root);
      const packageJsonPath = path.join(projectRoot, 'package.json');
      const entryPath = path.join(projectRoot, project.entry);

      expect(project.root).toMatch(/^examples\/official-[a-z-]+-sample$/);
      expect(await fs.pathExists(packageJsonPath)).toBe(true);
      expect(await fs.pathExists(entryPath)).toBe(true);
      expect(['managed-core', 'managed-native-heavy', 'bare', 'third-party-native-heavy']).toContain(
        project.expectedCoverageProfile,
      );
      expect(['verified', 'preview', 'experimental']).toContain(project.targetTier);
      expect(project.expectedEligibility).toBe('eligible');
      expect(project.marker).toBe(`EXPO_HARMONY_V2_SAMPLE:${project.id}`);
      expect(await readEntryReachabilitySource(project)).toContain(project.marker);
    }
  });

  it('keeps all source samples free of generated toolkit outputs', async () => {
    for (const project of V2_SAMPLE_PROJECTS) {
      const projectRoot = path.join(repoRoot, project.root);

      for (const generatedPath of GENERATED_SAMPLE_OUTPUT_PATHS) {
        expect(await fs.pathExists(path.join(projectRoot, generatedPath))).toBe(false);
      }
    }
  });
});

describe('v2 capability sample routes', () => {
  it('keeps the public gesture-handler route owned by the Wave A sample', () => {
    const definition = CAPABILITY_DEFINITIONS.find(
      (candidate) => candidate.id === 'react-native-gesture-handler',
    );

    expect(definition?.sampleRoute).toBe('/gesture-handler');
    if (!definition) {
      throw new Error('Missing react-native-gesture-handler capability definition.');
    }

    const project = resolveRouteProject(definition.sampleRoute);
    expect(project.id).toBe('official-wave-a');
    expect(
      path.relative(repoRoot, resolveRouteFile(project, definition.sampleRoute)).replace(/\\/g, '/'),
    ).toBe('examples/official-wave-a-sample/app/third-party-wave-a/gesture-handler.tsx');
  });

  it('renders a canonical Harmony gesture button probe without claiming callback success', async () => {
    const definition = CAPABILITY_DEFINITIONS.find(
      (candidate) => candidate.id === 'react-native-gesture-handler',
    );
    if (!definition) {
      throw new Error('Missing react-native-gesture-handler capability definition.');
    }

    const project = resolveRouteProject(definition.sampleRoute);
    const routeSource = await fs.readFile(resolveRouteFile(project, definition.sampleRoute), 'utf8');

    expect(routeSource).toContain(
      "import { GestureHandlerRootView, RectButton } from 'react-native-gesture-handler';",
    );
    expect(routeSource).toContain('const [gestureCount, setGestureCount] = useState(0);');
    expect(routeSource).toContain('const handlePress = () => {');
    expect(routeSource).toContain('<RectButton');
    expect(routeSource).toContain('onPress={handlePress}');
    expect(routeSource).toContain('setGestureCount((count) => count + 1);');
    expect(routeSource).toContain('Run tap gesture');
    expect(routeSource).toContain('Gesture callback count={gestureCount}');
    expect(routeSource).toContain(
      'Canonical RectButton adapter probe; simulator callback evidence is blocked and device semantics are deferred.',
    );
    expect(routeSource).not.toContain('is handled by the installed Harmony adapter');
    expect(routeSource).not.toContain('Gesture.Tap');
    expect(routeSource).not.toContain('GestureDetector');
    expect(routeSource).not.toContain('TapGestureHandler');
    expect(routeSource).not.toContain('State.END');
    expect(routeSource).not.toContain('onHandlerStateChange');
    expect(routeSource).not.toContain('.runOnJS(');
  });

  it('maps all 19 capability definitions to real route files owned by a sample entry', async () => {
    expect(CAPABILITY_DEFINITIONS).toHaveLength(19);

    for (const definition of CAPABILITY_DEFINITIONS) {
      const project = resolveRouteProject(definition.sampleRoute);
      const routeFile = resolveRouteFile(project, definition.sampleRoute);
      const routeSource = await fs.readFile(routeFile, 'utf8');
      const entryReachabilitySource = await readEntryReachabilitySource(project);

      expect(await fs.pathExists(routeFile)).toBe(true);
      if (entryReachabilitySource.includes('expo-router/entry')) {
        expect(entryReachabilitySource).toContain(definition.sampleRoute);
      } else {
        const relativeImport = `./${path
          .relative(path.dirname(path.join(repoRoot, project.root, project.entry)), routeFile)
          .replace(/\\/g, '/')
          .replace(/\.tsx$/, '')}`;
        expect(entryReachabilitySource).toContain(relativeImport);
      }
      expect(routeSource).toContain(`EXPO_HARMONY_V2_ROUTE:${definition.id}`);
    }
  });

  it('static-imports every covered canonical package from its route', async () => {
    for (const definition of CAPABILITY_DEFINITIONS) {
      if (exceptionByPackage.has(definition.packageName)) {
        continue;
      }

      const project = resolveRouteProject(definition.sampleRoute);
      const routeSource = await fs.readFile(resolveRouteFile(project, definition.sampleRoute), 'utf8');
      const staticImport = new RegExp(
        `(?:from\\s+|import\\s*)['\"]${definition.packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['\"]`,
      );

      expect(routeSource).toMatch(staticImport);
    }
  });

  it('keeps screens, push, and Skia routes on their exact exception fallback only', async () => {
    for (const definition of CAPABILITY_DEFINITIONS) {
      const exception = exceptionByPackage.get(definition.packageName);
      if (!exception) {
        continue;
      }

      const project = resolveRouteProject(definition.sampleRoute);
      const routeSource = await fs.readFile(resolveRouteFile(project, definition.sampleRoute), 'utf8');

      expect(routeSource).toContain(exception.fallback);
      if (exception.id === 'screens') {
        expect(routeSource).toContain("import { enableScreens } from 'react-native-screens';");
        expect(routeSource.match(/^\s*enableScreens\(false\);$/gm)).toHaveLength(1);
        expect(routeSource).not.toContain("'@react-native-oh-tpl/react-native-screens'");
      } else {
        for (const packageName of exception.packageNames) {
          const escapedPackageName = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          expect(routeSource).not.toMatch(
            new RegExp(
              `(?:from\\s+|import\\s*(?:\\(\\s*)?|require\\s*\\(\\s*)['\"]${escapedPackageName}['\"]`,
            ),
          );
        }
      }
    }
  });
});
