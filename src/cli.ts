import { Command } from 'commander';
import { CLI_NAME, TOOLKIT_VERSION } from './core/constants';
import { runBuildHapCommand } from './commands/buildHap';
import { runBundleCommand } from './commands/bundle';
import { runDoctorCommand } from './commands/doctor';
import { runEnvCommand } from './commands/env';
import { runInitCommand } from './commands/init';
import { runSyncTemplateCommand } from './commands/syncTemplate';

export async function run(argv = process.argv): Promise<void> {
  const program = new Command();

  program
    .name(CLI_NAME)
    .description('Validated Expo-to-Harmony toolkit for managed Expo UI-stack projects')
    .version(TOOLKIT_VERSION);

  program
    .command('env')
    .description('Inspect the local DevEco/Harmony CLI environment for bundle and HAP builds')
    .option('--strict', 'return a non-zero exit code when required local build tools are missing')
    .option('--json', 'print JSON instead of a human-readable report')
    .action(runEnvCommand);

  program
    .command('doctor')
    .description('Inspect an Expo project and classify dependencies against the Harmony migration matrix')
    .option('-p, --project-root <path>', 'path to the Expo project')
    .option('--strict', 'return a non-zero exit code when the project falls outside the validated verified matrix')
    .option('--target-tier <tier>', 'evaluate the project against verified, preview, or experimental support tiers')
    .option('--json', 'print JSON instead of a human-readable report')
    .option('-o, --output <path>', 'write the JSON report to a file')
    .action(runDoctorCommand);

  program
    .command('bundle')
    .description('Generate a Harmony JavaScript bundle with the validated Metro sidecar')
    .option('-p, --project-root <path>', 'path to the Expo project')
    .action(runBundleCommand);

  program
    .command('build-hap')
    .description('Build a Harmony HAP from the validated sidecar and bundle outputs')
    .option('-p, --project-root <path>', 'path to the Expo project')
    .option('--mode <mode>', 'build mode: debug or release', 'debug')
    .action(runBuildHapCommand);

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
