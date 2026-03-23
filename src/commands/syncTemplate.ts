import path from 'path';
import { syncProjectTemplate } from '../core/template';

export interface SyncTemplateCommandOptions {
  projectRoot?: string;
  force?: boolean;
}

export async function runSyncTemplateCommand(options: SyncTemplateCommandOptions): Promise<void> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const result = await syncProjectTemplate(projectRoot, Boolean(options.force));
  const lines = [
    `Template sync completed for ${projectRoot}`,
    `- written: ${result.writtenFiles.length}`,
    `- unchanged: ${result.unchangedFiles.length}`,
    `- skipped: ${result.skippedFiles.length}`,
    `- manifest: ${result.manifestPath}`,
  ];

  if (result.warnings.length > 0) {
    lines.push('', 'Warnings:', ...result.warnings.map((warning) => `- ${warning}`));
  }

  process.stdout.write(lines.join('\n') + '\n');
}
