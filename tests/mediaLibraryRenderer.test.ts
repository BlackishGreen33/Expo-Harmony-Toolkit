import { renderExpoMediaLibraryHarmonyAdapterShim } from '../src/core/template/renderers/mediaLibrary';
import { CapabilityDefinition } from '../src/types';

type PermissionModule = {
  checkPermission: jest.Mock<Promise<string>, [string]>;
  requestReadWritePermission: jest.Mock<Promise<string>, []>;
  requestAddOnlyPermission: jest.Mock<Promise<string>, []>;
};

type MediaLibraryShim = {
  getPermissionsAsync(writeOnly?: boolean): Promise<Record<string, unknown>>;
  requestPermissionsAsync(writeOnly?: boolean): Promise<Record<string, unknown>>;
};

const capability = {
  packageName: 'expo-media-library',
} as CapabilityDefinition;

function loadShim(permissionModule: PermissionModule): MediaLibraryShim {
  const cameraRoll = {
    getPhotos: jest.fn(async () => ({ edges: [] })),
    save: jest.fn(async (uri: string) => uri),
  };
  const moduleContainer: { exports: unknown } = { exports: {} };
  const requireMock = (moduleName: string): unknown => {
    if (moduleName === 'react-native') {
      return {
        TurboModuleRegistry: {
          get: () => permissionModule,
        },
      };
    }

    if (moduleName === '@react-native-camera-roll/camera-roll') {
      return { CameraRoll: cameraRoll };
    }

    throw new Error(`Unexpected module request: ${moduleName}`);
  };

  const evaluateShim = new Function(
    'require',
    'module',
    'exports',
    renderExpoMediaLibraryHarmonyAdapterShim(capability),
  );
  evaluateShim(requireMock, moduleContainer, moduleContainer.exports);

  return moduleContainer.exports as MediaLibraryShim;
}

function createPermissionModule(): PermissionModule {
  return {
    checkPermission: jest.fn(async (_accessLevel: string) => 'denied'),
    requestReadWritePermission: jest.fn(async () => 'granted'),
    requestAddOnlyPermission: jest.fn(async () => 'granted'),
  };
}

describe('media-library Harmony renderer', () => {
  it('maps native limited permission to Expo granted plus limited access', async () => {
    const permissionModule = createPermissionModule();
    permissionModule.requestAddOnlyPermission.mockResolvedValueOnce('limited');
    const shim = loadShim(permissionModule);

    await expect(shim.requestPermissionsAsync()).resolves.toMatchObject({
      status: 'granted',
      granted: true,
      accessPrivileges: 'limited',
    });
  });

  it('maps denied permission to no media access', async () => {
    const permissionModule = createPermissionModule();
    const shim = loadShim(permissionModule);

    await expect(shim.getPermissionsAsync()).resolves.toMatchObject({
      status: 'denied',
      granted: false,
      accessPrivileges: 'none',
    });
  });

  it('compensates for the Harmony adapter request method mapping for write-only access', async () => {
    const permissionModule = createPermissionModule();
    const shim = loadShim(permissionModule);

    await shim.requestPermissionsAsync(true);

    expect(permissionModule.requestReadWritePermission).toHaveBeenCalledTimes(1);
    expect(permissionModule.requestAddOnlyPermission).not.toHaveBeenCalled();
  });
});
