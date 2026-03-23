import { buildPrebuildMetadata, validatePluginProps, withExpoHarmony } from '../src/plugin';

describe('expo harmony plugin', () => {
  it('mirrors harmony metadata into Expo extra config', () => {
    const config = withExpoHarmony(
      {
        name: 'Demo App',
        slug: 'demo-app',
        version: '1.0.0',
        android: {
          package: 'com.example.demo',
        },
      },
      {
        entryModuleName: 'entry',
      },
    );

    expect(config.extra?.expoHarmony).toMatchObject({
      bundleName: 'com.example.demo',
      entryModuleName: 'entry',
    });
  });

  it('validates bundle identifiers', () => {
    expect(() => validatePluginProps({ bundleName: 'invalid bundle name' })).toThrow(
      '[expo-harmony-toolkit] bundleName must be a valid identifier such as com.example.app',
    );
  });

  it('builds prebuild metadata from Expo config', () => {
    const metadata = buildPrebuildMetadata(
      {
        name: 'Demo App',
        slug: 'demo-app',
        version: '1.0.0',
      },
      {
        appName: 'Demo App',
        slug: 'demo-app',
        bundleName: 'com.example.demo',
        entryModuleName: 'entry',
        androidPackage: 'com.example.demo',
        iosBundleIdentifier: null,
      },
      {},
    );

    expect(metadata.identifiers.bundleName).toBe('com.example.demo');
    expect(metadata.app.slug).toBe('demo-app');
  });
});
