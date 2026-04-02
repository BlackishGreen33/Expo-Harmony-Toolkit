import fs from 'fs-extra';
import path from 'path';
import { UI_STACK_VALIDATED_ADAPTERS, getUiStackAdapterSpecifier } from '../src/data/uiStack';

const repoRoot = path.join(__dirname, '..');
const readmeZhPath = path.join(repoRoot, 'README.md');
const readmeEnPath = path.join(repoRoot, 'README.en.md');
const licensePath = path.join(repoRoot, 'LICENSE');
const packageJsonPath = path.join(repoRoot, 'package.json');
const supportMatrixPath = path.join(repoRoot, 'docs', 'support-matrix.md');
const roadmapPath = path.join(repoRoot, 'docs', 'roadmap.md');
const npmReleasePath = path.join(repoRoot, 'docs', 'npm-release.md');

function getLocalLinks(contents: string): string[] {
  const markdownMatches = contents.matchAll(/\[[^\]]+\]\((\.\/[^)]+)\)/g);
  const htmlMatches = contents.matchAll(/href="(\.\/[^"]+)"/g);

  return Array.from(
    new Set([
      ...Array.from(markdownMatches, (match) => match[1]),
      ...Array.from(htmlMatches, (match) => match[1]),
    ]),
  );
}

describe('documentation metadata', () => {
  it('ships a root MIT license file', async () => {
    expect(await fs.pathExists(licensePath)).toBe(true);
    expect(await fs.readFile(licensePath, 'utf8')).toContain('MIT License');
  });

  it('keeps the bilingual readmes cross-linked and all local links valid', async () => {
    const readmeZh = await fs.readFile(readmeZhPath, 'utf8');
    const readmeEn = await fs.readFile(readmeEnPath, 'utf8');
    const linkedFiles = [
      ...getLocalLinks(readmeZh),
      ...getLocalLinks(readmeEn),
    ];

    expect(readmeZh).toContain('href="./README.en.md"');
    expect(readmeEn).toContain('href="./README.md"');
    expect(readmeZh).toContain('expo55-rnoh082-ui-stack');
    expect(readmeEn).toContain('expo55-rnoh082-ui-stack');
    expect(readmeZh).toContain('./docs/official-ui-stack-sample.md');
    expect(readmeEn).toContain('./docs/official-ui-stack-sample.md');
    expect(readmeZh).toContain('`latest` 只承诺完整验收的 `verified` 能力');
    expect(readmeEn).toContain('`latest` only carries fully accepted `verified` capabilities');
    expect(readmeZh).toContain('`next`');
    expect(readmeEn).toContain('`next`');

    for (const link of linkedFiles) {
      const target = path.resolve(repoRoot, link);
      expect(await fs.pathExists(target)).toBe(true);
    }
  });

  it('keeps package metadata aligned with the public repository and license', async () => {
    const packageJson = await fs.readJson(packageJsonPath);

    expect(packageJson.version).toBe('1.7.0');
    expect(packageJson.license).toBe('MIT');
    expect(packageJson.repository?.url).toBe('git+https://github.com/BlackishGreen33/Expo-Harmony-Toolkit.git');
    expect(packageJson.homepage).toBe('https://github.com/BlackishGreen33/Expo-Harmony-Toolkit#readme');
    expect(packageJson.bugs?.url).toBe('https://github.com/BlackishGreen33/Expo-Harmony-Toolkit/issues');
  });

  it('documents the validated adapter specifiers in the support matrix', async () => {
    const supportMatrix = await fs.readFile(supportMatrixPath, 'utf8');

    for (const adapter of UI_STACK_VALIDATED_ADAPTERS) {
      expect(supportMatrix).toContain(adapter.adapterPackageName);
      expect(supportMatrix).toContain(getUiStackAdapterSpecifier(adapter));
    }
  });

  it('keeps roadmap and release docs aligned with stable/latest plus fast-track/next', async () => {
    const roadmap = await fs.readFile(roadmapPath, 'utf8');
    const npmRelease = await fs.readFile(npmReleasePath, 'utf8');

    expect(roadmap).toContain('2026-05-15');
    expect(roadmap).toContain('Capability Graduation + Fast Track Release');
    expect(roadmap).toContain('Managed/CNG Core Expo Coverage');
    expect(roadmap).toContain('Long-tail Native Module Extension');
    expect(npmRelease).toContain('`latest`');
    expect(npmRelease).toContain('`next`');
    expect(npmRelease).toContain('official-native-capabilities-sample');
  });
});
