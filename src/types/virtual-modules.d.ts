declare module "virtual:pwa-register" {
  export function registerSW(options?: any): () => void;
}

declare module "vite-plugin-pwa" {
  const plugin: any;
  export { plugin as VitePWA };
  export default plugin;
}
