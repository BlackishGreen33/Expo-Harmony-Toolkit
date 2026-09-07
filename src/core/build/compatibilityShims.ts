import fs from 'fs-extra';
import path from 'path';

export async function ensureNormalizedLocalHarCompatibilityShims(
  directoryPath: string,
  packageName: string,
): Promise<void> {
  if (packageName === '@rnoh/react-native-openharmony') {
    const filePath = path.join(directoryPath, 'src/main/ets/RNOH/RNInstancesCoordinator.ets');
    if (await fs.pathExists(filePath)) {
      const contents = await fs.readFile(filePath, 'utf8');
      const newline = contents.includes('\r\n') ? '\r\n' : '\n';
      // The UI context receives launchURI, but the worker's LinkingManager uses the registry.
      const patched = contents.replace(
        /this\.rnInstanceRegistry = new RNInstanceRegistry\([\s\S]*?\r?\n[ \t]*\)/,
        (registry) => registry.replace(
          /(\r?\n([ \t]+)\})(\r?\n[ \t]*\))$/,
          `$1,${newline}$2options?.launchURI$3`,
        ),
      );
      if (patched !== contents) await fs.writeFile(filePath, patched);
    }
    return;
  }

  if (packageName === '@react-native-oh-tpl/react-native-webview') {
    const filePath = path.join(directoryPath, 'src/main/ets/RNCWebViewPackage.ets');
    if (await fs.pathExists(filePath)) {
      const contents = await fs.readFile(filePath, 'utf8');
      // The adapter registers its descriptor and TurboModule, but not the ArkUI view builder.
      if (!contents.includes('createWrappedCustomRNComponentBuilderByComponentNameMap')) {
        const newline = contents.includes('\r\n') ? '\r\n' : '\n';
        const patched = contents.replace(
          /export class RNCWebViewPackage extends RNOHPackage\s*\{/,
          `import type { ComponentBuilderContext } from '@rnoh/react-native-openharmony';
import { RNCWebView } from './RNCWebView';

@Builder
function buildWebView(ctx: ComponentBuilderContext) {
  RNCWebView({ ctx: ctx.rnComponentContext, tag: ctx.tag })
}

export class RNCWebViewPackage extends RNOHPackage {
  createWrappedCustomRNComponentBuilderByComponentNameMap(): Map<string, WrappedBuilder<[ComponentBuilderContext]>> {
    return new Map().set('RNCWebView', wrapBuilder(buildWebView));
  }
`.replace(/\n/g, newline),
        );
        if (patched !== contents) await fs.writeFile(filePath, patched);
      }
    }
    return;
  }

  if (packageName === '@react-native-oh-tpl/camera-roll') {
    const filePath = path.join(directoryPath, 'src/main/ets/CameraRollTurboModule.ts');
    if (await fs.pathExists(filePath)) {
      const contents = await fs.readFile(filePath, 'utf8');
      const patched = contents
        // Stripping file:/// also stripped the root slash, producing an invalid relative URI.
        .replace("uriStr = uriStr.replace(/^file:\\/+/i, '');", 'uriStr = decodeURIComponent(uriObj.path);')
        .replace(/private dialogQueue = \[\];\s*private isDialogOpen = false;/, 'private saveQueue: Promise<void> = Promise.resolve();')
        // Propagate dialog rejection and release the queue for subsequent saves.
        .replace(/  async showDialog\(\) \{[\s\S]*?(?=  private getUriOnSandboxPath)/, `  getAssetsPermissionResult(saveUris: string[], photoCreationConfigs: photoAccessHelper.PhotoCreationConfig[]): Promise<string[]> {
    const result = this.saveQueue.then(() => this.phAccessHelper.showAssetsCreationDialog(saveUris, photoCreationConfigs));
    this.saveQueue = result.then(() => undefined, () => undefined);
    return result;
  }

`)
        .replace(/(Logger\.error\(`saveToDevice error: \$\{e\}`\);)(?!\s*throw e;)/, '$1\n        throw e;')
        .replace(/(} else \{\s*if \(resourceType\) \{\s*fs\.unlinkSync\(saveUri\);\s*\})\s*\}/, '$1\n      throw new Error("Photo save was canceled");\n    }');
      if (patched !== contents) await fs.writeFile(filePath, patched);
    }
    return;
  }

  if (packageName === '@react-native-oh-tpl/react-native-skia') {
    const filePath = path.join(directoryPath, 'src/main/ets/RNSkiaModule.ts');
    if (await fs.pathExists(filePath)) {
      const contents = await fs.readFile(filePath, 'utf8');
      // RNOH already unwraps the native Result; getNativeNodeIdByTag returns the string itself.
      const patched = contents.replace(
        /let obj = JSON\.parse\(JSON\.stringify\(this\.ctx\.rnInstance\.getNativeNodeIdByTag\(tag\)\)\);\s+let id = obj\.ok;/,
        'let id = this.ctx.rnInstance.getNativeNodeIdByTag(tag);\n      if (typeof id !== "string") throw new Error("Skia snapshot view is not mounted");',
      );
      if (patched !== contents) await fs.writeFile(filePath, patched);
    }
    const packagePath = path.join(directoryPath, 'src/main/ets/RNSkiaPackage.ts');
    if (await fs.pathExists(packagePath)) {
      const contents = await fs.readFile(packagePath, 'utf8');
      const newline = contents.includes('\r\n') ? '\r\n' : '\n';
      // RNOH collects ArkUI builders only from RNOHPackage subclasses. Keep the legacy
      // factory implementation, but export an ArkTS package that also registers its views.
      const patched = contents.replace(/export class RNSkiaPackage extends RNPackage\s*\{/, `@Builder
function buildSkiaDomView(ctx: ComponentBuilderContext) {
  RNCSkiaDomView({ ctx: ctx.rnComponentContext, tag: ctx.tag })
}

@Builder
function buildSkiaPictureView(ctx: ComponentBuilderContext) {
  RNCSkiaPictureView({ ctx: ctx.rnComponentContext, tag: ctx.tag })
}

export class RNSkiaPackage extends RNOHPackage {
  createWrappedCustomRNComponentBuilderByComponentNameMap(): Map<string, WrappedBuilder<[ComponentBuilderContext]>> {
    return new Map()
      .set('SkiaDomView', wrapBuilder(buildSkiaDomView))
      .set('SkiaPictureView', wrapBuilder(buildSkiaPictureView));
  }
`.replace(/\n/g, newline));
      if (patched !== contents) {
        const imports = `import { RNOHPackage, ComponentBuilderContext } from '@rnoh/react-native-openharmony';
import { RNCSkiaDomView } from './RNCSkiaDomView';
import { RNCSkiaPictureView } from './RNCSkiaPictureView';
`;
        await fs.writeFile(path.join(directoryPath, 'src/main/ets/RNOHSkiaPackage.ets'), imports.replace(/\n/g, newline) + patched);
        const etsEntryPath = path.join(directoryPath, 'ts.ets');
        const entryPath = await fs.pathExists(etsEntryPath) ? etsEntryPath : path.join(directoryPath, 'ts.ts');
        const entry = await fs.readFile(entryPath, 'utf8');
        await fs.writeFile(etsEntryPath, entry.replace('./src/main/ets/RNSkiaPackage', './src/main/ets/RNOHSkiaPackage'));
        if (entryPath !== etsEntryPath) await fs.remove(entryPath);
      }
    }
    return;
  }

  if (packageName === '@react-native-oh-tpl/lottie-react-native') {
    const entryPath = path.join(directoryPath, 'index.ets');
    if (await fs.pathExists(entryPath)) {
      const entry = await fs.readFile(entryPath, 'utf8');
      if (!entry.includes('./src/main/ets/RNOHLottiePackage')) {
        const newline = entry.includes('\r\n') ? '\r\n' : '\n';
        await fs.outputFile(path.join(directoryPath, 'src/main/ets/RNOHLottiePackage.ets'), `import { RNOHPackage, ComponentBuilderContext } from '@rnoh/react-native-openharmony';
import { LottieAnimationView, LOTTIE_TYPE } from './LottieAnimationView';

@Builder
function buildLottieView(ctx: ComponentBuilderContext) {
  LottieAnimationView({ ctx: ctx.rnComponentContext, tag: ctx.tag })
}

export class RNOHLottiePackage extends RNOHPackage {
  createWrappedCustomRNComponentBuilderByComponentNameMap(): Map<string, WrappedBuilder<[ComponentBuilderContext]>> {
    return new Map().set(LOTTIE_TYPE, wrapBuilder(buildLottieView));
  }
}
`.replace(/\n/g, newline));
        await fs.writeFile(entryPath, `${entry}${newline}export * from './src/main/ets/RNOHLottiePackage';${newline}`);
      }
    }
    // The ArkTS implementation reads an array, but this adapter's C++ prop was a string.
    const replacements = [
      ['Props.h', 'std::string colorFilters{};', 'folly::dynamic colorFilters = folly::dynamic::array();'],
      ['Props.cpp', 'sourceProps.colorFilters, {}', 'sourceProps.colorFilters, folly::dynamic::array()'],
      ['LottieAnimationViewJSIBinder.h', '"colorFilters", "string"', '"colorFilters", "Object"'],
    ];
    for (const [file, from, to] of replacements) {
      const filePath = path.join(directoryPath, 'src/main/cpp', file);
      if (!(await fs.pathExists(filePath))) continue;
      const contents = await fs.readFile(filePath, 'utf8');
      let patched = contents.replace(from, to);
      if (file === 'Props.h' && patched !== contents && !patched.includes('#include <folly/dynamic.h>')) {
        const newline = contents.includes('\r\n') ? '\r\n' : '\n';
        patched = patched.replace('#include <jsi/jsi.h>', `#include <jsi/jsi.h>${newline}#include <folly/dynamic.h>`);
      }
      if (patched !== contents) await fs.writeFile(filePath, patched);
    }
    return;
  }

  if (packageName === '@react-native-oh-tpl/react-native-screens') {
    const packagePath = path.join(directoryPath, 'src/main/ets/RNOHScreensPackage.ets');
    if (await fs.pathExists(packagePath)) {
      const contents = await fs.readFile(packagePath, 'utf8');
      // Screens 4.8.1-rc.3 ships this builder but omits its registration, dropping all screen content.
      if (contents.includes('import { RNSScreenContentWrapper }') && !/\.set\(RNSScreenContentWrapper\.NAME,/.test(contents)) {
        const newline = contents.includes('\r\n') ? '\r\n' : '\n';
        const patched = contents.replace(
          /(^[ \t]*)\.set\(RNSSearchBar\.NAME, wrapBuilder\(componentBuilder\)\)/m,
          `$&${newline}$1.set(RNSScreenContentWrapper.NAME, wrapBuilder(componentBuilder))`,
        );
        if (patched !== contents) await fs.writeFile(packagePath, patched);
      }
    }
    const stackPath = path.join(directoryPath, 'src/main/ets/components/RNSScreenStack.ets');
    if (await fs.pathExists(stackPath)) {
      const contents = await fs.readFile(stackPath, 'utf8');
      // The descriptor watcher already initializes the paths. A duplicate initial path makes back
      // navigation reveal an obsolete screen after replace(), including Expo Router's empty index.
      if (contents.includes('this.updateStack(newChildren)')) {
        const patched = contents.replace(
          /^[ \t]*this\.stackController\.pushPathByName\(this\.stack\[0\]\.toString\(\), null\)\r?\n/m,
          '',
        );
        if (patched !== contents) await fs.writeFile(stackPath, patched);
      }
    }
    return;
  }

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
  let nextContents = contents;

  if (!nextContents.includes('createTurboModuleFactoryDelegate() override;')) {
    nextContents = nextContents.replace(
      /    EventEmitRequestHandlers createEventEmitRequestHandlers\(\);\r?\n/,
      [
        '    std::unique_ptr<TurboModuleFactoryDelegate> createTurboModuleFactoryDelegate() override;',
        '',
        '    EventEmitRequestHandlers createEventEmitRequestHandlers();',
        '',
      ].join('\n'),
    );
  }

  if (nextContents.includes('createComponentDescriptorProviders() override;')) {
    return nextContents;
  }

  return nextContents.replace(
    /    std::vector<ArkTSMessageHandler::Shared> createArkTSMessageHandlers\(\) override;\r?\n/,
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
      /#include "RNOH\/RNInstanceCAPI\.h"\r?\n/,
      '#include "RNOH/RNInstanceCAPI.h"\n#include "RNOH/ArkTSTurboModule.h"\n#include "RNOHCorePackage/ComponentBinders/ViewComponentJSIBinder.h"\n',
    );
  } else if (!nextContents.includes('#include "RNOH/ArkTSTurboModule.h"')) {
    nextContents = nextContents.replace(
      /#include "RNOH\/RNInstanceCAPI\.h"\r?\n/,
      '#include "RNOH/RNInstanceCAPI.h"\n#include "RNOH/ArkTSTurboModule.h"\n',
    );
  }

  if (
    !nextContents.includes(
      '#include "generated/RNGestureHandlerButtonComponentDescriptor.h"',
    )
  ) {
    nextContents = nextContents.replace(
      /#include "componentInstances\/RNGestureHandlerRootViewComponentInstance\.h"\r?\n/,
      '#include "componentInstances/RNGestureHandlerRootViewComponentInstance.h"\n#include "generated/RNGestureHandlerButtonComponentDescriptor.h"\n#include "generated/RNGestureHandlerRootViewComponentDescriptor.h"\n',
    );
  }

  if (!nextContents.includes('class RNGestureHandlerComponentJSIBinder')) {
    nextContents = nextContents.replace(
      /using namespace rnoh;\r?\nusing namespace facebook;\r?\n\r?\n/,
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

  if (!nextContents.includes('class RNGestureHandlerTurboModule : public ArkTSTurboModule')) {
    nextContents = nextContents.replace(
      /using namespace rnoh;\r?\nusing namespace facebook;\r?\n\r?\n/,
      [
        'using namespace rnoh;',
        'using namespace facebook;',
        '',
        'class RNGestureHandlerTurboModule : public ArkTSTurboModule {',
        'public:',
        '    RNGestureHandlerTurboModule(const ArkTSTurboModule::Context ctx, const std::string name)',
        '        : ArkTSTurboModule(ctx, name) {',
        '        methodMap_ = {',
        '            ARK_METHOD_METADATA(handleSetJSResponder, 2),',
        '            ARK_METHOD_METADATA(handleClearJSResponder, 0),',
        '            ARK_METHOD_METADATA(createGestureHandler, 3),',
        '            ARK_METHOD_METADATA(attachGestureHandler, 3),',
        '            ARK_METHOD_METADATA(updateGestureHandler, 2),',
        '            ARK_METHOD_METADATA(dropGestureHandler, 1),',
        '            ARK_METHOD_METADATA(install, 0),',
        '            ARK_METHOD_METADATA(flushOperations, 0),',
        '        };',
        '    }',
        '};',
        '',
        'class RNGestureHandlerTurboModuleFactoryDelegate : public TurboModuleFactoryDelegate {',
        'public:',
        '    SharedTurboModule createTurboModule(Context ctx, const std::string &name) const override {',
        '        if (name == "RNGestureHandlerModule") {',
        '            return std::make_shared<RNGestureHandlerTurboModule>(ctx, name);',
        '        }',
        '        return nullptr;',
        '    };',
        '};',
        '',
      ].join('\n'),
    );
  }

  if (
    !nextContents.includes(
      'RnohReactNativeHarmonyGestureHandlerPackage::createTurboModuleFactoryDelegate()',
    )
  ) {
    nextContents = nextContents.replace(
      /EventEmitRequestHandlers RnohReactNativeHarmonyGestureHandlerPackage::createEventEmitRequestHandlers\(\) \{\r?\n/,
      [
        'std::unique_ptr<TurboModuleFactoryDelegate>',
        'RnohReactNativeHarmonyGestureHandlerPackage::createTurboModuleFactoryDelegate() {',
        '    return std::make_unique<RNGestureHandlerTurboModuleFactoryDelegate>();',
        '}',
        '',
        'EventEmitRequestHandlers RnohReactNativeHarmonyGestureHandlerPackage::createEventEmitRequestHandlers() {\n',
      ].join('\n'),
    );
  }

  if (
    !nextContents.includes(
      'RnohReactNativeHarmonyGestureHandlerPackage::createComponentDescriptorProviders()',
    )
  ) {
    nextContents = nextContents.replace(
      /EventEmitRequestHandlers RnohReactNativeHarmonyGestureHandlerPackage::createEventEmitRequestHandlers\(\) \{\r?\n/,
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
        'EventEmitRequestHandlers RnohReactNativeHarmonyGestureHandlerPackage::createEventEmitRequestHandlers() {\n',
      ].join('\n'),
    );
  }

  return nextContents;
}
