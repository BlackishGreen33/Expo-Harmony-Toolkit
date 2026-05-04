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
  path.join(
    'node_modules',
    '@react-native-oh',
    'react-native-harmony-cli',
    'dist',
    'commands',
    'codegen-lib-harmony.js',
  ),
  path.join(
    'node_modules',
    '@react-native-oh',
    'react-native-harmony-cli',
    'src',
    'commands',
    'codegen-lib-harmony.ts',
  ),
  path.join(
    'node_modules',
    '@react-native-oh',
    'react-native-harmony-cli',
    'dist',
    'codegen',
    'generators',
    'UberGeneratorV1.js',
  ),
  path.join(
    'node_modules',
    '@react-native-oh',
    'react-native-harmony-cli',
    'src',
    'codegen',
    'generators',
    'UberGeneratorV1.ts',
  ),
  path.join(
    'node_modules',
    '@react-native-oh',
    'react-native-harmony-cli',
    'dist',
    'codegen',
    'templates',
    'TurboModuleSpecTSTemplate.js',
  ),
  path.join(
    'node_modules',
    '@react-native-oh',
    'react-native-harmony-cli',
    'src',
    'codegen',
    'templates',
    'TurboModuleSpecTSTemplate.ts',
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
    )
    .replace(/(['"])@rnoh\/react-native-openharmony\/ts\1/g, "'../../ts'")
    .replace(
      /  addMethod\(method: Method\) {\n    this\.methods\.push\(method\);\n  }/,
      `  addMethod(method: Method) {
    if (method.name === 'getPhotoThumbnail' && method.returnType === 'Promise<void>') {
      method = { ...method, returnType: 'Promise<Object>' };
    }
    this.methods.push(method);
  }`,
    )
    .replace(
      /    addMethod\(method\) {\n        this\.methods\.push\(method\);\n    }/,
      `    addMethod(method) {
        if (method.name === 'getPhotoThumbnail' && method.returnType === 'Promise<void>') {
            method = { ...method, returnType: 'Promise<Object>' };
        }
        this.methods.push(method);
    }`,
    )
    .replace(
      '    const isRNOHModulePath = this.etsOutputPath.getValue().endsWith(`${RNOH_OHOS_NAME}/generated`.replace(/\\//g, pathUtils.sep));',
      `    const normalizedEtsOutputPath = this.etsOutputPath.getValue().replace(/\\\\/g, '/');
    const isRNOHModulePath =
      normalizedEtsOutputPath.endsWith(\`\${RNOH_OHOS_NAME}/generated\`) ||
      normalizedEtsOutputPath.endsWith('rnoh-react-native-openharmony-react_native_openharmony/generated');`,
    )
    .replace(
      '        const isRNOHModulePath = this.etsOutputPath.getValue().endsWith(`${RNOH_OHOS_NAME}/generated`.replace(/\\//g, path_1.default.sep));',
      `        const normalizedEtsOutputPath = this.etsOutputPath.getValue().replace(/\\\\/g, '/');
        const isRNOHModulePath = normalizedEtsOutputPath.endsWith(\`\${RNOH_OHOS_NAME}/generated\`) ||
            normalizedEtsOutputPath.endsWith('rnoh-react-native-openharmony-react_native_openharmony/generated');`,
    )
    .replace(
      /    const isRNOHModulePath = this\.etsOutputPath\.getValue\(\)\.endsWith\(`\$\{RNOH_OHOS_NAME\}\/generated`\.replace\(\/\\\/\/g, pathUtils\.sep\)\);/,
      `    const normalizedEtsOutputPath = this.etsOutputPath.getValue().replace(/\\\\/g, '/');
    const isRNOHModulePath =
      normalizedEtsOutputPath.endsWith(\`\${RNOH_OHOS_NAME}/generated\`) ||
      normalizedEtsOutputPath.endsWith('rnoh-react-native-openharmony-react_native_openharmony/generated');`,
    )
    .replace(
      /        const isRNOHModulePath = this\.etsOutputPath\.getValue\(\)\.endsWith\(`\$\{RNOH_OHOS_NAME\}\/generated`\.replace\(\/\\\/\/g, path_1\.default\.sep\)\);/,
      `        const normalizedEtsOutputPath = this.etsOutputPath.getValue().replace(/\\\\/g, '/');
        const isRNOHModulePath = normalizedEtsOutputPath.endsWith(\`\${RNOH_OHOS_NAME}/generated\`) ||
            normalizedEtsOutputPath.endsWith('rnoh-react-native-openharmony-react_native_openharmony/generated');`,
    );
}
