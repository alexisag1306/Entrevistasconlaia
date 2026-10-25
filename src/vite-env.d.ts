/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVACY_CONTACT_EMAIL?: string;
  readonly VITE_DATA_RETENTION_NOTICE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
