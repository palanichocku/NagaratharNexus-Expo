-- ############################################################
-- MASTER PERMISSION & RLS SCHEMA (V3.0)
-- Nagarathar Nexus - Source of Truth
-- Target: Development & Production
-- ############################################################

-- 1. SCHEMATIC RESET
-- Ensure roles have usage access to the public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 2. GLOBAL POLICY CLEANUP (Idempotency Step)
-- This wipes all existing RLS policies to ensure no duplicates or "zombies" remain.
DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 3. GLOBAL TABLE GRANTS
-- Reset and define baseline table access
GRANT SELECT ON public.system_settings TO anon, authenticated;
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT SELECT ON public.success_stories TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon; 

GRANT ALL ON public.announcements TO authenticated;
GRANT ALL ON public.success_stories TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.favorites TO authenticated;
GRANT ALL ON public.moderator_slots TO authenticated;
GRANT ALL ON public.audit_logs TO authenticated;
GRANT ALL ON public.reports TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;

-- 4. FUNCTION GRANTS (Signature-Aware & Resilient)
-- Grants EXECUTE only if the function exists, handling different arguments automatically.
DO $$ 
DECLARE
    func RECORD;
BEGIN 
    FOR func IN 
        SELECT p.oid::regprocedure as signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.proname IN (
            'get_public_system_config',
            'search_profile_cards_v1',
            'get_profile_by_id_v1',
            'get_filter_metadata',
            'is_admin',
            'is_staff',
            'is_moderator'
        )
    LOOP
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', func.signature);
        RAISE NOTICE 'Granted execute on %', func.signature;
    END LOOP;
END $$;

-- 5. RLS POLICIES (Grouped by Table)

-----------------------------------------------------------
-- SYSTEM SETTINGS
-----------------------------------------------------------
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read settings" ON public.system_settings FOR SELECT TO public USING (true);
CREATE POLICY "Staff full access settings" ON public.system_settings FOR ALL TO authenticated USING (is_staff()) WITH CHECK (is_staff());

-----------------------------------------------------------
-- ANNOUNCEMENTS (BROADCASTS)
-----------------------------------------------------------
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read announcements" ON public.announcements FOR SELECT TO public USING (is_published = true);
CREATE POLICY "Staff full access announcements" ON public.announcements FOR ALL TO authenticated USING (is_staff()) WITH CHECK (is_staff());

-----------------------------------------------------------
-- PROFILES
-----------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public view approved profiles" ON public.profiles FOR SELECT TO public USING (is_approved = true);
CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id);
CREATE POLICY "Staff manage all profiles" ON public.profiles FOR ALL TO authenticated USING (is_staff()) WITH CHECK (is_staff());

-----------------------------------------------------------
-- USER ROLES
-----------------------------------------------------------
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Staff view all roles" ON public.user_roles FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Admins manage all roles" ON public.user_roles FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-----------------------------------------------------------
-- FAVORITES
-----------------------------------------------------------
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own favorites" ON public.favorites FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Staff view all favorites" ON public.favorites FOR SELECT TO authenticated USING (is_staff());

-----------------------------------------------------------
-- MODERATOR SLOTS
-----------------------------------------------------------
ALTER TABLE public.moderator_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view slots" ON public.moderator_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage moderator slots" ON public.moderator_slots FOR ALL TO authenticated USING (is_staff()) WITH CHECK (is_staff());

-----------------------------------------------------------
-- SUCCESS STORIES
-----------------------------------------------------------
ALTER TABLE public.success_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published stories" ON public.success_stories FOR SELECT TO public USING (is_published = true);
CREATE POLICY "Staff full access stories" ON public.success_stories FOR ALL TO authenticated USING (is_staff()) WITH CHECK (is_staff());

-----------------------------------------------------------
-- AUDIT LOGS
-----------------------------------------------------------
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins only access logs" ON public.audit_logs FOR ALL TO authenticated USING (is_admin());

-- ############################################################
-- END OF SCRIPT
-- ############################################################