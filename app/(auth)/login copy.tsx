// src/app/(auth)/login.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Platform, Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase'; // 🚀 Your new client
import { useRouter } from 'expo-router';
import { REDIRECT_URL } from '../../src/lib/supabase';
import { Modal } from 'react-native';
import { BlurView } from 'expo-blur';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState(''); // 🚀 Added for Signup
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const handleEmailAuth = async () => {
  
    if (!email || !password) return;
    setLoading(true);

    try {
      if (isSignUp) {
        // 🚀 SUPABASE SIGN UP
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            // 🛡️ Ensure they are sent to Onboarding AFTER clicking the link
            emailRedirectTo: `${REDIRECT_URL}/Onboarding` // 🛡️ Dynamic Redirect
          }
        });
        
        if (error) throw error;

        // ✅ SUCCESS: Instead of an alert, we move to your custom VerifyEmail screen
        if (data?.user) {
          router.push({
            pathname: '/(auth)/VerifyEmail',
            params: { email: email } // Passes the email so the user sees where it was sent
          });
        }
      } else {
        // 🚀 SUPABASE SIGN IN
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          if (error.message.toLowerCase().includes('invalid login credentials')) {
            // 🚀 Trigger our custom Modal instead of an Alert
            setShowInviteModal(true);
            return;
          }
          throw error;
        }
        // Layout handles navigation to /profile or /Onboarding automatically
      }
    } catch (error: any) {
      Alert.alert('Authentication Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // 🚀 SUPABASE GOOGLE LOGIN
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin // Works for Web
      }
    });
    if (error) Alert.alert('Google Login Error', error.message);
  };

  const handleForgotPassword = async () => {
    if (!email) return Alert.alert('Email Required', 'Enter your email first.');
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Sent', 'Check your email for the reset link.');
  };

  const primaryLabel = isSignUp ? 'Create Account' : 'Sign In';
  const switchLabel = isSignUp ? 'Already have an account? Sign In' : 'New member? Create an account';

  
  return (
    <View style={styles.container}>

      {/* --- JOIN COMMUNITY MODAL --- */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showInviteModal}
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="heart" size={40} color="#7C2D12" />
            </View>
            
            <Text style={styles.modalTitle}>Welcome to the Nagarathar Nexus!</Text>
            <Text style={styles.modalDescription}>
              We couldn't find an account for <Text style={{fontWeight: '700'}}>{email}</Text>. 
              Would you like to join our respectful matchmaking community?
            </Text>

            <TouchableOpacity 
              style={styles.modalJoinBtn}
              onPress={() => {
                setShowInviteModal(false);
                setIsSignUp(true); // 🔄 Switch to register mode
              }}
            >
              <Text style={styles.modalJoinText}>Yes, Join Now</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setShowInviteModal(false)}
            >
              <Text style={styles.modalCloseText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>


      <View style={styles.content}>
        <View style={styles.brandHeader}>
          <View style={styles.logoCircle}>
            <Ionicons name="heart" size={18} color="#7C2D12" />
          </View>
          <Text style={styles.title}>Nagarathar Nexus</Text>
          <Text style={styles.subtitle}>A respectful matchmaking space for the Nagarathar community</Text>
          <View style={styles.trustRow}>
            <Ionicons name="lock-closed-outline" size={16} color="#374151" />
            <Text style={styles.trustText}>Private • Verified • Community-first</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Pressable onPress={handleGoogleLogin} disabled={loading} style={styles.socialButton}>
            <Ionicons name="logo-google" size={20} color="#DB4437" />
            <Text style={styles.socialText}>Continue with Google</Text>
            <View style={{ width: 20 }} />
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.line} /><Text style={styles.or}>OR</Text><View style={styles.line} />
          </View>

          {/* New Full Name Input for Sign Up */}
          {isSignUp && (
            <View style={[styles.inputShell, fullName ? styles.inputShellActive : null]}>
              <Ionicons name="person-outline" size={18} color="#6B7280" />
              <TextInput 
                style={styles.input} 
                placeholder="Full Name" 
                value={fullName} 
                onChangeText={setFullName} 
              />
            </View>
          )}

          <View style={[styles.inputShell, email.trim() ? styles.inputShellActive : null]}>
            <Ionicons name="mail-outline" size={18} color="#6B7280" />
            <TextInput style={styles.input} placeholder="Email Address" value={email} onChangeText={setEmail} autoCapitalize="none" />
          </View>

          <View style={[styles.inputShell, password ? styles.inputShellActive : null]}>
            <Ionicons name="lock-closed-outline" size={18} color="#6B7280" />
            <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} />
            <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#6B7280" />
            </Pressable>
          </View>

          <TouchableOpacity style={[styles.primaryButton, loading && { opacity: 0.65 }]} onPress={handleEmailAuth} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <><Text style={styles.buttonText}>{primaryLabel}</Text><Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 10 }} /></>}
          </TouchableOpacity>

          {!isSignUp && (
            <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotBtn} disabled={loading}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={styles.switchBtn} disabled={loading}>
            <Text style={styles.switchText}>{switchLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// UI-only styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },

  content: {
    paddingHorizontal: 22,
    paddingTop: 42,
    paddingBottom: 28,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    flex: 1,
    justifyContent: 'center',
  },

  brandHeader: { alignItems: 'center', marginBottom: 18 },
  logoCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginBottom: 10,
  },

  title: { fontSize: 30, fontWeight: '900', textAlign: 'center', color: '#111827' },
  subtitle: { fontSize: 14, color: '#4B5563', textAlign: 'center', marginTop: 8, lineHeight: 20 },

  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  trustText: { color: '#374151', fontWeight: '800', fontSize: 12 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EEF2F7',
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'web' ? 0 : 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
  },

  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  socialText: { fontWeight: '800', color: '#111827', fontSize: 14 },

  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  line: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  or: { marginHorizontal: 10, color: '#6B7280', fontSize: 12, fontWeight: '900', letterSpacing: 1 },

  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  inputShellActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 0,
  },
  eyeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },

  primaryButton: {
    backgroundColor: '#111827',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 6,
  },
  buttonText: { color: '#FFF', fontWeight: '900', fontSize: 15 },

  forgotBtn: { marginTop: 14, alignSelf: 'center' },
  forgotText: { color: '#7C2D12', fontWeight: '900', fontSize: 14 },

  switchBtn: { marginTop: 16, alignItems: 'center' },
  switchText: { color: '#111827', fontWeight: '900' },

  footerNote: {
    marginTop: 14,
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 25,
  },
  modalJoinBtn: {
    width: '100%',
    height: 54,
    backgroundColor: '#111827',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalJoinText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalCloseBtn: {
    padding: 10,
  },
  modalCloseText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
});
