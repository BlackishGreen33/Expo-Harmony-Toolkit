import fs from 'fs-extra';
import path from 'path';

const repoRoot = path.join(__dirname, '..');
const readmeZhPath = path.join(repoRoot, 'README.md');
const readmeEnPath = path.join(repoRoot, 'README.en.md');
const licensePath = path.join(repoRoot, 'LICENSE');
const packageJsonPath = path.join(repoRoot, 'package.json');

function getLocalMarkdownLinks(contents: string): string[] {
  const matches = contents.matchAll(/\[[^\]]+\]\((\.\/[^)]+)\)/g);
  return Array.from(matches, (match) => match[1]);
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
      ...getLocalMarkdownLinks(readmeZh),
      ...getLocalMarkdownLinks(readmeEn),
    ];

    expect(readmeZh).toContain('[English](./README.en.md)');
    expect(readmeEn).toContain('[简体中文](./README.md)');

    for (const link of linkedFiles) {
      const target = path.resolve(repoRoot, link);
      expect(await fs.pathExists(target)).toBe(true);
    }
  });

  it('keeps package metadata aligned with the public repository and license', async () => {
    const packageJson = await fs.readJson(packageJsonPath);

    expect(packageJson.version).toBe('1.0.0');
    expect(packageJson.license).toBe('MIT');
    expect(packageJson.repository?.url).toBe('https://github.com/BlackishGreen33/Expo-Harmony-Plugin.git');
    expect(packageJson.homepage).toBe('https://github.com/BlackishGreen33/Expo-Harmony-Plugin#readme');
    expect(packageJson.bugs?.url).toBe('https://github.com/BlackishGreen33/Expo-Harmony-Plugin/issues');
  });
});
