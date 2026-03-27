import path from 'path';
import { bundleProject, renderBuildReport } from '../core/build';
import { writeBuildReport } from '../core/metadata';

export interface BundleCommandOptions {
  projectRoot?: string;
}

export async function runBundleCommand(options: BundleCommandOptions): Promise<void> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const report = await bundleProject(projectRoot);
  await writeBuildReport(projectRoot, report);

  if (report.status === 'failed') {
    process.exitCode = 1;
  }

  process.stdout.write(renderBuildReport(report) + '\n');
}
