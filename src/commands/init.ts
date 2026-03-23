import path from 'path';
import { initProject } from '../core/template';
import { renderDoctorReport } from '../core/report';

export interface InitCommandOptions {
  projectRoot?: string;
  force?: boolean;
}

export async function runInitCommand(options: InitCommandOptions): Promise<void> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const result = await initProject(projectRoot, Boolean(options.force));

  const lines = [
    renderDoctorReport(result.report),
    '',
    `Scaffold result:`,
    `- written: ${result.sync.writtenFiles.length}`,
    `- unchanged: ${result.sync.unchangedFiles.length}`,
    `- skipped: ${result.sync.skippedFiles.length}`,
    `- doctor report: ${result.doctorReportPath}`,
  ];

  if (result.sync.warnings.length > 0 || result.packageWarnings.length > 0) {
    lines.push('', 'Warnings:');
    for (const warning of [...result.sync.warnings, ...result.packageWarnings]) {
      lines.push(`- ${warning}`);
    }
  }

  process.stdout.write(lines.join('\n') + '\n');
}
