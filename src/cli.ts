import { Command } from 'commander';
import { CLI_NAME, TOOLKIT_VERSION } from './core/constants';
import { runDoctorCommand } from './commands/doctor';
import { runInitCommand } from './commands/init';
import { runSyncTemplateCommand } from './commands/syncTemplate';

export async function run(argv = process.argv): Promise<void> {
  const program = new Command();

  program
    .name(CLI_NAME)
    .description('Experimental Expo-to-Harmony migration toolkit')
    .version(TOOLKIT_VERSION);

  program
    .command('doctor')
    .description('Inspect an Expo project and classify dependencies against the Harmony migration matrix')
    .option('-p, --project-root <path>', 'path to the Expo project')
    .option('--strict', 'return a non-zero exit code when the project falls outside the validated v0.5 matrix')
    .option('--json', 'print JSON instead of a human-readable report')
    .option('-o, --output <path>', 'write the JSON report to a file')
    .action(runDoctorCommand);

  program
    .command('init')
    .description('Scaffold Harmony sidecar files, vendored template files, and package scripts')
    .option('-p, --project-root <path>', 'path to the Expo project')
    .option('-f, --force', 'overwrite drifted managed files')
    .action(runInitCommand);

  program
    .command('sync-template')
    .description('Re-apply the vendored Harmony template in an idempotent way')
    .option('-p, --project-root <path>', 'path to the Expo project')
    .option('-f, --force', 'overwrite drifted managed files')
    .action(runSyncTemplateCommand);

  await program.parseAsync(argv);
}
