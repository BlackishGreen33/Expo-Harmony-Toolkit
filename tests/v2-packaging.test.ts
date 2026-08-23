import fs from 'fs';
import path from 'path';
import * as publicApi from '../src';
import { CAPABILITY_DEFINITIONS } from '../src/data/capabilities';
import {
  DEFAULT_VALIDATED_MATRIX_ID,
  VALIDATED_RELEASE_MATRICES,
} from '../src/data/validatedMatrices';
import { HARMONY_NATIVE_ADAPTERS } from '../src/data/uiStack';
import { V2_PACKAGING_CATALOG } from '../src/data/v2Packaging';

const PUSH_EXCEPTION_PACKAGES = [
  'expo-notifications',
  'jcore-react-native',
  'jpush-react-native',
  'mx-jpush-expo',
] as const;

const FOUNDATION_SHIM_PACKAGES = [
  'expo-asset',
  'expo-clipboard',
  'expo-device',
  'expo-haptics',
  'expo-secure-store',
] as const;

const PACKAGING_INTAKE_PACKAGES = [
  '@ant-design/icons-react-native',
  '@ant-design/react-native',
  '@expo/vector-icons',
  '@lottiefiles/dotlottie-react',
  '@rneui/base',
  '@rneui/themed',
  'axios',
  'expo-application',
  'expo-font',
  'expo-image-manipulator',
  'expo-updates',
  'expo-web-browser',
  'react-native-draggable-grid',
  'react-native-pdf-renderer',
  'react-native-reanimated-carousel',
  'react-native-svg-transformer',
  'react-native-web',
  'zustand',
] as const;

function getClassifiedPackageNames(): string[] {
  return [
    ...V2_PACKAGING_CATALOG.covered.packageNames,
    ...V2_PACKAGING_CATALOG.exceptions.flatMap((exception) => exception.packageNames),
    ...V2_PACKAGING_CATALOG.intakeOnly.packageNames,
  ];
}

describe('v2 internal packaging contract', () => {
  it('represents the verified allowlist, all 19 capabilities, adapter/runtime companions, and bare build properties', () => {
    const verifiedAllowlist =
      VALIDATED_RELEASE_MATRICES[DEFAULT_VALIDATED_MATRIX_ID].allowedDependencies;
    const coveredPackageNames = new Set(V2_PACKAGING_CATALOG.covered.packageNames);
    const classifiedPackageNames = new Set(getClassifiedPackageNames());
    const exceptionPackageNames = new Set<string>(
      V2_PACKAGING_CATALOG.exceptions.flatMap((exception) => exception.packageNames),
    );
    const intakeOnlyPackageNames = new Set(V2_PACKAGING_CATALOG.intakeOnly.packageNames);

    expect(CAPABILITY_DEFINITIONS).toHaveLength(19);
    expect(verifiedAllowlist.every((packageName) => coveredPackageNames.has(packageName))).toBe(true);
    for (const definition of CAPABILITY_DEFINITIONS) {
      for (const packageName of [definition.packageName, ...definition.nativePackageNames]) {
        const dispositionCount = [
          coveredPackageNames,
          exceptionPackageNames,
          intakeOnlyPackageNames,
        ].filter((packageNames) => packageNames.has(packageName)).length;

        expect(classifiedPackageNames.has(packageName)).toBe(true);
        expect(dispositionCount).toBe(1);
        expect(
          exceptionPackageNames.has(packageName) || coveredPackageNames.has(packageName),
        ).toBe(true);
      }
    }
    expect(
      HARMONY_NATIVE_ADAPTERS.flatMap((adapter) => [
        adapter.canonicalPackageName,
        adapter.adapterPackageName,
      ]).every(
        (packageName) =>
          exceptionPackageNames.has(packageName) || coveredPackageNames.has(packageName),
      ),
    ).toBe(true);
    expect(coveredPackageNames.has('expo-build-properties')).toBe(true);
  });

  it('keeps exactly the three fixed exception groups and their fallbacks', () => {
    expect(V2_PACKAGING_CATALOG.exceptions).toHaveLength(3);
    expect(V2_PACKAGING_CATALOG.exceptions.length).toBeLessThanOrEqual(3);
    expect(V2_PACKAGING_CATALOG.exceptions).toEqual([
      expect.objectContaining({
        id: 'push',
        packageNames: PUSH_EXCEPTION_PACKAGES,
        fallback: 'Disable push or use a manual sidecar.',
      }),
      expect.objectContaining({
        id: 'screens',
        packageNames: [
          'react-native-screens',
          '@react-native-oh-tpl/react-native-screens',
        ],
        fallback: 'enableScreens(false)',
      }),
      expect.objectContaining({
        id: 'skia',
        packageNames: [
          '@shopify/react-native-skia',
          '@react-native-oh-tpl/react-native-skia',
        ],
        fallback: 'Use a non-Skia renderer or disable the surface.',
      }),
    ]);
  });

  it('keeps package classification unique and packaging intake explicit', () => {
    const classifiedPackageNames = getClassifiedPackageNames();
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'data', 'v2Packaging.ts'),
      'utf8',
    );

    expect(new Set(classifiedPackageNames).size).toBe(classifiedPackageNames.length);
    expect(source).not.toContain("from './dependencyCatalog'");
    expect(source).not.toContain('DEPENDENCY_CATALOG');
    expect(V2_PACKAGING_CATALOG.intakeOnly.packageNames).toEqual(PACKAGING_INTAKE_PACKAGES);
  });

  it('keeps foundation shims and safe-area covered with documented limitations', () => {
    const coveredPackageNames = new Set(V2_PACKAGING_CATALOG.covered.packageNames);
    const limitedPackageNames = new Set(
      V2_PACKAGING_CATALOG.covered.limitations.flatMap(
        (limitation) => limitation.packageNames,
      ),
    );
    const exceptionPackageNames = new Set<string>(
      V2_PACKAGING_CATALOG.exceptions.flatMap((exception) => exception.packageNames),
    );
    for (const packageName of [
      ...FOUNDATION_SHIM_PACKAGES,
      'react-native-safe-area-context',
    ]) {
      expect(coveredPackageNames.has(packageName)).toBe(true);
      expect(limitedPackageNames.has(packageName)).toBe(true);
      expect(exceptionPackageNames.has(packageName)).toBe(false);
    }
  });

  it('uses packaging-specific evidence on every lane and exception scenario', () => {
    const scenarios = [
      V2_PACKAGING_CATALOG.covered,
      ...V2_PACKAGING_CATALOG.exceptions,
      V2_PACKAGING_CATALOG.intakeOnly,
    ];

    for (const scenario of scenarios) {
      expect(Object.keys(scenario.evidence).sort()).toEqual([
        'debugHap',
        'portable',
        'releaseHap',
        'simulator',
      ]);
      expect(scenario.evidence).not.toHaveProperty('device');
      expect(scenario.evidence).not.toHaveProperty('release');
    }
  });

  it('records the accepted non-device packaging evidence without promoting intake-only packages', () => {
    const acceptedEvidence = {
      portable: true,
      debugHap: true,
      releaseHap: true,
      simulator: true,
    };
    const pendingEvidence = {
      portable: false,
      debugHap: false,
      releaseHap: false,
      simulator: false,
    };

    expect(V2_PACKAGING_CATALOG.covered.evidence).toEqual(acceptedEvidence);
    expect(
      V2_PACKAGING_CATALOG.exceptions.every(
        (exception) => JSON.stringify(exception.evidence) === JSON.stringify(acceptedEvidence),
      ),
    ).toBe(true);
    expect(V2_PACKAGING_CATALOG.intakeOnly.evidence).toEqual(pendingEvidence);

    for (const scenario of [V2_PACKAGING_CATALOG.covered, ...V2_PACKAGING_CATALOG.exceptions]) {
      expect((scenario as { evidenceReference?: string }).evidenceReference).toBe(
        'acceptance/v2.0.0-non-device-closeout.md',
      );
    }
    expect(
      (V2_PACKAGING_CATALOG.intakeOnly as { evidenceReference?: string | null }).evidenceReference,
    ).toBeNull();
  });

  it('stays outside the public entrypoint', () => {
    expect(Object.prototype.hasOwnProperty.call(publicApi, 'V2_PACKAGING_CATALOG')).toBe(false);
  });
});
