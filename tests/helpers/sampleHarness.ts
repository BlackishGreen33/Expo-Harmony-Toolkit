import { execFile, ExecFileException } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import path from 'path';
import { promisify } from 'node:util';
import { getBuildReportPath } from '../../src/core/metadata';

const execFileAsync = promisify(execFile);
const repoRoot = path.join(__dirname, '..', '..');
const cliEntryPath = path.join(repoRoot, 'bin', 'expo-harmony.js');
const {
  createSampleWorkspace: createIsolatedSampleWorkspace,
  removeSampleWorkspace: removeIsolatedSampleWorkspace,
} = require('../../scripts/sample-workspace.js') as {
  createSampleWorkspace: (sourceRoot: string) => Promise<string>;
  removeSampleWorkspace: (workspaceRoot: string) => Promise<void>;
};

export async function createSampleWorkspace(sourceRoot: string): Promise<string> {
  const packageJson = (await fs.readJson(path.join(sourceRoot, 'package.json'))) as { name?: string };
  if (!packageJson.name) {
    throw new Error(`Sample package at ${sourceRoot} is missing package.json name.`);
  }

  return createIsolatedSampleWorkspace(sourceRoot);
}

export async function removeSampleWorkspace(workspaceRoot: string): Promise<void> {
  await removeIsolatedSampleWorkspace(workspaceRoot);
}

export async function snapshotSampleSource(sampleRoot: string): Promise<string> {
  const files = await collectSnapshotFiles(sampleRoot);
  const hash = crypto.createHash('sha1');

  for (const relativePath of files) {
    const absolutePath = path.join(sampleRoot, relativePath);
    const fileStat = await fs.lstat(absolutePath);
    hash.update(relativePath);
    hash.update('\0');

    if (fileStat.isSymbolicLink()) {
      hash.update(`link:${await fs.readlink(absolutePath)}`);
      hash.update('\0');
      continue;
    }

    hash.update(await fs.readFile(absolutePath));
    hash.update('\0');
  }

  return hash.digest('hex');
}

export async function runToolkitCommand(
  projectRoot: string,
  args: string[],
  options: { includeBuildReport?: boolean } = {},
): Promise<void> {
  try {
    await execFileAsync(process.execPath, [cliEntryPath, ...args], {
      cwd: projectRoot,
      env: {
        ...process.env,
        CI: '1',
      },
    });
  } catch (error) {
    const execError = error as ExecFileException & {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
    };
    const stdout = stringifyCommandOutput(execError.stdout);
    const stderr = stringifyCommandOutput(execError.stderr);
    const lines = [
      `Command failed: node ${cliEntryPath} ${args.join(' ')}`,
      `cwd: ${projectRoot}`,
    ];

    if (stdout) {
      lines.push(`stdout:\n${stdout}`);
    }

    if (stderr) {
      lines.push(`stderr:\n${stderr}`);
    }

    if (options.includeBuildReport !== false) {
      const buildReportPath = getBuildReportPath(projectRoot);

      if (await fs.pathExists(buildReportPath)) {
        lines.push(`build report: ${buildReportPath}`);
        lines.push(`build report contents:\n${await fs.readFile(buildReportPath, 'utf8')}`);
      } else {
        lines.push(`build report: missing (${buildReportPath})`);
      }
    }

    throw new Error(lines.join('\n\n'));
  }
}

async function collectSnapshotFiles(root: string): Promise<string[]> {
  const entries = await fs.readdir(root);
  const files: string[] = [];

  for (const entry of entries.sort((left, right) => left.localeCompare(right))) {
    if (entry === 'node_modules') {
      continue;
    }

    const absolutePath = path.join(root, entry);
    const relativePath = entry;
    const fileStat = await fs.lstat(absolutePath);

    if (fileStat.isDirectory()) {
      const nestedFiles = await collectSnapshotFiles(absolutePath);
      files.push(...nestedFiles.map((nestedFile) => path.join(relativePath, nestedFile)));
      continue;
    }

    files.push(relativePath);
  }

  return files;
}

function stringifyCommandOutput(output: string | Buffer | undefined): string {
  if (!output) {
    return '';
  }

  return String(output).trim();
}
