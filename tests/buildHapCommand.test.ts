import path from 'path';
import { runBuildHapCommand } from '../src/commands/buildHap';
import { buildHapProject } from '../src/core/build';
import { writeBuildReport } from '../src/core/metadata';

jest.mock('../src/core/build', () => ({
  buildHapProject: jest.fn(),
  renderBuildReport: jest.fn(() => 'rendered build report'),
}));

jest.mock('../src/core/metadata', () => ({
  writeBuildReport: jest.fn(),
}));

const mockedBuildHapProject = buildHapProject as jest.MockedFunction<typeof buildHapProject>;
const mockedWriteBuildReport = writeBuildReport as jest.MockedFunction<typeof writeBuildReport>;

describe('build-hap command', () => {
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    jest.clearAllMocks();
    process.exitCode = originalExitCode;
    mockedBuildHapProject.mockResolvedValue({
      generatedAt: '2026-06-02T00:00:00.000Z',
      projectRoot: path.resolve('.'),
      toolkitVersion: '1.9.1',
      command: 'build-hap',
      mode: 'debug',
      status: 'succeeded',
      harmonyProjectRoot: path.resolve('harmony'),
      entryFile: null,
      bundleOutputPath: null,
      assetsDestPath: null,
      artifactPaths: [],
      blockingIssues: [],
      warnings: [],
      steps: [],
    });
    mockedWriteBuildReport.mockResolvedValue(path.resolve('.expo-harmony', 'build-report.json'));
  });

  afterAll(() => {
    process.exitCode = originalExitCode;
  });

  it('passes the no-HAR-normalize flag to the build layer', async () => {
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    try {
      await runBuildHapCommand({
        projectRoot: '.',
        mode: 'debug',
        harNormalize: false,
      });
    } finally {
      stdoutSpy.mockRestore();
    }

    expect(mockedBuildHapProject).toHaveBeenCalledWith(path.resolve('.'), {
      mode: 'debug',
      skipHarNormalize: true,
    });
  });
});
