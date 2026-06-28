/// <reference types="vite/client" />

// Declare the shape of your .env variables here.
// Prefix VITE_ is required for Vite to expose them to the browser bundle.
interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}