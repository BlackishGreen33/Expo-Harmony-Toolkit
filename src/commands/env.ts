import path from 'path';
import { getStrictEnvExitCode, buildEnvReport, renderEnvReport } from '../core/env';
import { writeEnvReport } from '../core/metadata';

export interface EnvCommandOptions {
  strict?: boolean;
  json?: boolean;
}

export async function runEnvCommand(options: EnvCommandOptions): Promise<void> {
  const projectRoot = path.resolve(process.cwd());
  const report = await buildEnvReport(projectRoot);
  await writeEnvReport(projectRoot, report);

  if (options.strict && report.blockingIssues.length > 0) {
    process.exitCode = getStrictEnvExitCode();
  }

  if (options.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    return;
  }

  process.stdout.write(renderEnvReport(report) + '\n');
}
