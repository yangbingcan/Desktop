/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module 'qrcode' {
  export function toDataURL(text: string, options?: any): Promise<string>
  export function toCanvas(canvas: HTMLCanvasElement, text: string, options?: any): Promise<void>
}
