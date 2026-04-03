import { CapabilityDefinition } from '../../types';
import {
  renderExpoHarmonyCameraTurboModule,
  renderExpoCameraHarmonyAdapterShim,
  renderExpoCameraPreviewShim,
} from './renderers/camera';
import {
  renderExpoHarmonyFileSystemTurboModule,
  renderExpoFileSystemHarmonyAdapterShim,
  renderExpoFileSystemPreviewShim,
} from './renderers/fileSystem';
import {
  renderExpoHarmonyImagePickerTurboModule,
  renderExpoImagePickerHarmonyAdapterShim,
  renderExpoImagePickerPreviewShim,
} from './renderers/imagePicker';
import {
  renderExpoHarmonyLocationTurboModule,
  renderExpoLocationHarmonyAdapterShim,
  renderExpoLocationPreviewShim,
} from './renderers/location';

type CapabilityShimRenderers = {
  adapter: (capability: CapabilityDefinition) => string;
  preview: (capability: CapabilityDefinition) => string;
};

type ManagedExpoHarmonyModuleRenderer = {
  filename: string;
  render: () => string;
};

const CAPABILITY_SHIM_RENDERERS: Record<string, CapabilityShimRenderers> = {
  'expo-file-system': {
    adapter: renderExpoFileSystemHarmonyAdapterShim,
    preview: renderExpoFileSystemPreviewShim,
  },
  'expo-image-picker': {
    adapter: renderExpoImagePickerHarmonyAdapterShim,
    preview: renderExpoImagePickerPreviewShim,
  },
  'expo-location': {
    adapter: renderExpoLocationHarmonyAdapterShim,
    preview: renderExpoLocationPreviewShim,
  },
  'expo-camera': {
    adapter: renderExpoCameraHarmonyAdapterShim,
    preview: renderExpoCameraPreviewShim,
  },
};

export const MANAGED_EXPO_HARMONY_MODULE_RENDERERS: readonly ManagedExpoHarmonyModuleRenderer[] =
  [
    {
      filename: 'ExpoHarmonyFileSystemTurboModule.ts',
      render: renderExpoHarmonyFileSystemTurboModule,
    },
    {
      filename: 'ExpoHarmonyImagePickerTurboModule.ts',
      render: renderExpoHarmonyImagePickerTurboModule,
    },
    {
      filename: 'ExpoHarmonyLocationTurboModule.ts',
      render: renderExpoHarmonyLocationTurboModule,
    },
    {
      filename: 'ExpoHarmonyCameraTurboModule.ts',
      render: renderExpoHarmonyCameraTurboModule,
    },
  ];

export function renderCapabilityModuleShim(
  capability: CapabilityDefinition,
): string {
  const renderer = CAPABILITY_SHIM_RENDERERS[capability.packageName];

  if (!renderer) {
    return renderUnsupportedCapabilityShim(capability);
  }

  return capability.runtimeMode !== 'shim'
    ? renderer.adapter(capability)
    : renderer.preview(capability);
}

export function renderUnsupportedCapabilityShim(
  capability: CapabilityDefinition,
): string {
  return `'use strict';

const { CodedError } = require('expo-modules-core');

function createPreviewError() {
  return new CodedError(
    'ERR_EXPO_HARMONY_PREVIEW',
    '${capability.packageName} is classified as ${capability.supportTier} for Harmony, but no managed runtime shim has been wired yet.',
  );
}

function unavailable() {
  throw createPreviewError();
}

module.exports = new Proxy(
  {},
  {
    get(_target, propertyName) {
      if (propertyName === '__esModule') {
        return true;
      }

      return unavailable;
    },
  },
);
`;
}
