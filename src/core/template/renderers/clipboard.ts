export function renderExpoHarmonyClipboardTurboModule(): string {
  return String.raw`import pasteboard from '@ohos.pasteboard';
import abilityAccessCtrl from '@ohos.abilityAccessCtrl';
import image from '@ohos.multimedia.image';
import util from '@ohos.util';
import url from '@ohos.url';
import { UITurboModule, UITurboModuleContext } from '@rnoh/react-native-openharmony/ts';

type ClipboardImage = { data: string; size: { width: number; height: number } };

export class ExpoHarmonyClipboardTurboModule extends UITurboModule {
  public static readonly NAME = 'ExpoHarmonyClipboard';
  private readonly board = pasteboard.getSystemPasteboard();
  private readonly onUpdate = (): void => {
    this.ctx.rnInstance.emitDeviceEvent('ExpoHarmonyClipboardChanged', { contentTypes: this.contentTypes() });
  };

  constructor(ctx: UITurboModuleContext) {
    super(ctx);
    this.board.on('update', this.onUpdate);
  }

  override __onDestroy__(): void {
    this.board.off('update', this.onUpdate);
    super.__onDestroy__();
  }

  async setString(value: string, format: string): Promise<void> {
    if (format !== 'plainText' && format !== 'html') throw new Error('Invalid clipboard text format.');
    await this.board.setData(format === 'html' ? pasteboard.createHtmlData(value) : pasteboard.createPlainTextData(value));
  }

  async getString(format: string): Promise<string> {
    if (format !== 'plainText' && format !== 'html') throw new Error('Invalid clipboard text format.');
    const data = await this.read();
    if (!data) return '';
    return (format === 'html' ? data.getPrimaryHtml() : data.getPrimaryText()) ?? '';
  }

  async setUrl(value: string): Promise<void> {
    url.URL.parseURL(value);
    const data = pasteboard.createUriData(value);
    data.addRecord(pasteboard.createPlainTextRecord(value));
    await this.board.setData(data);
  }

  async getUrl(): Promise<string | null> {
    const data = await this.read();
    if (!data) return null;
    const value = data.getPrimaryUri() || data.getPrimaryText();
    if (!value) return null;
    try { url.URL.parseURL(value); return value; } catch (_) { return null; }
  }

  async setImage(base64: string): Promise<void> {
    if (base64.length > 8 * 1024 * 1024 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
      throw new Error('Clipboard image must be valid base64 no larger than 8 MiB.');
    }
    const bytes = new util.Base64Helper().decodeSync(base64);
    const source = image.createImageSource(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    let pixels: image.PixelMap | null = null;
    try {
      const info = await source.getImageInfo();
      if (info.size.width * info.size.height > 32 * 1024 * 1024) throw new Error('Clipboard image dimensions are too large.');
      pixels = await source.createPixelMap();
      await this.board.setData(pasteboard.createData(pasteboard.MIMETYPE_PIXELMAP, pixels));
    } finally {
      if (pixels) await pixels.release();
      await source.release();
    }
  }

  async getImage(format: string, quality: number): Promise<ClipboardImage | null> {
    if ((format !== 'png' && format !== 'jpeg') || !Number.isFinite(quality) || quality < 0 || quality > 1) {
      throw new Error('Invalid clipboard image format or quality.');
    }
    const data = await this.read();
    if (!data || !data.hasMimeType(pasteboard.MIMETYPE_PIXELMAP)) return null;
    const pixels = data.getPrimaryPixelMap();
    if (!pixels) return null;
    const packer = image.createImagePacker();
    try {
      const info = await pixels.getImageInfo();
      if (info.size.width * info.size.height > 32 * 1024 * 1024) throw new Error('Clipboard image dimensions are too large.');
      const bytes = await packer.packing(pixels, { format: 'image/' + format, quality: Math.round(quality * 100) });
      return {
        data: 'data:image/' + format + ';base64,' + new util.Base64Helper().encodeToStringSync(new Uint8Array(bytes)),
        size: { width: info.size.width, height: info.size.height },
      };
    } finally {
      await packer.release();
      await pixels.release();
    }
  }

  async getContentTypes(): Promise<string[]> { return this.contentTypes(); }

  private contentTypes(): string[] {
    const types: string[] = [];
    if (this.board.hasDataType(pasteboard.MIMETYPE_TEXT_PLAIN)) types.push('plain-text');
    if (this.board.hasDataType(pasteboard.MIMETYPE_TEXT_HTML)) types.push('html');
    if (this.board.hasDataType(pasteboard.MIMETYPE_TEXT_URI)) types.push('url');
    if (this.board.hasDataType(pasteboard.MIMETYPE_PIXELMAP)) types.push('image');
    return types;
  }

  private async read(): Promise<pasteboard.PasteData | null> {
    if (!(await this.board.hasData())) return null;
    const manager = abilityAccessCtrl.createAtManager();
    const accessTokenId = this.ctx.uiAbilityContext.abilityInfo.applicationInfo.accessTokenId;
    if (manager.checkAccessTokenSync(accessTokenId, 'ohos.permission.READ_PASTEBOARD') !== abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED) {
      const result = await manager.requestPermissionsFromUser(this.ctx.uiAbilityContext, ['ohos.permission.READ_PASTEBOARD']);
      if (result.authResults[0] !== abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED) throw new Error('Clipboard read permission denied.');
    }
    return this.board.getData();
  }
}
`;
}
