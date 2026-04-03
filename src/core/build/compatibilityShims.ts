import fs from 'fs-extra';
import path from 'path';

export async function ensureNormalizedLocalHarCompatibilityShims(
  directoryPath: string,
  packageName: string,
): Promise<void> {
  if (packageName === '@react-native-oh-tpl/react-native-gesture-handler') {
    const gestureHandlerPackageHeaderPath = path.join(
      directoryPath,
      'src',
      'main',
      'cpp',
      'RnohReactNativeHarmonyGestureHandlerPackage.h',
    );
    const gestureHandlerPackagePath = path.join(
      directoryPath,
      'src',
      'main',
      'cpp',
      'RnohReactNativeHarmonyGestureHandlerPackage.cpp',
    );
    const gestureHandlerTurboModulePath = path.join(
      directoryPath,
      'src',
      'main',
      'ets',
      'rnoh',
      'RNGestureHandlerModule.ts',
    );
    if (await fs.pathExists(gestureHandlerTurboModulePath)) {
      const gestureHandlerTurboModuleContents = await fs.readFile(
        gestureHandlerTurboModulePath,
        'utf8',
      );
      let nextGestureHandlerTurboModuleContents = gestureHandlerTurboModuleContents;

      nextGestureHandlerTurboModuleContents = nextGestureHandlerTurboModuleContents.replace(
        /^import \{ TM \} from ["']@rnoh\/react-native-openharmony\/generated\/ts["'];?\r?\n/m,
        '',
      );
      nextGestureHandlerTurboModuleContents = nextGestureHandlerTurboModuleContents.replace(
        /\s+implements TM\.RNGestureHandlerModule\.Spec/,
        '',
      );

      if (nextGestureHandlerTurboModuleContents !== gestureHandlerTurboModuleContents) {
        await fs.writeFile(
          gestureHandlerTurboModulePath,
          nextGestureHandlerTurboModuleContents,
        );
      }
    }

    const gestureHandlerGeneratedDirectoryPath = path.join(
      directoryPath,
      'src',
      'main',
      'cpp',
      'generated',
    );
    await fs.ensureDir(gestureHandlerGeneratedDirectoryPath);
    await fs.writeFile(
      path.join(
        gestureHandlerGeneratedDirectoryPath,
        'RNGestureHandlerButtonComponentDescriptor.h',
      ),
      createGestureHandlerCompatibilityDescriptorHeader('RNGestureHandlerButton'),
    );
    await fs.writeFile(
      path.join(
        gestureHandlerGeneratedDirectoryPath,
        'RNGestureHandlerRootViewComponentDescriptor.h',
      ),
      createGestureHandlerCompatibilityDescriptorHeader('RNGestureHandlerRootView'),
    );

    if (await fs.pathExists(gestureHandlerPackageHeaderPath)) {
      const gestureHandlerPackageHeaderContents = await fs.readFile(
        gestureHandlerPackageHeaderPath,
        'utf8',
      );
      const nextGestureHandlerPackageHeaderContents =
        patchGestureHandlerCompatibilityPackageHeader(
          gestureHandlerPackageHeaderContents,
        );

      if (
        nextGestureHandlerPackageHeaderContents !== gestureHandlerPackageHeaderContents
      ) {
        await fs.writeFile(
          gestureHandlerPackageHeaderPath,
          nextGestureHandlerPackageHeaderContents,
        );
      }
    }

    if (!(await fs.pathExists(gestureHandlerPackagePath))) {
      return;
    }

    const gestureHandlerPackageContents = await fs.readFile(
      gestureHandlerPackagePath,
      'utf8',
    );
    const nextGestureHandlerPackageContents =
      patchGestureHandlerCompatibilityPackageSource(gestureHandlerPackageContents);

    if (nextGestureHandlerPackageContents !== gestureHandlerPackageContents) {
      await fs.writeFile(
        gestureHandlerPackagePath,
        nextGestureHandlerPackageContents,
      );
    }

    if (
      !nextGestureHandlerPackageContents.includes(
        '<react/renderer/debug/SystraceSection.h>',
      )
    ) {
      return;
    }

    const systraceCompatibilityShimPath = path.join(
      directoryPath,
      'src',
      'main',
      'cpp',
      'react',
      'renderer',
      'debug',
      'SystraceSection.h',
    );

    await fs.ensureDir(path.dirname(systraceCompatibilityShimPath));
    await fs.writeFile(
      systraceCompatibilityShimPath,
      '#pragma once\n#include <cxxreact/SystraceSection.h>\n',
    );
    return;
  }

  if (packageName === '@react-native-oh-tpl/react-native-reanimated') {
    const reanimatedCmakeListsPath = path.join(directoryPath, 'src', 'main', 'cpp', 'CMakeLists.txt');
    const reanimatedMountHookHeaderPath = path.join(
      directoryPath,
      'src',
      'main',
      'cpp',
      'Common',
      'cpp',
      'Fabric',
      'ReanimatedMountHook.h',
    );
    const reanimatedMountHookSourcePath = path.join(
      directoryPath,
      'src',
      'main',
      'cpp',
      'Common',
      'cpp',
      'Fabric',
      'ReanimatedMountHook.cpp',
    );
    const nativeReanimatedModuleSourcePath = path.join(
      directoryPath,
      'src',
      'main',
      'cpp',
      'Common',
      'cpp',
      'NativeModules',
      'NativeReanimatedModule.cpp',
    );

    if (await fs.pathExists(reanimatedCmakeListsPath)) {
      const reanimatedCmakeListsContents = await fs.readFile(reanimatedCmakeListsPath, 'utf8');

      if (reanimatedCmakeListsContents.includes('REACT_NATIVE_MINOR_VERSION=72')) {
        await fs.writeFile(
          reanimatedCmakeListsPath,
          reanimatedCmakeListsContents.replace(
            'REACT_NATIVE_MINOR_VERSION=72',
            'REACT_NATIVE_MINOR_VERSION=82',
          ),
        );
      }
    }

    if (await fs.pathExists(reanimatedMountHookHeaderPath)) {
      const reanimatedMountHookHeaderContents = await fs.readFile(reanimatedMountHookHeaderPath, 'utf8');

      if (reanimatedMountHookHeaderContents.includes('double mountTime) noexcept override;')) {
        await fs.writeFile(
          reanimatedMountHookHeaderPath,
          reanimatedMountHookHeaderContents.replace(
            'double mountTime) noexcept override;',
            'HighResTimeStamp mountTime) noexcept override;',
          ),
        );
      }
    }

    if (await fs.pathExists(reanimatedMountHookSourcePath)) {
      const reanimatedMountHookSourceContents = await fs.readFile(reanimatedMountHookSourcePath, 'utf8');

      if (reanimatedMountHookSourceContents.includes('double) noexcept {')) {
        await fs.writeFile(
          reanimatedMountHookSourcePath,
          reanimatedMountHookSourceContents.replace(
            'double) noexcept {',
            'HighResTimeStamp) noexcept {',
          ),
        );
      }
    }

    if (await fs.pathExists(nativeReanimatedModuleSourcePath)) {
      const nativeReanimatedModuleSourceContents = await fs.readFile(
        nativeReanimatedModuleSourcePath,
        'utf8',
      );
      let nextNativeReanimatedModuleSourceContents = nativeReanimatedModuleSourceContents;

      if (nextNativeReanimatedModuleSourceContents.includes('<react/renderer/core/TraitCast.h>')) {
        nextNativeReanimatedModuleSourceContents = nextNativeReanimatedModuleSourceContents.replace(
          '<react/renderer/core/TraitCast.h>',
          '<react/renderer/core/LayoutableShadowNode.h>',
        );
      }

      if (nextNativeReanimatedModuleSourceContents.includes('#include <react/utils/CoreFeatures.h>')) {
        nextNativeReanimatedModuleSourceContents = nextNativeReanimatedModuleSourceContents.replace(
          '#include <react/utils/CoreFeatures.h>\n',
          '',
        );
        nextNativeReanimatedModuleSourceContents = nextNativeReanimatedModuleSourceContents.replace(
          '#include <react/utils/CoreFeatures.h>\r\n',
          '',
        );
      }

      if (
        nextNativeReanimatedModuleSourceContents.includes(
          'traitCast<LayoutableShadowNode const *>(newestCloneOfShadowNode.get())',
        )
      ) {
        nextNativeReanimatedModuleSourceContents = nextNativeReanimatedModuleSourceContents.replace(
          'traitCast<LayoutableShadowNode const *>(newestCloneOfShadowNode.get())',
          'dynamic_cast<LayoutableShadowNode const *>(newestCloneOfShadowNode.get())',
        );
      }

      if (nextNativeReanimatedModuleSourceContents.includes('shadowNodeFromValue(rt, shadowNodeWrapper)')) {
        nextNativeReanimatedModuleSourceContents =
          nextNativeReanimatedModuleSourceContents.replace(
            /auto (\w+) = shadowNodeFromValue\(rt, shadowNodeWrapper\);/g,
            'auto $1 = Bridging<std::shared_ptr<const ShadowNode>>::fromJs(rt, shadowNodeWrapper);',
          );
      }

      if (nextNativeReanimatedModuleSourceContents.includes('shadowNodeFromValue(rt, shadowNodeValue)')) {
        nextNativeReanimatedModuleSourceContents =
          nextNativeReanimatedModuleSourceContents.replace(
            /(ShadowNode::Shared|auto) (\w+) = shadowNodeFromValue\(rt, shadowNodeValue\);/g,
            'auto $2 = Bridging<std::shared_ptr<const ShadowNode>>::fromJs(rt, shadowNodeValue);',
          );
      }

      if (nextNativeReanimatedModuleSourceContents.includes('bool CoreFeatures::useNativeState;')) {
        nextNativeReanimatedModuleSourceContents = nextNativeReanimatedModuleSourceContents.replace(
          /#if REACT_NATIVE_MINOR_VERSION >= 73 && defined\(RCT_NEW_ARCH_ENABLED\)\r?\n\/\/ Android can't find the definition of this static field\r?\nbool CoreFeatures::useNativeState;\r?\n#endif\r?\n/m,
          '',
        );
      }

      if (
        nextNativeReanimatedModuleSourceContents.includes('/* .shouldYield = */ [this]() {')
      ) {
        nextNativeReanimatedModuleSourceContents =
          nextNativeReanimatedModuleSourceContents.replace(
            /#if REACT_NATIVE_MINOR_VERSION >= 72\r?\n\s*\/\* \.mountSynchronously = \*\/ true,\r?\n#endif\r?\n\s*\/\* \.shouldYield = \*\/ \[this\]\(\) \{\r?\n\s*return propsRegistry_->shouldReanimatedSkipCommit\(\);\r?\n\s*\}/m,
            '#if REACT_NATIVE_MINOR_VERSION >= 72\n'
              + '              /* .mountSynchronously = */ true,\n'
              + '#endif\n'
              + '              /* .source = */ ShadowTree::CommitSource::Unknown',
          );
      }

      if (nextNativeReanimatedModuleSourceContents !== nativeReanimatedModuleSourceContents) {
        await fs.writeFile(
          nativeReanimatedModuleSourcePath,
          nextNativeReanimatedModuleSourceContents,
        );
      }
    }

    return;
  }

  if (packageName !== '@react-native-oh-tpl/react-native-svg') {
    return;
  }

  const svgGeneratedPropsPath = path.join(
    directoryPath,
    'src',
    'main',
    'cpp',
    'generated',
    'react',
    'renderer',
    'components',
    'react_native_svg',
    'Props.h',
  );
  const svgPathComponentInstancePath = path.join(
    directoryPath,
    'src',
    'main',
    'cpp',
    'componentInstances',
    'RNSVGPathComponentInstance.h',
  );
  const svgImageComponentDescriptorPath = path.join(
    directoryPath,
    'src',
    'main',
    'cpp',
    'svgImage',
    'RNSVGImageComponentDescriptor.h',
  );
  const svgImageShadowNodePath = path.join(
    directoryPath,
    'src',
    'main',
    'cpp',
    'svgImage',
    'RNSVGImageShadowNode.h',
  );

  if (await fs.pathExists(svgGeneratedPropsPath)) {
    const svgGeneratedPropsContents = await fs.readFile(svgGeneratedPropsPath, 'utf8');

    if (svgGeneratedPropsContents.includes('butter::map<std::string, RawValue>')) {
      await fs.writeFile(
        svgGeneratedPropsPath,
        svgGeneratedPropsContents.replace(
          /butter::map<std::string, RawValue>/g,
          'std::unordered_map<std::string, RawValue>',
        ),
      );
    }
  }

  if (await fs.pathExists(svgImageComponentDescriptorPath)) {
    const svgImageComponentDescriptorContents = await fs.readFile(
      svgImageComponentDescriptorPath,
      'utf8',
    );
    let nextSvgImageComponentDescriptorContents = svgImageComponentDescriptorContents;

    if (
      nextSvgImageComponentDescriptorContents.includes(
        'void adopt(ShadowNode::Unshared const &shadowNode) const override {',
      )
    ) {
      nextSvgImageComponentDescriptorContents =
        nextSvgImageComponentDescriptorContents.replace(
          'void adopt(ShadowNode::Unshared const &shadowNode) const override {',
          'void adopt(ShadowNode& shadowNode) const override {',
        );
    }

    if (
      nextSvgImageComponentDescriptorContents.includes(
        'auto imageShadowNode = std::static_pointer_cast<RNSVGImageShadowNode>(shadowNode);',
      )
    ) {
      nextSvgImageComponentDescriptorContents =
        nextSvgImageComponentDescriptorContents.replace(
          'auto imageShadowNode = std::static_pointer_cast<RNSVGImageShadowNode>(shadowNode);',
          'auto& imageShadowNode = static_cast<RNSVGImageShadowNode&>(shadowNode);',
        );
    }

    if (nextSvgImageComponentDescriptorContents.includes('imageShadowNode->setImageManager(imageManager_);')) {
      nextSvgImageComponentDescriptorContents =
        nextSvgImageComponentDescriptorContents.replace(
          'imageShadowNode->setImageManager(imageManager_);',
          'imageShadowNode.setImageManager(imageManager_);',
        );
    }

    if (nextSvgImageComponentDescriptorContents !== svgImageComponentDescriptorContents) {
      await fs.writeFile(
        svgImageComponentDescriptorPath,
        nextSvgImageComponentDescriptorContents,
      );
    }
  }

  if (await fs.pathExists(svgImageShadowNodePath)) {
    const svgImageShadowNodeContents = await fs.readFile(svgImageShadowNodePath, 'utf8');
    let nextSvgImageShadowNodeContents = svgImageShadowNodeContents;
    const svgImageShadowNodeNewline = svgImageShadowNodeContents.includes('\r\n') ? '\r\n' : '\n';

    if (
      !nextSvgImageShadowNodeContents.includes(
        '#include <react/renderer/core/ShadowNodeFamily.h>',
      )
      && nextSvgImageShadowNodeContents.includes(
        '#include <react/renderer/components/view/ConcreteViewShadowNode.h>',
      )
    ) {
      nextSvgImageShadowNodeContents = nextSvgImageShadowNodeContents.replace(
        '#include <react/renderer/components/view/ConcreteViewShadowNode.h>',
        '#include <react/renderer/components/view/ConcreteViewShadowNode.h>'
          + `${svgImageShadowNodeNewline}#include <react/renderer/core/ShadowNodeFamily.h>`,
      );
    }

    const svgImageInitialStateSignaturePattern =
      /static RNSVGImageState initialStateData\(ShadowNodeFragment const &fragment,\r?\n\s*ShadowNodeFamilyFragment const &familyFragment,\r?\n\s*ComponentDescriptor const &componentDescriptor\) \{/m;

    if (svgImageInitialStateSignaturePattern.test(nextSvgImageShadowNodeContents)) {
      nextSvgImageShadowNodeContents = nextSvgImageShadowNodeContents.replace(
        svgImageInitialStateSignaturePattern,
        'static RNSVGImageState initialStateData(const Props::Shared& /*props*/,'
          + `${svgImageShadowNodeNewline}`
          + '                                            const ShadowNodeFamily::Shared& /*family*/,'
          + `${svgImageShadowNodeNewline}`
          + '                                            const ComponentDescriptor& /*componentDescriptor*/) {',
      );
    }

    if (nextSvgImageShadowNodeContents !== svgImageShadowNodeContents) {
      await fs.writeFile(svgImageShadowNodePath, nextSvgImageShadowNodeContents);
    }
  }

  if (!(await fs.pathExists(svgPathComponentInstancePath))) {
    return;
  }

  const svgPathComponentInstanceContents = await fs.readFile(svgPathComponentInstancePath, 'utf8');

  if (!svgPathComponentInstanceContents.includes('Float m_cacheScale;')) {
    return;
  }

  await fs.writeFile(
    svgPathComponentInstancePath,
    svgPathComponentInstanceContents.replace(
      'Float m_cacheScale;',
      'facebook::react::Float m_cacheScale;',
    ),
  );
}

function createGestureHandlerCompatibilityDescriptorHeader(
  componentName: 'RNGestureHandlerButton' | 'RNGestureHandlerRootView',
): string {
  return [
    '#pragma once',
    '',
    '#include <react/renderer/components/view/ConcreteViewShadowNode.h>',
    '#include <react/renderer/core/ConcreteComponentDescriptor.h>',
    '',
    'namespace facebook::react {',
    '',
    `inline constexpr char ${componentName}ComponentName[] = "${componentName}";`,
    '',
    `using ${componentName}ShadowNode = ConcreteViewShadowNode<${componentName}ComponentName>;`,
    `using ${componentName}ComponentDescriptor = ConcreteComponentDescriptor<${componentName}ShadowNode>;`,
    '',
    '} // namespace facebook::react',
    '',
  ].join('\n');
}

function patchGestureHandlerCompatibilityPackageHeader(contents: string): string {
  if (contents.includes('createComponentDescriptorProviders() override;')) {
    return contents;
  }

  return contents.replace(
    '    std::vector<ArkTSMessageHandler::Shared> createArkTSMessageHandlers() override;\n',
    [
      '    std::vector<facebook::react::ComponentDescriptorProvider> createComponentDescriptorProviders() override;',
      '',
      '    ComponentJSIBinderByString createComponentJSIBinderByName() override;',
      '',
      '    std::vector<ArkTSMessageHandler::Shared> createArkTSMessageHandlers() override;',
    ].join('\n'),
  );
}

function patchGestureHandlerCompatibilityPackageSource(contents: string): string {
  let nextContents = contents;

  if (
    !nextContents.includes(
      '#include "RNOHCorePackage/ComponentBinders/ViewComponentJSIBinder.h"',
    )
  ) {
    nextContents = nextContents.replace(
      '#include "RNOH/RNInstanceCAPI.h"\n',
      '#include "RNOH/RNInstanceCAPI.h"\n#include "RNOHCorePackage/ComponentBinders/ViewComponentJSIBinder.h"\n',
    );
  }

  if (
    !nextContents.includes(
      '#include "generated/RNGestureHandlerButtonComponentDescriptor.h"',
    )
  ) {
    nextContents = nextContents.replace(
      '#include "componentInstances/RNGestureHandlerRootViewComponentInstance.h"\n',
      '#include "componentInstances/RNGestureHandlerRootViewComponentInstance.h"\n#include "generated/RNGestureHandlerButtonComponentDescriptor.h"\n#include "generated/RNGestureHandlerRootViewComponentDescriptor.h"\n',
    );
  }

  if (!nextContents.includes('class RNGestureHandlerComponentJSIBinder')) {
    nextContents = nextContents.replace(
      'using namespace rnoh;\nusing namespace facebook;\n\n',
      [
        'using namespace rnoh;',
        'using namespace facebook;',
        '',
        'class RNGestureHandlerComponentJSIBinder : public ViewComponentJSIBinder {',
        'protected:',
        '    facebook::jsi::Object createNativeProps(facebook::jsi::Runtime &rt) override {',
        '        auto nativeProps = ViewComponentJSIBinder::createNativeProps(rt);',
        '        nativeProps.setProperty(rt, "exclusive", "boolean");',
        '        nativeProps.setProperty(rt, "foreground", "boolean");',
        '        nativeProps.setProperty(rt, "borderless", "boolean");',
        '        nativeProps.setProperty(rt, "enabled", "boolean");',
        '        nativeProps.setProperty(rt, "rippleColor", "Color");',
        '        nativeProps.setProperty(rt, "rippleRadius", "number");',
        '        nativeProps.setProperty(rt, "touchSoundDisabled", "boolean");',
        '        return nativeProps;',
        '    }',
        '',
        '    facebook::jsi::Object createDirectEventTypes(facebook::jsi::Runtime &rt) override {',
        '        auto events = ViewComponentJSIBinder::createDirectEventTypes(rt);',
        '        events.setProperty(rt, "onGestureHandlerEvent", createDirectEvent(rt, "onGestureHandlerEvent"));',
        '        events.setProperty(',
        '            rt,',
        '            "onGestureHandlerStateChange",',
        '            createDirectEvent(rt, "onGestureHandlerStateChange"));',
        '        events.setProperty(rt, "topOnGestureHandlerEvent", createDirectEvent(rt, "onGestureHandlerEvent"));',
        '        events.setProperty(',
        '            rt,',
        '            "topOnGestureHandlerStateChange",',
        '            createDirectEvent(rt, "onGestureHandlerStateChange"));',
        '        return events;',
        '    }',
        '};',
        '',
      ].join('\n'),
    );
  }

  if (
    !nextContents.includes(
      'RnohReactNativeHarmonyGestureHandlerPackage::createComponentDescriptorProviders()',
    )
  ) {
    nextContents = nextContents.replace(
      'EventEmitRequestHandlers RnohReactNativeHarmonyGestureHandlerPackage::createEventEmitRequestHandlers() {\n',
      [
        'std::vector<facebook::react::ComponentDescriptorProvider>',
        'RnohReactNativeHarmonyGestureHandlerPackage::createComponentDescriptorProviders() {',
        '    return {',
        '        facebook::react::concreteComponentDescriptorProvider<',
        '            facebook::react::RNGestureHandlerButtonComponentDescriptor>(),',
        '        facebook::react::concreteComponentDescriptorProvider<',
        '            facebook::react::RNGestureHandlerRootViewComponentDescriptor>(),',
        '    };',
        '}',
        '',
        'ComponentJSIBinderByString',
        'RnohReactNativeHarmonyGestureHandlerPackage::createComponentJSIBinderByName() {',
        '    auto componentJSIBinder = std::make_shared<RNGestureHandlerComponentJSIBinder>();',
        '    return {',
        '        {"RNGestureHandlerButton", componentJSIBinder},',
        '        {"RNGestureHandlerRootView", componentJSIBinder},',
        '    };',
        '}',
        '',
        'EventEmitRequestHandlers RnohReactNativeHarmonyGestureHandlerPackage::createEventEmitRequestHandlers() {',
      ].join('\n'),
    );
  }

  return nextContents;
}
