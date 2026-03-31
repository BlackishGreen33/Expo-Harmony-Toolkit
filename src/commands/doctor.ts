import path from 'path';
import { STRICT_DOCTOR_EXIT_CODE } from '../core/constants';
import { buildDoctorReport, renderDoctorReport, writeDoctorReport } from '../core/report';
import { DoctorTargetTier } from '../types';

export interface DoctorCommandOptions {
  projectRoot?: string;
  strict?: boolean;
  json?: boolean;
  output?: string;
  targetTier?: DoctorTargetTier | string;
}

export async function runDoctorCommand(options: DoctorCommandOptions): Promise<void> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const targetTier = resolveDoctorTargetTier(options.targetTier, Boolean(options.strict));
  const report = await buildDoctorReport(projectRoot, { targetTier });

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

function resolveDoctorTargetTier(
  targetTier: DoctorCommandOptions['targetTier'],
  strict: boolean,
): DoctorTargetTier {
  if (strict) {
    return 'verified';
  }

  if (!targetTier) {
    return 'verified';
  }

  if (targetTier === 'verified' || targetTier === 'preview' || targetTier === 'experimental') {
    return targetTier;
  }

  throw new Error(`Unsupported doctor target tier: ${targetTier}`);
}
