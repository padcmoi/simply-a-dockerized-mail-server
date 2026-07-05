export {};

declare module "nuxt/app" {
  interface PageMeta {
    rootOnly?: boolean;
    requiredGlobal?: { resource: string; action: string }[];
    requiredDomain?: { resource: string; action: string }[];
  }
}
