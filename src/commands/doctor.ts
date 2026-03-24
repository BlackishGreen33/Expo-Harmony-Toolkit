import path from 'path';
import { STRICT_DOCTOR_EXIT_CODE } from '../core/constants';
import { buildDoctorReport, renderDoctorReport, writeDoctorReport } from '../core/report';

export interface DoctorCommandOptions {
  projectRoot?: string;
  strict?: boolean;
  json?: boolean;
  output?: string;
}

export async function runDoctorCommand(options: DoctorCommandOptions): Promise<void> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const report = await buildDoctorReport(projectRoot);

  if (options.output) {
    await writeDoctorReport(projectRoot, report, path.resolve(options.output));
  }

  if (options.strict && report.eligibility === 'ineligible') {
    process.exitCode = STRICT_DOCTOR_EXIT_CODE;
  }

  if (options.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    return;
  }

  process.stdout.write(renderDoctorReport(report) + '\n');
}
