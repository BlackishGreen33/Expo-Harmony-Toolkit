import { execFile } from 'node:child_process';
import path from 'path';
import { promisify } from 'node:util';
import { buildEnvReport } from '../env';

const execFileAsync = promisify(execFile);

export interface CommandRunnerResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (
  file: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
  },
) => Promise<CommandRunnerResult>;

export function buildInvocation(file: string, args: string[]): { file: string; args: string[] } {
  if (file.endsWith('.js')) {
    return {
      file: process.execPath,
      args: [file, ...args],
    };
  }

  return {
    file,
    args,
  };
}

export function createHarmonyBuildEnvironment(
  runtimeEnv: NodeJS.ProcessEnv,
  envReport: Awaited<ReturnType<typeof buildEnvReport>>,
): NodeJS.ProcessEnv {
  const buildEnvironment: NodeJS.ProcessEnv = {
    ...runtimeEnv,
  };

  if (envReport.sdkRoot) {
    buildEnvironment.DEVECO_SDK_HOME = envReport.sdkRoot;
    buildEnvironment.OHOS_BASE_SDK_HOME = envReport.sdkRoot;
  }

  if (envReport.devecoStudioPath) {
    buildEnvironment.NODE_HOME =
      buildEnvironment.NODE_HOME ??
      path.join(envReport.devecoStudioPath, 'Contents', 'tools', 'node');
  }

  return buildEnvironment;
}

export async function defaultCommandRunner(
  file: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
  },
): Promise<CommandRunnerResult> {
  try {
    const result = await execFileAsync(file, args, {
      cwd: options.cwd,
      env: options.env,
      maxBuffer: 20 * 1024 * 1024,
    });

    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    const failed = error as NodeJS.ErrnoException & {
      code?: number | string;
      stdout?: string;
      stderr?: string;
    };

    return {
      exitCode: typeof failed.code === 'number' ? failed.code : 1,
      stdout: failed.stdout ?? '',
      stderr: failed.stderr ?? failed.message ?? '',
    };
  }
}
