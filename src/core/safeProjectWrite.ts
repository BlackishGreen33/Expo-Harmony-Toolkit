import fs from 'fs-extra';
import path from 'path';

export async function resolveProjectPathForWrite(
  projectRoot: string,
  relativePath: string,
): Promise<string> {
  if (path.isAbsolute(relativePath)) {
    throw new Error(`Project output path must be relative: ${relativePath}`);
  }

  const realProjectRoot = await fs.realpath(projectRoot);
  const targetPath = path.resolve(realProjectRoot, relativePath);

  if (!isPathInside(targetPath, realProjectRoot)) {
    throw new Error(`Project output path escapes project root: ${relativePath}`);
  }

  await assertNoSymlinkPath(realProjectRoot, targetPath, relativePath);
  return targetPath;
}

export async function writeProjectFile(
  projectRoot: string,
  relativePath: string,
  contents: string | Buffer,
): Promise<string> {
  const targetPath = await resolveProjectPathForWrite(projectRoot, relativePath);

  await fs.ensureDir(path.dirname(targetPath));
  await fs.writeFile(targetPath, contents);

  return targetPath;
}

export async function writeProjectJson(
  projectRoot: string,
  relativePath: string,
  value: unknown,
): Promise<string> {
  const targetPath = await resolveProjectPathForWrite(projectRoot, relativePath);

  await fs.ensureDir(path.dirname(targetPath));
  await fs.writeJson(targetPath, value, { spaces: 2 });

  return targetPath;
}

async function assertNoSymlinkPath(
  realProjectRoot: string,
  targetPath: string,
  displayPath: string,
): Promise<void> {
  let currentPath = realProjectRoot;
  const relativeSegments = path.relative(realProjectRoot, targetPath).split(path.sep);

  for (const segment of relativeSegments) {
    currentPath = path.join(currentPath, segment);

    try {
      const stat = await fs.lstat(currentPath);
      if (stat.isSymbolicLink()) {
        throw new Error(`Project output path contains a symlink: ${displayPath}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }

      throw error;
    }
  }
}

function isPathInside(candidatePath: string, parentPath: string): boolean {
  const relativePath = path.relative(parentPath, candidatePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}
