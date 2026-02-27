// src/lib/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// These variables are injected from your .env file
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials missing! Check your .env file.');
}

// 🚀 SSR-Safe Environment Detection
// This prevents "window is not defined" during Expo pre-rendering
export const REDIRECT_URL = Platform.OS === 'web' 
  ? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081') 
  : 'exp://127.0.0.1:8081';

// 🚀 SSR-SAFE STORAGE SELECTION
// This prevents AsyncStorage from executing 'window' checks on the server
const isWeb = Platform.OS === 'web';
const storage = isWeb
  ? typeof window !== 'undefined' 
    ? AsyncStorage 
    : {
        getItem: () => Promise.resolve(null),
        setItem: () => Promise.resolve(),
        removeItem: () => Promise.resolve(),
      }
  : AsyncStorage;
  
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
