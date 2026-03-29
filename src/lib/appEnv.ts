import Constants from 'expo-constants';

export type AppEnv = 'DEV' | 'PROD' | 'LOCAL' | 'UNKNOWN';

export function getAppEnv(): AppEnv {
  // Pull directly from the Manifest extra field
  const extra = Constants.expoConfig?.extra || {};
  const env = (extra.appEnv || 'UNKNOWN').toUpperCase();

  if (env === 'DEV' || env === 'PROD' || env === 'LOCAL') {
    return env as AppEnv;
  }

  return 'UNKNOWN';
}

export function getAppEnvLabel(): string {
  const env = getAppEnv();

  switch (env) {
    case 'DEV':
      return 'NN DEV';
    case 'PROD':
      return 'NN PROD';
    case 'LOCAL':
      return 'NN LOCAL';
    default:
      return 'NN UNKNOWN';
  }
}