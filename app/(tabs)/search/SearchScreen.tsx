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
    kovil: string | null;
    pirivu: string | null;
  }>({ userId: null, role: 'USER', gender: null, kovil: null, pirivu: null });

  useEffect(() => {
  let alive = true;

  const checkAccess = async () => {
    console.time('checkAccess');
    try {
      const { data, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const user = data?.user;
      if (!user) {
        if (!alive) return;
        setCtx({ userId: null, role: 'USER', gender: null, kovil: null, pirivu: null });
        setGate('NEW');
        return;
      }

      const [profRes, roleRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('is_approved, gender, role, kovil, pirivu')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (profRes.error) throw profRes.error;
      const profile = profRes.data;
      if (!profile) {
        if (!alive) return;
        setGate('NEW');
        return;
      }

      const role =
        normalizeRole(roleRes.data?.role) ??
        normalizeRole(profile?.role) ??
        normalizeRole(user.user_metadata?.role);

      if (!alive) return;

      setCtx({
        userId: user.id,
        role,
        gender: normalizeGender(profile?.gender),
        kovil: profile?.kovil ?? null,
        pirivu: profile?.pirivu ?? null,
      });

      setGate(profile.is_approved ? 'ACTIVE' : 'PENDING');
    } catch (e) {
      console.error('checkAccess failed', e);
      if (!alive) return;
      setCtx({ userId: null, role: 'USER', gender: null, kovil: null, pirivu: null });
      setGate('NEW'); // fail-safe: never stay LOADING
    } finally {
      console.timeEnd('checkAccess');
    }
  };

  checkAccess();
  return () => { alive = false; };
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
      context={{ role: ctx.role, userId: ctx.userId, gender: ctx.gender, kovil: ctx.kovil, pirivu: ctx.pirivu }}
      gateEnabled
      gateState={gate}
      autoSearchOnMount={false}
      onReport={() => {
        // Keep your existing flow
      }}
    />
  );
}