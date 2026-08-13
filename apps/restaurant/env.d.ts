/// <reference types="vite/client" />

declare module "virtual:uno.css";

interface Window {
  restaurantStore?: {
    load(): Promise<unknown | null>;
    save(data: unknown): Promise<boolean>;
  };
}
