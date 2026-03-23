import path from 'path';
import { buildDoctorReport, renderDoctorReport, writeDoctorReport } from '../core/report';

export interface DoctorCommandOptions {
  projectRoot?: string;
  json?: boolean;
  output?: string;
}

export async function runDoctorCommand(options: DoctorCommandOptions): Promise<void> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const report = await buildDoctorReport(projectRoot);

  if (options.output) {
    await writeDoctorReport(projectRoot, report, path.resolve(options.output));
  }

  if (options.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    return;
  }

  process.stdout.write(renderDoctorReport(report) + '\n');
}
