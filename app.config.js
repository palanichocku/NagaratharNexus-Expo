// app.config.js
import fs from 'fs';
import path from 'path';

export default ({ config }) => {
  const appEnv = (process.env.APP_ENV || 'dev').toLowerCase();
  
  // Physically locate the correct file
  const envFileName = `.env.${appEnv === 'prod' ? 'production' : 'development'}`;
  const envFilePath = path.resolve(__dirname, `./env/${envFileName}`);
  
  const envVars = {};

  try {
    if (fs.existsSync(envFilePath)) {
      const envFileContent = fs.readFileSync(envFilePath, 'utf8');
      
      envFileContent.split(/\r?\n/).forEach(line => {
        const trimmedLine = line.trim();
        // Ignore comments and empty lines
        if (!trimmedLine || trimmedLine.startsWith('#')) return;

        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          let value = valueParts.join('=').trim();
          
          // 1. Strip end-of-line comments
          value = value.split('#')[0].trim(); 
          
          // 2. Remove wrapping quotes (smart replace)
          value = value.replace(/^["']|["']$/g, '');

          // 3. 🛡️ CRITICAL: Strip hidden non-printing characters & control chars
          // This removes BOM, Zero-Width Spaces, and non-ASCII ghosts
          value = value.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[^\x20-\x7E]/g, '');

          envVars[key.trim()] = value;
        }
      });
    } else {
      console.warn(`⚠️ Warning: Environment file not found at ${envFilePath}`);
    }
  } catch (error) {
    console.error(`❌ Error parsing env file: ${error.message}`);
  }

  // Final validation log
  const url = envVars['EXPO_PUBLIC_SUPABASE_URL'] || '';
  console.log(`--- 🛡️ MANIFEST OVERRIDE [${appEnv.toUpperCase()}] ---`);
  console.log(`Target File:  ${envFilePath}`);
  console.log(`Supabase URL: ${url}`);
  console.log(`URL Length:   ${url.length} (Expected for your URL: 44)`);

  return {
    ...config,
    name: appEnv === 'prod' ? "NagaratharNexus" : `NN-${appEnv.toUpperCase()}`,
    extra: {
      ...config.extra,
      appEnv: appEnv,
      supabaseUrl: url,
      supabaseAnonKey: envVars['EXPO_PUBLIC_SUPABASE_ANON_KEY'] || '',
      nativeRedirectUrl: envVars['EXPO_PUBLIC_NATIVE_REDIRECT_URL'] || '',
    },
  };
};