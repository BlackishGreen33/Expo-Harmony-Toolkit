const { spawnSync } = require('node:child_process');
const fs = require('fs-extra');
const os = require('os');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const GENERATED_SAMPLE_OUTPUT_PATHS = [
  'harmony',
  '.expo-harmony',
  'index.harmony.js',
  'metro.harmony.config.js',
];

async function createSampleWorkspace(sourceRoot) {
  const tempBase = await fs.mkdtemp(path.join(os.tmpdir(), 'expo-harmony-sample-'));
  const workspaceRoot = path.join(tempBase, 'project');

  await materializeSampleWorkspace(sourceRoot, workspaceRoot);

  return workspaceRoot;
}

async function removeSampleWorkspace(workspaceRoot) {
  await fs.remove(path.dirname(workspaceRoot));
}

async function materializeSampleWorkspace(sourceRoot, targetRoot) {
  const importerPath = path.relative(repoRoot, sourceRoot).split(path.sep).join('/');

  if (!importerPath || importerPath.startsWith('..')) {
    throw new Error(`Sample source ${sourceRoot} is not inside the repository workspace.`);
  }

  await fs.ensureDir(path.dirname(targetRoot));
  await fs.copy(sourceRoot, targetRoot, {
    dereference: false,
    filter: (currentPath) => path.basename(currentPath) !== 'node_modules',
  });
  await synchronizePackageManagerConfig(targetRoot);
  await fs.writeFile(
    path.join(targetRoot, 'pnpm-lock.yaml'),
    isolateImporterLockfile(await fs.readFile(path.join(repoRoot, 'pnpm-lock.yaml'), 'utf8'), importerPath),
  );
  await removeGeneratedSampleOutputs(targetRoot);
  runPnpmInstall(targetRoot);
  await removeGeneratedSampleOutputs(targetRoot);
}

async function removeGeneratedSampleOutputs(projectRoot) {
  await Promise.all(
    GENERATED_SAMPLE_OUTPUT_PATHS.map((relativePath) => fs.remove(path.join(projectRoot, relativePath))),
  );
}

async function synchronizePackageManagerConfig(targetRoot) {
  const rootPackageJson = await fs.readJson(path.join(repoRoot, 'package.json'));
  const samplePackageJsonPath = path.join(targetRoot, 'package.json');
  const samplePackageJson = await fs.readJson(samplePackageJsonPath);
  const rootPnpmConfig = rootPackageJson.pnpm;
  const rootPackageManager = rootPackageJson.packageManager;

  if (!rootPnpmConfig && !rootPackageManager) {
    return;
  }

  await fs.writeJson(
    samplePackageJsonPath,
    {
      ...samplePackageJson,
      ...(rootPackageManager ? { packageManager: rootPackageManager } : {}),
      ...(rootPnpmConfig
        ? {
            pnpm: {
              ...(samplePackageJson.pnpm ?? {}),
              ...rootPnpmConfig,
            },
          }
        : {}),
    },
    { spaces: 2 },
  );
}

function isolateImporterLockfile(lockfileContents, importerPath) {
  const lines = lockfileContents.split('\n');
  const importersIndex = lines.findIndex((line) => line === 'importers:');

  if (importersIndex === -1) {
    throw new Error('Unable to find importers section in pnpm-lock.yaml.');
  }

  const importerHeader = `  ${importerPath}:`;
  const importerIndex = lines.findIndex((line, index) => index > importersIndex && line === importerHeader);

  if (importerIndex === -1) {
    throw new Error(`Unable to find importer ${importerPath} in pnpm-lock.yaml.`);
  }

  const nextTopLevelSectionIndex = lines.findIndex(
    (line, index) => index > importersIndex && /^[A-Za-z][^:]*:$/.test(line),
  );

  if (nextTopLevelSectionIndex === -1) {
    throw new Error('Unable to find the end of the importers section in pnpm-lock.yaml.');
  }

  const importerEndIndex = lines.findIndex(
    (line, index) => index > importerIndex && index < nextTopLevelSectionIndex && /^  \S.*:$/.test(line),
  );
  const isolatedImporterLines = lines.slice(
    importerIndex,
    importerEndIndex === -1 ? nextTopLevelSectionIndex : importerEndIndex,
  );
  const rewrittenLines = [
    ...lines.slice(0, importersIndex + 1),
    '',
    '  .:',
    ...isolatedImporterLines.slice(1),
    '',
    ...lines.slice(nextTopLevelSectionIndex),
  ];

  return `${rewrittenLines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
}

function runPnpmInstall(targetRoot) {
  const result = spawnSync('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'], {
    cwd: targetRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      CI: '1',
    },
    maxBuffer: 20 * 1024 * 1024,
    shell: false,
  });

  if (result.status !== 0) {
    const lines = [`Failed to install isolated sample workspace at ${targetRoot}.`];

    if (result.stdout) {
      lines.push(`stdout:\n${result.stdout.trim()}`);
    }

    if (result.stderr) {
      lines.push(`stderr:\n${result.stderr.trim()}`);
    }

    throw new Error(lines.join('\n\n'));
  }

  const combinedOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;

  if (combinedOutput.includes('Issues with peer dependencies found')) {
    throw new Error(
      [
        `Unexpected peer dependency warnings while installing isolated sample workspace at ${targetRoot}.`,
        combinedOutput.trim(),
      ]
        .filter(Boolean)
        .join('\n\n'),
    );
  }
}

module.exports = {
  GENERATED_SAMPLE_OUTPUT_PATHS,
  createSampleWorkspace,
  isolateImporterLockfile,
  materializeSampleWorkspace,
  removeGeneratedSampleOutputs,
  removeSampleWorkspace,
};
