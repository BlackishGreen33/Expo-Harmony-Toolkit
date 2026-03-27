import path from 'path';
import { buildHapProject, renderBuildReport } from '../core/build';
import { writeBuildReport } from '../core/metadata';

export interface BuildHapCommandOptions {
  projectRoot?: string;
  mode?: 'debug' | 'release';
}

export async function runBuildHapCommand(options: BuildHapCommandOptions): Promise<void> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const mode = options.mode ?? 'debug';

  if (mode !== 'debug' && mode !== 'release') {
    process.exitCode = 1;
    process.stderr.write(`Unsupported build mode "${mode}". Expected debug or release.\n`);
    return;
  }

  const report = await buildHapProject(projectRoot, {
    mode,
  });
  await writeBuildReport(projectRoot, report);

  if (report.status === 'failed') {
    process.exitCode = 1;
  }

  process.stdout.write(renderBuildReport(report) + '\n');
}
