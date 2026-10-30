export interface StudioNode {
  id: string | number; type: 'text' | 'list' | 'image'; x?: number; y?: number;
  width?: number; height?: number; padding?: number; gray?: number;
  border?: number; radius?: number; z?: number; capture?: boolean; text?: string;
  items?: string[]; selected?: number; data?: string; pixels?: number[];
}
export interface StudioOptions { origin?: string; window?: Window }
export declare function isStudioPreview(window?: Window): boolean;
export declare function createStudioClient(options?: StudioOptions): {
  publish(frame: { nodes: StudioNode[] }): void;
  onInput(callback: (event: Record<string, unknown>) => void): () => void;
  dispose(): void;
};
export declare function createPreviewBridge(options?: StudioOptions): {
  createStartUpPageContainer(page: unknown): Promise<0 | 1>;
  rebuildPageContainer(page: unknown): Promise<boolean>;
  textContainerUpgrade(update: unknown): Promise<boolean>;
  updateImageRawData(update: unknown): Promise<'success'>;
  shutDownPageContainer(mode?: number): Promise<boolean>;
  onEvenHubEvent(callback: (event: any) => void): () => void;
  getDeviceInfo(): Promise<null>;
  getLocalStorage(key: string): Promise<string>;
  setLocalStorage(key: string, value: string): Promise<boolean>;
  audioControl(...args: unknown[]): never; imuControl(...args: unknown[]): never; getAppLocation(...args: unknown[]): never;
  dispose(): void;
};
