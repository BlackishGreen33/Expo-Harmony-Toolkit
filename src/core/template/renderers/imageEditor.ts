export function renderExpoHarmonyImageEditor(): string {
  return `import image from '@ohos.multimedia.image';
import { ComponentContent } from '@ohos.arkui.node';
import { UIContext } from '@ohos.arkui.UIContext';
import display from '@ohos.display';

interface EditorParams {
  pixels: image.PixelMap;
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
  finish: (region: image.Region | null) => void;
};

@Component
struct ImageEditor {
  params!: EditorParams;
  @State zoom: number = 1;
  @State offsetX: number = 0;
  @State offsetY: number = 0;
  private startX: number = 0;
  private startY: number = 0;

  private factor(): number {
    return Math.max(this.params.frameWidth / this.params.width, this.params.frameHeight / this.params.height) * this.zoom;
  }

  private move(x: number, y: number): void {
    const maxX = (this.params.width * this.factor() - this.params.frameWidth) / 2;
    const maxY = (this.params.height * this.factor() - this.params.frameHeight) / 2;
    this.offsetX = Math.max(-maxX, Math.min(maxX, x));
    this.offsetY = Math.max(-maxY, Math.min(maxY, y));
  }

  private confirm(): void {
    const width = Math.max(1, Math.floor(this.params.frameWidth / this.factor()));
    const height = Math.max(1, Math.floor(this.params.frameHeight / this.factor()));
    this.params.finish({
      x: Math.max(0, Math.min(this.params.width - width, Math.round((this.params.width - width) / 2 - this.offsetX / this.factor()))),
      y: Math.max(0, Math.min(this.params.height - height, Math.round((this.params.height - height) / 2 - this.offsetY / this.factor()))),
      size: { width, height },
    });
  }

  build() {
    Column({ space: 12 }) {
      Text('裁切圖片').fontSize(20).fontColor(Color.Black)
      Text('拖動圖片調整位置，滑動調整縮放').fontSize(14).fontColor(Color.Black)
      Stack() {
        Image(this.params.pixels)
          .width(this.params.width * this.factor()).height(this.params.height * this.factor())
          .translate({ x: this.offsetX, y: this.offsetY })
      }
      .width(this.params.frameWidth).height(this.params.frameHeight).clip(true)
      .backgroundColor(Color.Black).border({ width: 1, color: Color.Gray })
      .gesture(PanGesture()
        .onActionStart(() => { this.startX = this.offsetX; this.startY = this.offsetY; })
        .onActionUpdate((event: GestureEvent) => { this.move(this.startX + event.offsetX, this.startY + event.offsetY); }))
      Slider({ value: this.zoom, min: 1, max: 4, step: 0.05 })
        .width(this.params.frameWidth).accessibilityText('圖片縮放')
        .onChange((value: number) => { this.zoom = value; this.move(this.offsetX, this.offsetY); })
      Row({ space: 16 }) {
        Button('取消').onClick(() => this.params.finish(null))
        Button('使用圖片').onClick(() => this.confirm())
      }
    }.padding(16).backgroundColor(Color.White).borderRadius(16)
  }
}

@Builder
function buildEditor(params: EditorParams) {
  ImageEditor({ params })
}

export function selectCrop(context: UIContext, pixels: image.PixelMap, width: number, height: number, aspect: number[]): Promise<image.Region | null> {
  const screen = display.getDefaultDisplaySync();
  const ratio = aspect[0] / aspect[1];
  const frameWidth = Math.min(300, context.px2vp(screen.width) - 64, Math.max(80, context.px2vp(screen.height) - 260) * ratio);
  if (!Number.isFinite(ratio) || frameWidth < 1 || frameWidth / ratio < 1) throw new Error('Requested image aspect is too narrow to display.');
  const prompt = context.getPromptAction();
  return new Promise<image.Region | null>((resolve, reject) => {
    let settled = false;
    const params: EditorParams = {
      pixels, width, height, frameWidth, frameHeight: frameWidth / ratio,
      finish: (region: image.Region | null): void => {
        if (settled) return;
        settled = true;
        prompt.closeCustomDialog(content).then(() => resolve(region)).catch(reject);
      },
    };
    const content = new ComponentContent<EditorParams>(context, wrapBuilder(buildEditor), params);
    prompt.openCustomDialog(content, {
      autoCancel: true,
      onDidDisappear: (): void => {
        if (!settled) { settled = true; resolve(null); }
        content.dispose();
      },
    }).catch((error: Error) => { content.dispose(); reject(error); });
  });
}
`;
}
