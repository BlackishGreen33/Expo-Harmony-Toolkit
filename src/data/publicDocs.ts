import { TOOLKIT_VERSION } from '../core/constants';
import { CAPABILITY_DEFINITIONS } from './capabilities';
import { UI_STACK_VALIDATED_ADAPTERS } from './uiStack';

export const PUBLIC_RELEASE_TRACKS = {
  latest: 'fully accepted verified only',
  next: 'preview fast track',
} as const;

export const PRIMARY_SAMPLE_PATH = 'examples/official-ui-stack-sample';
export const PREVIEW_SAMPLE_PATH = 'examples/official-native-capabilities-sample';
export const SUPPORTING_SAMPLE_PATHS = [
  'examples/official-app-shell-sample',
  'examples/official-minimal-sample',
] as const;

export const VERIFIED_JS_UI_CAPABILITY_NAMES = [
  'expo-router',
  'expo-linking',
  'expo-constants',
  ...UI_STACK_VALIDATED_ADAPTERS.map((adapter) => adapter.canonicalPackageName),
] as const;

export const PREVIEW_CAPABILITY_DEFINITIONS = CAPABILITY_DEFINITIONS.filter(
  (definition) => definition.supportTier === 'preview',
);

export const EXPERIMENTAL_CAPABILITY_NAMES = [
  ...CAPABILITY_DEFINITIONS.filter((definition) => definition.supportTier === 'experimental').map(
    (definition) => definition.packageName,
  ),
  'react-native-gesture-handler',
] as const;

export const PUBLIC_CURRENT_VERSION = TOOLKIT_VERSION;
