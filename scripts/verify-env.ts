// scripts/verify-env.ts
import dotenv from 'dotenv';
import path from 'path';

const envFile = process.env.APP_ENV === 'prod' ? '.env.production' : '.env.development';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

console.log('--- 🔍 ENV DIAGNOSTIC ---');
console.log('Target Env File:', envFile);
console.log('APP_ENV (Direct):', process.env.APP_ENV);
console.log('EXPO_PUBLIC_APP_ENV:', process.env.EXPO_PUBLIC_APP_ENV);
console.log('Supabase URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log('-------------------------');

if (process.env.APP_ENV === 'prod' && process.env.EXPO_PUBLIC_APP_ENV !== 'PROD') {
  console.error('❌ MISMATCH DETECTED: Node has the wrong values for a PROD run!');
  process.exit(1);
} else {
  console.log('✅ Node process is healthy. The issue is likely in the Metro Cache.');
}