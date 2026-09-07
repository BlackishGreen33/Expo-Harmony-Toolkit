import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { CAPABILITY_BY_PACKAGE } from '../src/data/capabilities';
import { renderExpoHarmonyLocationTurboModule, renderExpoLocationHarmonyAdapterShim } from '../src/core/template/renderers/location';

it('streams native location and heading events, isolates watchers and releases subscriptions', async () => {
  const events = new EventEmitter();
  const locationCallbacks = new Set<(value: unknown) => void>();
  const errorCallbacks = new Set<(value: unknown) => void>();
  const headingCallbacks = new Set<(value: unknown) => void>();
  const geo = {
    LocationRequestPriority: { ACCURACY: 1, LOW_POWER: 2, FIRST_FIX: 3 },
    on: jest.fn((type: string, request: any, callback?: any) => {
      if (type === 'locationError') errorCallbacks.add(request);
      else {
        if (Object.values(request).some(value => value === undefined)) throw new Error('Wrong argument type');
        locationCallbacks.add(callback);
        callback({ latitude: 39, longitude: 116 });
      }
    }),
    off: jest.fn((type: string, callback: any) => (type === 'locationError' ? errorCallbacks : locationCallbacks).delete(callback)),
  };
  const sensor = {
    SensorId: { ROTATION_VECTOR: 259 },
    on: jest.fn((_id: number, callback: any) => headingCallbacks.add(callback)),
    off: jest.fn((_id: number, callback: any) => headingCallbacks.delete(callback)),
  };
  const nativeExports: Record<string, any> = {};
  const modules: Record<string, unknown> = {
    '@rnoh/react-native-openharmony/ts': { AnyThreadTurboModule: class {
      constructor(public ctx: unknown) {}
      __onDestroy__() {}
    } },
    '@ohos.abilityAccessCtrl': { createAtManager: () => ({}) },
    '@ohos.geoLocationManager': geo,
    '@kit.SensorServiceKit': { sensor },
  };
  runInNewContext(ts.transpileModule(renderExpoHarmonyLocationTurboModule(), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, { exports: nativeExports, require: (name: string) => modules[name], console });
  const native = new nativeExports.ExpoHarmonyLocationTurboModule({ rnInstance: { emitDeviceEvent: (name: string, payload: unknown) => events.emit(name, payload) } });
  const shim = { exports: {} as Record<string, any> };
  runInNewContext(renderExpoLocationHarmonyAdapterShim(CAPABILITY_BY_PACKAGE['expo-location']), {
    module: shim, console,
    require: (name: string) => name === 'react-native' ? {
      TurboModuleRegistry: { get: () => native },
      DeviceEventEmitter: { addListener: (event: string, listener: (...args: any[]) => void) => {
        events.on(event, listener);
        return { remove: () => events.off(event, listener) };
      } },
    } : { CodedError: Error },
  });
  const location = jest.fn();
  const otherLocation = jest.fn();
  const errors = jest.fn();
  const heading = jest.fn();
  const first = await shim.exports.watchPositionAsync({ accuracy: 4, timeInterval: 2500, distanceInterval: 5 }, location, errors);
  const second = await shim.exports.watchPositionAsync({}, otherLocation);
  const compass = await shim.exports.watchHeadingAsync(heading);
  expect(geo.on).toHaveBeenCalledWith('locationChange', { priority: 1, timeInterval: 2.5, distanceInterval: 5 }, expect.any(Function));
  for (const latitude of [40, 41]) locationCallbacks.forEach(callback => callback({ latitude, longitude: 116, timeStamp: 123 }));
  expect(location.mock.calls.map(([value]) => value.coords.latitude)).toEqual([39, 40, 41]);
  expect(otherLocation).toHaveBeenCalledTimes(3);
  errorCallbacks.forEach(callback => callback(0x3300001));
  expect(errors).toHaveBeenCalledWith(expect.any(String));
  headingCallbacks.forEach(callback => callback({ x: 0, y: 0, z: 0, w: 1 }));
  headingCallbacks.forEach(callback => callback({ x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 }));
  expect(heading).toHaveBeenCalledTimes(2);
  expect(heading.mock.calls[1][0].magHeading).toBeCloseTo(90);
  first.remove();
  first.remove();
  locationCallbacks.forEach(callback => callback({ latitude: 42, longitude: 116 }));
  expect(location).toHaveBeenCalledTimes(3);
  expect(otherLocation).toHaveBeenCalledTimes(4);
  compass.remove();
  expect(headingCallbacks.size).toBe(0);
  second.remove();
  expect(locationCallbacks.size).toBe(0);
  expect(errorCallbacks.size).toBe(0);
  expect(events.eventNames()).toEqual([]);

  geo.on.mockImplementationOnce((_type, callback) => { errorCallbacks.add(callback); });
  geo.on.mockImplementationOnce(() => { throw new Error('permission denied'); });
  await expect(shim.exports.watchPositionAsync({}, location, errors)).rejects.toThrow('permission denied');
  expect(events.eventNames()).toEqual([]);
  expect(errorCallbacks.size).toBe(0);
  await shim.exports.watchPositionAsync({}, location);
  await shim.exports.watchHeadingAsync(heading);
  native.__onDestroy__();
  expect(locationCallbacks.size).toBe(0);
  expect(errorCallbacks.size).toBe(0);
  expect(headingCallbacks.size).toBe(0);
});
