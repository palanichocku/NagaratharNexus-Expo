import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};

export const ENV = {
  APP_ENV: (extra.appEnv || 'dev').toLowerCase(),
  SUPABASE_URL: extra.supabaseUrl || '',
  SUPABASE_ANON_KEY: extra.supabaseAnonKey || '',
  IS_PROD: extra.appEnv === 'prod',
  IS_DEV: extra.appEnv === 'dev',
};

console.log('🌍 [ENV LIB INITIALIZED]', ENV);