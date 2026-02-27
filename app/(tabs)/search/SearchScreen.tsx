// app/(tabs)/search/SearchScreen.tsx
// app/(tabs)/search/SearchScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from '../../../src/lib/supabase';
import SearchExperience from '../../../src/features/search/SearchExperience';
import { useAppTheme } from '../../../src/theme/ThemeProvider';

type GateState = 'LOADING' | 'ACTIVE' | 'PENDING' | 'NEW' | 'REJECTED';
type Gender = 'MALE' | 'FEMALE';
type AppRole = 'ADMIN' | 'MODERATOR' | 'USER';

function normalizeRole(raw: any): AppRole {
  const r = String(raw || '').toUpperCase();
  if (r === 'ADMIN') return 'ADMIN';
  if (r === 'MODERATOR') return 'MODERATOR';
  return 'USER';
}

function normalizeGender(raw: any): Gender | null {
  const g = String(raw ?? '').trim().toUpperCase();
  if (g === 'MALE' || g === 'FEMALE') return g;
  return null;
}

export default function SearchScreen() {
  const { theme } = useAppTheme();
  const [gate, setGate] = useState<GateState>('LOADING');

  const [ctx, setCtx] = useState<{
    userId: string | null;
    role: AppRole;
    gender: Gender | null;
  }>({ userId: null, role: 'USER', gender: null });

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCtx({ userId: null, role: 'USER', gender: null });
        return setGate('NEW');
      }

      // Pull profile + role (prefer user_roles table)
      const [profRes, roleRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('is_approved, gender, role')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      const profile = profRes.data;
      const role =
        normalizeRole(roleRes.data?.role) ||
        normalizeRole(profile?.role) ||
        normalizeRole(user.user_metadata?.role);

      setCtx({
        userId: user.id,
        role,
        gender: normalizeGender(profile?.gender),
      });

      if (profRes.error || !profile) return setGate('NEW');
      if (profile.is_approved) return setGate('ACTIVE');
      return setGate('PENDING');
    };

    checkAccess();
  }, []);

  if (gate === 'LOADING') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator size="large" color={theme.colors.text} />
      </View>
    );
  }

  return (
    <SearchExperience
      mode="USER"
      // ✅ critical: pass user identity context to enforce filters server-side
      context={{ role: ctx.role, userId: ctx.userId, gender: ctx.gender }}
      gateEnabled
      gateState={gate}
      autoSearchOnMount={false}
      onReport={() => {
        // Keep your existing flow
      }}
    />
  );
}