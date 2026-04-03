import fs from 'fs-extra';
import path from 'path';

const RNOH_CLI_AUTOLINKING_TEMPLATE_RELATIVE_PATHS = [
  path.join(
    'node_modules',
    '@react-native-oh',
    'react-native-harmony-cli',
    'dist',
    'autolinking',
    'Autolinking.js',
  ),
  path.join(
    'node_modules',
    '@react-native-oh',
    'react-native-harmony-cli',
    'src',
    'autolinking',
    'Autolinking.ts',
  ),
] as const;

export async function normalizeProjectRnohCliAutolinkingTemplates(
  projectRoot: string,
): Promise<() => Promise<void>> {
  const originalContentsByPath = new Map<string, string>();

  for (const relativePath of RNOH_CLI_AUTOLINKING_TEMPLATE_RELATIVE_PATHS) {
    const targetPath = path.join(projectRoot, relativePath);
    if (!(await fs.pathExists(targetPath))) {
      continue;
    }

    const currentContents = await fs.readFile(targetPath, 'utf8');
    const normalizedContents = normalizeRnohCliAutolinkingTemplateContents(currentContents);

    if (normalizedContents === currentContents) {
      continue;
    }

    originalContentsByPath.set(targetPath, currentContents);
    await fs.writeFile(targetPath, normalizedContents);
  }

  return async () => {
    for (const [targetPath, originalContents] of originalContentsByPath.entries()) {
      await fs.writeFile(targetPath, originalContents);
    }
  };
}

function normalizeRnohCliAutolinkingTemplateContents(contents: string): string {
  return contents
    .replace(
      /import type \{ RNPackageContext, RNOHPackage \} from '@rnoh\/react-native-openharmony';/g,
      "import type { RNPackageContext, RNPackage } from '@rnoh/react-native-openharmony';",
    )
    .replace(
      /export function createRNOHPackages\(ctx: RNPackageContext\): RNOHPackage\[\] \{/g,
      'export function createRNOHPackages(ctx: RNPackageContext): RNPackage[] {',
    );
}
