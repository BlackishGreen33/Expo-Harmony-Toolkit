export function renderExpoHarmonyCameraView(): string {
  return String.raw`import { RNComponentContext } from '@rnoh/react-native-openharmony';
import { ExpoHarmonyCameraTurboModule } from './ExpoHarmonyCameraTurboModule';

@Component
export struct ExpoHarmonyCameraView {
  ctx!: RNComponentContext;
  tag: number = 0;
  @State viewWidth: number = 0;
  @State viewHeight: number = 0;
  @State viewX: number = 0;
  @State viewY: number = 0;
  private controller: XComponentController = new XComponentController();
  private surface: string = '';
  private previewKey: string = '';
  private viewId: string = '';
  private cleanup: (() => void)[] = [];
  private active: boolean = true;

  private module(): ExpoHarmonyCameraTurboModule {
    return this.ctx.rnInstance.getTurboModule<ExpoHarmonyCameraTurboModule>(ExpoHarmonyCameraTurboModule.NAME);
  }

  aboutToAppear(): void {
    this.cleanup = [
      this.ctx.descriptorRegistry.subscribeToDescriptorChanges(this.tag, () => this.refresh()),
      this.ctx.rnInstance.subscribeToLifecycleEvents('BACKGROUND', () => { this.active = false; this.stop(); }),
      this.ctx.rnInstance.subscribeToLifecycleEvents('FOREGROUND', () => { this.active = true; this.refresh(); }),
    ];
    this.refresh();
  }

  aboutToDisappear(): void {
    for (const cleanup of this.cleanup) cleanup();
    this.cleanup = [];
    this.active = false;
    this.stop();
  }

  private stop(): void {
    this.previewKey = '';
    if (this.viewId) void this.module().disposePreview({ viewId: this.viewId }).catch(() => {});
  }

  private refresh(): void {
    const descriptor = this.ctx.descriptorRegistry.getDescriptor(this.tag);
    if (!descriptor) return;
    this.viewWidth = descriptor.layoutMetrics.frame.size.width;
    this.viewHeight = descriptor.layoutMetrics.frame.size.height;
    this.viewX = descriptor.layoutMetrics.frame.origin.x;
    this.viewY = descriptor.layoutMetrics.frame.origin.y;
    const props = descriptor.rawProps as Record<string, string>;
    const viewId = String(props.viewId ?? '');
    const facing = String(props.facing ?? 'back');
    const mode = String(props.mode ?? 'picture');
    if (!this.surface || !viewId || !this.active) return;
    const key = JSON.stringify([viewId, this.surface, facing, mode]);
    if (key === this.previewKey) return;
    if (this.viewId && this.viewId !== viewId) this.stop();
    this.viewId = viewId;
    this.previewKey = key;
    void this.module().createPreview({ viewId, surfaceId: this.surface, facing, mode }).catch(() => {});
  }

  build() {
    XComponent({ id: 'expo-harmony-camera-' + this.tag, type: XComponentType.SURFACE, controller: this.controller })
      .renderFit(RenderFit.RESIZE_CONTAIN)
      .width(this.viewWidth).height(this.viewHeight)
      .position({ x: this.viewX, y: this.viewY })
      .onLoad(() => { this.surface = this.controller.getXComponentSurfaceId(); this.refresh(); })
      .onDestroy(() => { this.surface = ''; this.stop(); })
  }
}
`;
}
