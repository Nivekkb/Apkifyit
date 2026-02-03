
export interface AppProject {
  id: string;
  name: string;
  description: string;
  screens: AppScreen[];
  dataConfig: DataConfig;
  buildSettings: BuildSettings;
  lastModified: number;
  isTemplate?: boolean;
  isSealed?: boolean;
  backendOptions?: string[];
  backendNotes?: string;
  icon?: string;
  author?: string;
  stats?: {
    users: number;
    launches: number;
  };
  builds?: AppBuild[];
}

export interface AppBuild {
  id: string;
  date: string;
  time: string;
  type: string;
  status: 'Completed' | 'Pending' | 'Failed';
  description: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  isAuthenticated: boolean;
}

export interface AppScreen {
  id: string;
  name: string;
  content: string; 
}

export interface DataConfig {
  collections: DataCollection[];
  apiEndpoints: ApiEndpoint[];
}

export interface DataCollection {
  id: string;
  name: string;
  fields: { name: string; type: string }[];
}

export interface ApiEndpoint {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: Record<string, string>;
}

export interface BuildSettings {
  packageName: string;
  versionName: string;
  versionCode: number;
  keystore?: KeystoreConfig;
  buildEngineUrl?: string;
  pwaBundleBase64?: string;
  pwaBundleVaultId?: string;
  pwaBundleName?: string;
  pwaBundleSizeMB?: number;
  pwaBundleFileCount?: number;
  pwaBundleHasIndex?: boolean;
  themeId?: string;
}

export interface KeystoreConfig {
  fileName: string;
  alias: string;
  password?: string;
  storePassword?: string;
}

export type ViewMode = 'dashboard' | 'overview' | 'editor' | 'data' | 'export' | 'settings' | 'visuals';
