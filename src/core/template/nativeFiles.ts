export function renderPackageProvider(options: { hasManagedExpoHarmonyPackage: boolean }): string {
  const managedImports = options.hasManagedExpoHarmonyPackage
    ? "import { ExpoHarmonyPackage } from './expoHarmony/ExpoHarmonyPackage';\n"
    : '';
  const managedPackages = options.hasManagedExpoHarmonyPackage ? ', new ExpoHarmonyPackage(ctx)' : '';

  return `import type { RNPackageContext, RNPackage } from '@rnoh/react-native-openharmony';
import { createRNOHPackages as createRNOHPackagesAutolinking } from './RNOHPackagesFactory';
${managedImports}
export function getRNOHPackages(ctx: RNPackageContext): RNPackage[] {
  return [...createRNOHPackagesAutolinking(ctx)${managedPackages}];
}
`;
}

export function renderPackageProviderCpp(options: { hasManagedExpoHarmonyPackage: boolean }): string {
  const managedInclude = options.hasManagedExpoHarmonyPackage
    ? '#include "expoHarmony/ExpoHarmonyPackage.h"\n'
    : '';
  const managedPackage = options.hasManagedExpoHarmonyPackage
    ? '  packages.push_back(std::make_shared<ExpoHarmonyPackage>(ctx));\n'
    : '';

  return `#include "RNOH/PackageProvider.h"
#include "RNOHPackagesFactory.h"
#include "generated/RNOHGeneratedPackage.h"
${managedInclude}
using namespace rnoh;

std::vector<std::shared_ptr<Package>> PackageProvider::getPackages(
    Package::Context ctx) {
  auto packages = createRNOHPackages(ctx);
  packages.push_back(std::make_shared<RNOHGeneratedPackage>(ctx));
${managedPackage}  return packages;
}
`;
}

export function renderExpoHarmonyCppPackage(): string {
  return `#pragma once

#include <ReactCommon/TurboModule.h>
#include <react/renderer/components/view/ConcreteViewShadowNode.h>
#include <react/renderer/core/ConcreteComponentDescriptor.h>
#include "RNOH/ArkTSTurboModule.h"
#include "RNOH/Package.h"
#include "RNOHCorePackage/ComponentBinders/ViewComponentJSIBinder.h"

namespace rnoh {
using namespace facebook;

inline constexpr char ExpoHarmonyCameraViewComponentName[] =
    "ExpoHarmonyCameraView";
using ExpoHarmonyCameraViewShadowNode =
    react::ConcreteViewShadowNode<ExpoHarmonyCameraViewComponentName>;
using ExpoHarmonyCameraViewComponentDescriptor =
    react::ConcreteComponentDescriptor<ExpoHarmonyCameraViewShadowNode>;

static jsi::Value __hostFunction_ExpoHarmonyFileSystemTurboModule_getConstants(
    jsi::Runtime& rt,
    react::TurboModule& turboModule,
    const jsi::Value* args,
    size_t count) {
  return static_cast<ArkTSTurboModule&>(turboModule)
      .call(rt, "getConstants", args, count);
}

static jsi::Value __hostFunction_ExpoHarmonyImagePickerTurboModule_getConstants(
    jsi::Runtime& rt,
    react::TurboModule& turboModule,
    const jsi::Value* args,
    size_t count) {
  return static_cast<ArkTSTurboModule&>(turboModule)
      .call(rt, "getConstants", args, count);
}

static jsi::Value __hostFunction_ExpoHarmonyLocationTurboModule_getConstants(
    jsi::Runtime& rt,
    react::TurboModule& turboModule,
    const jsi::Value* args,
    size_t count) {
  return static_cast<ArkTSTurboModule&>(turboModule)
      .call(rt, "getConstants", args, count);
}

static jsi::Value __hostFunction_ExpoHarmonyCameraTurboModule_getConstants(
    jsi::Runtime& rt,
    react::TurboModule& turboModule,
    const jsi::Value* args,
    size_t count) {
  return static_cast<ArkTSTurboModule&>(turboModule)
      .call(rt, "getConstants", args, count);
}

class JSI_EXPORT ExpoHarmonyFileSystemTurboModule : public ArkTSTurboModule {
 public:
  ExpoHarmonyFileSystemTurboModule(
      const ArkTSTurboModule::Context ctx,
      const std::string name)
      : ArkTSTurboModule(ctx, name) {
    methodMap_["getConstants"] = MethodMetadata{
        0, __hostFunction_ExpoHarmonyFileSystemTurboModule_getConstants};
    methodMap_["getInfo"] = MethodMetadata{2, ARK_ASYNC_METHOD_CALLER(getInfo)};
    methodMap_["readAsString"] = MethodMetadata{
        2, ARK_ASYNC_METHOD_CALLER(readAsString)};
    methodMap_["writeAsString"] = MethodMetadata{
        3, ARK_ASYNC_METHOD_CALLER(writeAsString)};
    methodMap_["deletePath"] = MethodMetadata{
        2, ARK_ASYNC_METHOD_CALLER(deletePath)};
    methodMap_["makeDirectory"] = MethodMetadata{
        2, ARK_ASYNC_METHOD_CALLER(makeDirectory)};
    methodMap_["readDirectory"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(readDirectory)};
    methodMap_["copy"] = MethodMetadata{2, ARK_ASYNC_METHOD_CALLER(copy)};
    methodMap_["move"] = MethodMetadata{2, ARK_ASYNC_METHOD_CALLER(move)};
    methodMap_["download"] = MethodMetadata{
        3, ARK_ASYNC_METHOD_CALLER(download)};
  }
};

class JSI_EXPORT ExpoHarmonyImagePickerTurboModule : public ArkTSTurboModule {
 public:
  ExpoHarmonyImagePickerTurboModule(
      const ArkTSTurboModule::Context ctx,
      const std::string name)
      : ArkTSTurboModule(ctx, name) {
    methodMap_["getConstants"] = MethodMetadata{
        0, __hostFunction_ExpoHarmonyImagePickerTurboModule_getConstants};
    methodMap_["getMediaLibraryPermissionStatus"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(getMediaLibraryPermissionStatus)};
    methodMap_["requestMediaLibraryPermission"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(requestMediaLibraryPermission)};
    methodMap_["getCameraPermissionStatus"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(getCameraPermissionStatus)};
    methodMap_["requestCameraPermission"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(requestCameraPermission)};
    methodMap_["launchImageLibrary"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(launchImageLibrary)};
    methodMap_["launchCamera"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(launchCamera)};
    methodMap_["getPendingResult"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(getPendingResult)};
  }
};

class JSI_EXPORT ExpoHarmonyLocationTurboModule : public ArkTSTurboModule {
 public:
  ExpoHarmonyLocationTurboModule(
      const ArkTSTurboModule::Context ctx,
      const std::string name)
      : ArkTSTurboModule(ctx, name) {
    methodMap_["getConstants"] = MethodMetadata{
        0, __hostFunction_ExpoHarmonyLocationTurboModule_getConstants};
    methodMap_["getForegroundPermissionStatus"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(getForegroundPermissionStatus)};
    methodMap_["requestForegroundPermission"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(requestForegroundPermission)};
    methodMap_["getBackgroundPermissionStatus"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(getBackgroundPermissionStatus)};
    methodMap_["requestBackgroundPermission"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(requestBackgroundPermission)};
    methodMap_["hasServicesEnabled"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(hasServicesEnabled)};
    methodMap_["getProviderStatus"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(getProviderStatus)};
    methodMap_["getCurrentPosition"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(getCurrentPosition)};
    methodMap_["getLastKnownPosition"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(getLastKnownPosition)};
    methodMap_["geocode"] = MethodMetadata{1, ARK_ASYNC_METHOD_CALLER(geocode)};
    methodMap_["reverseGeocode"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(reverseGeocode)};
    methodMap_["startWatchPosition"] = MethodMetadata{
        2, ARK_ASYNC_METHOD_CALLER(startWatchPosition)};
    methodMap_["stopWatchPosition"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(stopWatchPosition)};
    methodMap_["getHeading"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(getHeading)};
    methodMap_["startWatchHeading"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(startWatchHeading)};
    methodMap_["stopWatchHeading"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(stopWatchHeading)};
  }
};

class JSI_EXPORT ExpoHarmonyCameraTurboModule : public ArkTSTurboModule {
 public:
  ExpoHarmonyCameraTurboModule(
      const ArkTSTurboModule::Context ctx,
      const std::string name)
      : ArkTSTurboModule(ctx, name) {
    methodMap_["getConstants"] = MethodMetadata{
        0, __hostFunction_ExpoHarmonyCameraTurboModule_getConstants};
    methodMap_["getCameraPermissionStatus"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(getCameraPermissionStatus)};
    methodMap_["requestCameraPermission"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(requestCameraPermission)};
    methodMap_["getMicrophonePermissionStatus"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(getMicrophonePermissionStatus)};
    methodMap_["requestMicrophonePermission"] = MethodMetadata{
        0, ARK_ASYNC_METHOD_CALLER(requestMicrophonePermission)};
    methodMap_["createPreview"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(createPreview)};
    methodMap_["disposePreview"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(disposePreview)};
    methodMap_["pausePreview"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(pausePreview)};
    methodMap_["resumePreview"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(resumePreview)};
    methodMap_["takePicture"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(takePicture)};
    methodMap_["startRecording"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(startRecording)};
    methodMap_["stopRecording"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(stopRecording)};
    methodMap_["toggleRecording"] = MethodMetadata{
        1, ARK_ASYNC_METHOD_CALLER(toggleRecording)};
  }
};

class ExpoHarmonyTurboModuleFactoryDelegate : public TurboModuleFactoryDelegate {
 public:
  SharedTurboModule createTurboModule(Context ctx, const std::string& name)
      const override {
    if (name == "ExpoHarmonyFileSystem") {
      return std::make_shared<ExpoHarmonyFileSystemTurboModule>(ctx, name);
    }
    if (name == "ExpoHarmonyImagePicker") {
      return std::make_shared<ExpoHarmonyImagePickerTurboModule>(ctx, name);
    }
    if (name == "ExpoHarmonyLocation") {
      return std::make_shared<ExpoHarmonyLocationTurboModule>(ctx, name);
    }
    if (name == "ExpoHarmonyCamera") {
      return std::make_shared<ExpoHarmonyCameraTurboModule>(ctx, name);
    }

    return nullptr;
  }
};

class ExpoHarmonyCameraViewJSIBinder : public ViewComponentJSIBinder {
 protected:
  facebook::jsi::Object createNativeProps(facebook::jsi::Runtime& rt) override {
    auto nativeProps = ViewComponentJSIBinder::createNativeProps(rt);
    nativeProps.setProperty(rt, "viewId", "string");
    nativeProps.setProperty(rt, "facing", "string");
    nativeProps.setProperty(rt, "mode", "string");
    return nativeProps;
  }
};

class ExpoHarmonyPackage : public Package {
 public:
  explicit ExpoHarmonyPackage(Package::Context ctx) : Package(ctx) {}

  std::unique_ptr<TurboModuleFactoryDelegate> createTurboModuleFactoryDelegate()
      override {
    return std::make_unique<ExpoHarmonyTurboModuleFactoryDelegate>();
  }

  std::vector<facebook::react::ComponentDescriptorProvider>
  createComponentDescriptorProviders() override {
    return {
        facebook::react::concreteComponentDescriptorProvider<
            ExpoHarmonyCameraViewComponentDescriptor>(),
    };
  }

  ComponentJSIBinderByString createComponentJSIBinderByName() override {
    auto binder = std::make_shared<ExpoHarmonyCameraViewJSIBinder>();
    return {
        {"ExpoHarmonyCameraView", binder},
    };
  }
};
} // namespace rnoh
`;
}


export function renderExpoHarmonyPackage(): string {
  return `import type {
  AnyThreadTurboModule,
  AnyThreadTurboModuleContext,
  UITurboModule,
  UITurboModuleContext,
} from '@rnoh/react-native-openharmony';
import {
  RNOHPackage,
} from '@rnoh/react-native-openharmony';
import { ExpoHarmonyFileSystemTurboModule } from './ExpoHarmonyFileSystemTurboModule';
import { ExpoHarmonyImagePickerTurboModule } from './ExpoHarmonyImagePickerTurboModule';
import { ExpoHarmonyLocationTurboModule } from './ExpoHarmonyLocationTurboModule';
import { ExpoHarmonyCameraTurboModule } from './ExpoHarmonyCameraTurboModule';

export class ExpoHarmonyPackage extends RNOHPackage {
  override getAnyThreadTurboModuleFactoryByNameMap(): Map<
    string,
    (ctx: AnyThreadTurboModuleContext) => AnyThreadTurboModule | null
  > {
    return new Map<string, (ctx: AnyThreadTurboModuleContext) => AnyThreadTurboModule | null>()
      .set(
        ExpoHarmonyFileSystemTurboModule.NAME,
        (ctx) => new ExpoHarmonyFileSystemTurboModule(ctx),
      )
      .set(
        ExpoHarmonyLocationTurboModule.NAME,
        (ctx) => new ExpoHarmonyLocationTurboModule(ctx),
      );
  }

  override getUITurboModuleFactoryByNameMap(): Map<
    string,
    (ctx: UITurboModuleContext) => UITurboModule | null
  > {
    return new Map<string, (ctx: UITurboModuleContext) => UITurboModule | null>()
      .set(
        ExpoHarmonyImagePickerTurboModule.NAME,
        (ctx) => new ExpoHarmonyImagePickerTurboModule(ctx),
      )
      .set(
        ExpoHarmonyCameraTurboModule.NAME,
        (ctx) => new ExpoHarmonyCameraTurboModule(ctx),
      );
  }

  override getDebugName() {
    return 'expo-harmony';
  }
}
`;
}
