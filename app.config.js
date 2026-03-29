import fs from 'fs';
import path from 'path';

export default ({ config }) => {
  const appEnv = (process.env.APP_ENV || process.env.EXPO_PUBLIC_APP_ENV || 'dev').toLowerCase();

  const envFileName = `.env.${appEnv === 'prod' ? 'production' : 'development'}`;
  const envFilePath = path.resolve(__dirname, `./env/${envFileName}`);

  const fileEnvVars = {};

  try {
  const hasEnvFile = fs.existsSync(envFilePath);
  const hasProcessEnv = !!process.env.EXPO_PUBLIC_SUPABASE_URL;

  if (!hasEnvFile && !hasProcessEnv) {
    console.warn(`⚠️ Warning: Environment file not found at ${envFilePath}`);
  }

  if (hasEnvFile) {
    const envFileContent = fs.readFileSync(envFilePath, 'utf8');

    envFileContent.split(/\r?\n/).forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) return;

      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        let value = valueParts.join('=').trim();

        value = value.split('#')[0].trim();
        value = value.replace(/^["']|["']$/g, '');
        value = value.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[^\x20-\x7E]/g, '');

        fileEnvVars[key.trim()] = value;
      }
    });
  }
} catch (error) {
  console.error(`❌ Error parsing env file: ${error.message}`);
}

  const sanitize = (value) =>
    String(value ?? '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim();

  // Vercel / CI should use process.env first.
  // Local can still fall back to ./env files.
  const supabaseUrl = sanitize(
    process.env.EXPO_PUBLIC_SUPABASE_URL || fileEnvVars.EXPO_PUBLIC_SUPABASE_URL || ''
  );

  const supabaseAnonKey = sanitize(
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || fileEnvVars.EXPO_PUBLIC_SUPABASE_ANON_KEY || ''
  );

  const nativeRedirectUrl = sanitize(
    process.env.EXPO_PUBLIC_NATIVE_REDIRECT_URL ||
      fileEnvVars.EXPO_PUBLIC_NATIVE_REDIRECT_URL ||
      ''
  );

  console.log(`--- 🛡️ MANIFEST OVERRIDE [${appEnv.toUpperCase()}] ---`);
  console.log(`Target File:  ${envFilePath}`);
  console.log(`Using process.env URL: ${!!process.env.EXPO_PUBLIC_SUPABASE_URL}`);
  console.log(`Using file URL:        ${!!fileEnvVars.EXPO_PUBLIC_SUPABASE_URL}`);
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`URL Length:   ${supabaseUrl.length} (Expected for your URL: 44)`);

  return {
    ...config,
    name: appEnv === 'prod' ? 'NagaratharNexus' : `NN-${appEnv.toUpperCase()}`,
    extra: {
      ...config.extra,
      appEnv,
      supabaseUrl,
      supabaseAnonKey,
      nativeRedirectUrl,
    },
  };
};