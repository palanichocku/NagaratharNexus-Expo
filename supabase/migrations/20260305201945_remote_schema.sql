


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;




ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'USER',
    'MODERATOR',
    'ADMIN'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_age"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Only calculate if dob is not null
    IF NEW.dob IS NOT NULL THEN
        NEW.age := date_part('year', age(current_date, NEW.dob));
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_age"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_favorites_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_limit integer;
  v_count integer;
begin
  select greatest(1, least(20, coalesce((value->>'favoritesLimit')::int, 5)))
    into v_limit
  from public.system_settings
  where key = 'global_config';

  if v_limit is null then
    v_limit := 5;
  end if;

  select count(*)
    into v_count
  from public.favorites
  where user_id = new.user_id;

  if v_count >= v_limit then
    raise exception 'favorites_limit_reached:%', v_limit using errcode = 'P0001';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_favorites_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_moderator_profile_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_is_admin boolean;
  v_is_moderator boolean;
begin
  -- Only enforce for authenticated requests
  if auth.uid() is null then
    return new;
  end if;

  v_is_admin := public.is_admin();
  v_is_moderator := public.is_moderator();

  -- Admins can do anything
  if v_is_admin then
    return new;
  end if;

  -- Moderators can ONLY approve/review fields
  if v_is_moderator then
    -- Block changes to any other fields
    if
      (new.full_name          is distinct from old.full_name)          or
      (new.dob                is distinct from old.dob)                or
      (new.gender             is distinct from old.gender)             or
      (new.citizenship        is distinct from old.citizenship)        or
      (new.resident_country   is distinct from old.resident_country)   or
      (new.resident_status    is distinct from old.resident_status)    or
      (new.current_state      is distinct from old.current_state)      or
      (new.current_city       is distinct from old.current_city)       or
      (new.phone              is distinct from old.phone)              or
      (new.email              is distinct from old.email)              or
      (new.marital_status     is distinct from old.marital_status)     or
      (new.height             is distinct from old.height)             or
      (new.height_inches      is distinct from old.height_inches)      or
      (new.profession         is distinct from old.profession)         or
      (new.workplace          is distinct from old.workplace)          or
      (new.linkedin_profile   is distinct from old.linkedin_profile)   or
      (new.native_place       is distinct from old.native_place)       or
      (new.family_initials    is distinct from old.family_initials)    or
      (new.father_name        is distinct from old.father_name)        or
      (new.father_work        is distinct from old.father_work)        or
      (new.father_phone       is distinct from old.father_phone)       or
      (new.mother_name        is distinct from old.mother_name)        or
      (new.mother_work        is distinct from old.mother_work)        or
      (new.mother_phone       is distinct from old.mother_phone)       or
      (new.siblings           is distinct from old.siblings)           or
      (new.kovil              is distinct from old.kovil)              or
      (new.pirivu             is distinct from old.pirivu)             or
      (new.rasi               is distinct from old.rasi)               or
      (new.star               is distinct from old.star)               or
      (new.interests          is distinct from old.interests)          or
      (new.expectations       is distinct from old.expectations)       or
      (new.profile_photo_url  is distinct from old.profile_photo_url)  or
      (new.is_submitted       is distinct from old.is_submitted)       or
      (new.education_history  is distinct from old.education_history)  or
      (new.family_details     is distinct from old.family_details)     or
      (new.age                is distinct from old.age)                or
      (new.is_test_data       is distinct from old.is_test_data)       or
      (new.hide_phone         is distinct from old.hide_phone)         or
      (new.hide_email         is distinct from old.hide_email)         or
      (new.role               is distinct from old.role)               or
      (new.created_at         is distinct from old.created_at)
    then
      raise exception 'Moderators can only update approval/status fields';
    end if;

    -- Allow is_approved/account_status changes; updated_at can be set by system
    new.updated_at := now();
    return new;
  end if;

  -- Non-staff users: allow normal RLS rules to govern; keep updated_at fresh
  new.updated_at := now();
  return new;
end $$;


ALTER FUNCTION "public"."enforce_moderator_profile_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_test_profiles"("num_users" integer) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, gender, age, is_approved, kovil)
  SELECT 
    gen_random_uuid(), 
    'Test User ' || i, 
    CASE WHEN i % 2 = 0 THEN 'MALE' ELSE 'FEMALE' END,
    (18 + (i % 42)),
    TRUE,
    'Kovil ' || (i % 9)
  FROM generate_series(1, num_users) AS i;
END;
$$;


ALTER FUNCTION "public"."generate_test_profiles"("num_users" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_favorite_profile_cards_v1"("p_user_id" "uuid", "p_page_size" integer DEFAULT 21, "p_cursor_created_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_cursor_favorite_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "full_name" "text", "age" integer, "gender" "text", "resident_country" "text", "resident_status" "text", "current_state" "text", "current_city" "text", "profession" "text", "height_inches" integer, "kovil" "text", "pirivu" "text", "native_place" "text", "profile_photo_url" "text", "updated_at" timestamp with time zone, "fav_created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    AS $$
  with favs as (
    select f.favorite_id, f.created_at
    from public.favorites f
    where f.user_id = p_user_id
      and (
        p_cursor_created_at is null
        or p_cursor_favorite_id is null
        or (f.created_at, f.favorite_id) < (p_cursor_created_at, p_cursor_favorite_id)
      )
    order by f.created_at desc, f.favorite_id desc
    limit p_page_size
  )
  select
    p.id,
    p.full_name,
    p.age,
    p.gender,
    p.resident_country,
    p.resident_status,
    p.current_state,
    p.current_city,
    p.profession,
    p.height_inches,
    p.kovil,
    p.pirivu,
    p.native_place,
    p.profile_photo_url,
    p.updated_at,
    favs.created_at as fav_created_at
  from favs
  join public.profiles p on p.id = favs.favorite_id
  where p.is_approved = true
    and p.is_submitted = true
    and p.role = 'USER'
  order by favs.created_at desc, favs.favorite_id desc;
$$;


ALTER FUNCTION "public"."get_favorite_profile_cards_v1"("p_user_id" "uuid", "p_page_size" integer, "p_cursor_created_at" timestamp with time zone, "p_cursor_favorite_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_filter_metadata"() RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN json_build_object(
    'countries', (
      SELECT json_agg(DISTINCT resident_country)
      FROM profiles
      WHERE is_approved = true
        AND is_submitted = true
        AND role = 'USER'
        AND resident_country IS NOT NULL
    ),
    'kovils', (
      SELECT json_agg(DISTINCT kovil)
      FROM profiles
      WHERE is_approved = true
        AND is_submitted = true
        AND role = 'USER'
        AND kovil IS NOT NULL
    ),
    'education', (
      SELECT json_agg(DISTINCT deg)
      FROM (
        SELECT NULLIF(btrim(eh->>'level'), '') AS deg
        FROM profiles p
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.education_history, '[]'::jsonb)) AS eh
        WHERE p.is_approved = true
          AND p.is_submitted = true
          AND p.role = 'USER'
      ) x
      WHERE deg IS NOT NULL
    )
  );
END;
$$;


ALTER FUNCTION "public"."get_filter_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_profile_by_id_v1"("p_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select to_jsonb(p)
  from public.profiles p
  where p.id = p_id
    and p.is_approved = true
    and p.is_submitted = true
    and upper(coalesce(p.role,''))='USER'
    and upper(coalesce(p.account_status,'ACTIVE'))='ACTIVE';
$$;


ALTER FUNCTION "public"."get_profile_by_id_v1"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_profile_facets"() RETURNS json
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'countries', (SELECT array_agg(DISTINCT resident_country ORDER BY resident_country) FROM profiles WHERE is_approved = true AND role = 'USER'),
    'kovils', (SELECT array_agg(DISTINCT kovil ORDER BY kovil) FROM profiles WHERE is_approved = true AND role = 'USER'),
    'pirivus', (SELECT array_agg(DISTINCT pirivu ORDER BY pirivu) FROM profiles WHERE is_approved = true AND role = 'USER'),
    'maritalStatus', (SELECT array_agg(DISTINCT marital_status ORDER BY marital_status) FROM profiles WHERE is_approved = true AND role = 'USER'),
    'education', (SELECT array_agg(DISTINCT val) FROM (SELECT unnest(education) as val FROM profiles WHERE is_approved = true AND role = 'USER') s),
    'interests', (SELECT array_agg(DISTINCT val) FROM (SELECT unnest(interests) as val FROM profiles WHERE is_approved = true AND role = 'USER') s)
  ) INTO result;
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_profile_facets"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Insert into Profiles
  INSERT INTO public.profiles (id, email, full_name, is_approved, is_submitted)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Nexus Member'),
    (new.raw_user_meta_data->>'role' IS NOT NULL), -- Auto-approve staff
    (new.raw_user_meta_data->>'role' IS NOT NULL)  -- Auto-submit staff
  );

  -- Insert into Roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    new.id,
    COALESCE((new.raw_user_meta_data->>'role')::public.app_role, 'USER')
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'ADMIN'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_moderator"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'MODERATOR'
  );
$$;


ALTER FUNCTION "public"."is_moderator"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_staff"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('ADMIN','MODERATOR')
  );
$$;


ALTER FUNCTION "public"."is_staff"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_test_data"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM public.profiles 
    WHERE is_test_data = true;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


ALTER FUNCTION "public"."purge_test_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_test_data"("batch_size" integer DEFAULT 500) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_total   bigint := 0;
  v_deleted int := 0;
begin
  -- Give it more breathing room (optional, but helps)
  perform set_config('statement_timeout', '600000', true); -- 10 minutes
  perform set_config('lock_timeout', '5000', true);        -- 5 seconds

  loop
    with to_del as (
      select ctid
      from public.profiles
      where is_test_data is true
      limit batch_size
    )
    delete from public.profiles p
    using to_del
    where p.ctid = to_del.ctid;

    get diagnostics v_deleted = row_count;
    v_total := v_total + v_deleted;

    exit when v_deleted = 0;
  end loop;

  return v_total;
end $$;


ALTER FUNCTION "public"."purge_test_data"("batch_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_profile_role_on_user_roles_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.profiles
  set role = 'USER',
      updated_at = now()
  where id = old.user_id;

  return old;
end $$;


ALTER FUNCTION "public"."reset_profile_role_on_user_roles_delete"() OWNER TO "postgres";


set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.search_profile_cards_v1(
  p_query text DEFAULT NULL,
  p_min_age integer DEFAULT 18,
  p_max_age integer DEFAULT 60,
  p_min_height integer DEFAULT 48,
  p_max_height integer DEFAULT 84,
  p_countries text[] DEFAULT NULL,
  p_marital_statuses text[] DEFAULT NULL,
  p_interests text[] DEFAULT NULL,
  p_education text[] DEFAULT NULL,
  p_exclude_kovil_pirivu text[] DEFAULT NULL,
  p_page_size integer DEFAULT 20,
  p_cursor_updated_at timestamp with time zone DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_exclude_user_id uuid DEFAULT NULL,
  p_forced_gender text DEFAULT NULL
)
 RETURNS TABLE(id uuid, full_name text, age integer, gender text, resident_country text, resident_status text, current_state text, current_city text, profession text, height_inches integer, kovil text, pirivu text, native_place text, profile_photo_url text, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path = public, extensions
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.full_name, p.age::int, p.gender::text, p.resident_country,
    p.resident_status, p.current_state, p.current_city, p.profession,
    p.height_inches::int, p.kovil, p.pirivu, p.native_place,
    p.profile_photo_url, p.updated_at
  FROM public.profiles p
  WHERE
    p.is_approved = true 
    AND p.is_submitted = true
    AND p.role::text ILIKE 'USER'
    AND (p_exclude_user_id IS NULL OR p.id <> p_exclude_user_id)
    AND (p.age::int >= COALESCE(p_min_age, 0) AND p.age::int <= COALESCE(p_max_age, 999))
    AND (p.height_inches::int >= COALESCE(p_min_height, 0) AND p.height_inches::int <= COALESCE(p_max_height, 999))
    AND (p_forced_gender IS NULL OR p.gender::text ILIKE p_forced_gender)
    AND (p_query IS NULL OR p.full_name ILIKE ('%' || p_query || '%') OR p.profession ILIKE ('%' || p_query || '%'))
    AND (p_countries IS NULL OR p.resident_country = ANY(p_countries))
    AND (
      p_exclude_kovil_pirivu IS NULL
      OR NOT EXISTS (
        SELECT 1 
        FROM unnest(p_exclude_kovil_pirivu) AS ex(val)
        WHERE 
          concat_ws('||', p.kovil, COALESCE(p.pirivu, '')) = ex.val
          OR (ex.val LIKE '%||*' AND p.kovil = split_part(ex.val, '||', 1))
      )
    )
    AND (
      p_cursor_updated_at IS NULL 
      OR (p.updated_at, p.id) < (p_cursor_updated_at, p_cursor_id)
    )
  ORDER BY p.updated_at DESC, p.id DESC
  LIMIT (COALESCE(p_page_size, 20) + 1);
END;
$function$;


ALTER FUNCTION "public"."search_profile_cards_v1"("p_query" "text", "p_min_age" integer, "p_max_age" integer, "p_min_height" integer, "p_max_height" integer, "p_countries" "text"[], "p_marital_statuses" "text"[], "p_interests" "text"[], "p_education" "text"[], "p_exclude_kovil_pirivu" "text"[], "p_page_size" integer, "p_cursor_updated_at" timestamp with time zone, "p_cursor_id" "uuid", "p_exclude_user_id" "uuid", "p_forced_gender" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_profiles_v2"("p_query" "text" DEFAULT NULL::"text", "p_min_age" integer DEFAULT 18, "p_max_age" integer DEFAULT 100, "p_min_height" integer DEFAULT 48, "p_max_height" integer DEFAULT 84, "p_countries" "text"[] DEFAULT NULL::"text"[], "p_marital_statuses" "text"[] DEFAULT NULL::"text"[], "p_educations" "text"[] DEFAULT NULL::"text"[], "p_interests" "text"[] DEFAULT NULL::"text"[], "p_exclude_kovil_pirivu" "text"[] DEFAULT NULL::"text"[], "p_page_size" integer DEFAULT 20, "p_cursor_updated_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_cursor_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("profile_data" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT to_jsonb(p) AS profile_data
  FROM public.profiles p
  WHERE p.is_approved = true
    AND p.is_submitted = true
    AND upper(coalesce(p.role, '')) = 'USER'
    AND upper(coalesce(p.account_status, 'ACTIVE')) = 'ACTIVE'
    AND p.age BETWEEN p_min_age AND p_max_age
    AND p.height_inches BETWEEN p_min_height AND p_max_height
    AND (p_countries IS NULL OR p.resident_country = ANY(p_countries))
    AND (p_marital_statuses IS NULL OR p.marital_status = ANY(p_marital_statuses))
    AND (
      p_educations IS NULL
       OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(p.education_history, '[]'::jsonb)) AS eh
        WHERE NULLIF(btrim(eh->>'level'), '') = ANY(p_educations)
       )
    )
    AND (p_interests IS NULL OR p.interests && p_interests)
    AND (
      p_query IS NULL OR (
        p.full_name ILIKE '%' || p_query || '%'
        OR p.profession ILIKE '%' || p_query || '%'
        OR p.native_place ILIKE '%' || p_query || '%'
      )
    )
    AND (
      p_exclude_kovil_pirivu IS NULL
      OR NOT (
        (p.kovil || '||' || COALESCE(p.pirivu, '*')) = ANY (p_exclude_kovil_pirivu)
        OR (p.kovil || '||*') = ANY (p_exclude_kovil_pirivu)
      )
    )
    AND (
      p_cursor_updated_at IS NULL
      OR p_cursor_id IS NULL
      OR (p.updated_at, p.id) < (p_cursor_updated_at, p_cursor_id)
    )
  ORDER BY p.updated_at DESC, p.id DESC
  LIMIT p_page_size;
$$;


ALTER FUNCTION "public"."search_profiles_v2"("p_query" "text", "p_min_age" integer, "p_max_age" integer, "p_min_height" integer, "p_max_height" integer, "p_countries" "text"[], "p_marital_statuses" "text"[], "p_educations" "text"[], "p_interests" "text"[], "p_exclude_kovil_pirivu" "text"[], "p_page_size" integer, "p_cursor_updated_at" timestamp with time zone, "p_cursor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_height_inches"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $_$
begin
  if new.height is null or btrim(new.height) = '' then
    new.height_inches := null;
    return new;
  end if;

  if new.height ~ '^\s*\d+\s*''\s*\d+\s*"?\s*$' then
    new.height_inches :=
      (regexp_replace(new.height, '^\s*(\d+)\s*''\s*(\d+)\s*"?\s*$', '\1')::int * 12) +
      (regexp_replace(new.height, '^\s*(\d+)\s*''\s*(\d+)\s*"?\s*$', '\2')::int);
    return new;
  end if;

  if lower(new.height) ~ 'cm' then
    new.height_inches :=
      round(regexp_replace(lower(new.height), '[^0-9\.]+', '', 'g')::numeric / 2.54)::int;
    return new;
  end if;

  if new.height ~ '^\s*\d+\s*$' then
    new.height_inches := btrim(new.height)::int;
    return new;
  end if;

  new.height_inches := null;
  return new;
end;
$_$;


ALTER FUNCTION "public"."sync_height_inches"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_profile_role_from_user_roles"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  update public.profiles
  set role = new.role::text,
      updated_at = now()
  where id = new.user_id;

  return new;
end $$;


ALTER FUNCTION "public"."sync_profile_role_from_user_roles"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."announcements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_published" boolean DEFAULT true NOT NULL,
    "author_id" "uuid" NOT NULL,
    "author_role" "text" DEFAULT 'USER'::"text" NOT NULL
);


ALTER TABLE "public"."announcements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "actor_email" "text",
    "action" "text" NOT NULL,
    "details" "text",
    "target_id" "uuid",
    "timestamp" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "favorite_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "role" "text" DEFAULT 'USER'::"text",
    "is_approved" boolean DEFAULT false,
    "full_name" "text" NOT NULL,
    "dob" "date",
    "gender" "text",
    "citizenship" "text",
    "resident_country" "text",
    "resident_status" "text",
    "current_state" "text",
    "phone" "text",
    "email" "text",
    "marital_status" "text",
    "height" "text",
    "profession" "text",
    "workplace" "text",
    "linkedin_profile" "text",
    "native_place" "text",
    "family_initials" "text",
    "father_name" "text",
    "father_work" "text",
    "father_phone" "text",
    "mother_name" "text",
    "mother_work" "text",
    "mother_phone" "text",
    "siblings" "text"[] DEFAULT '{}'::"text"[],
    "kovil" "text",
    "pirivu" "text",
    "rasi" "text",
    "star" "text",
    "interests" "text"[] DEFAULT '{}'::"text"[],
    "expectations" "text",
    "profile_photo_url" "text",
    "is_submitted" boolean DEFAULT false,
    "education_history" "jsonb" DEFAULT '[]'::"jsonb",
    "family_details" "jsonb" DEFAULT '{"siblings": []}'::"jsonb",
    "current_city" "text",
    "age" integer,
    "is_test_data" boolean DEFAULT false,
    "height_inches" integer,
    "hide_phone" boolean DEFAULT true NOT NULL,
    "hide_email" boolean DEFAULT true NOT NULL,
    "account_status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    CONSTRAINT "profiles_gender_check" CHECK (("gender" = ANY (ARRAY['MALE'::"text", 'FEMALE'::"text", 'OTHER'::"text"]))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['USER'::"text", 'ADMIN'::"text", 'MODERATOR'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reporter_id" "uuid" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "details" "text",
    "status" "text" DEFAULT 'PENDING'::"text"
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" DEFAULT 'USER'::"public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_favorite_id_key" UNIQUE ("user_id", "favorite_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id");



CREATE INDEX "announcements_created_at_idx" ON "public"."announcements" USING "btree" ("created_at" DESC);



CREATE INDEX "announcements_is_published_created_at_idx" ON "public"."announcements" USING "btree" ("is_published", "created_at" DESC);



CREATE INDEX "favorites_profile_id_idx" ON "public"."favorites" USING "btree" ("favorite_id");



CREATE INDEX "idx_audit_logs_composite" ON "public"."audit_logs" USING "btree" ("action", "timestamp" DESC);



CREATE INDEX "idx_favorites_user_created" ON "public"."favorites" USING "btree" ("user_id", "created_at" DESC, "favorite_id" DESC);



CREATE INDEX "idx_profiles_admin_dash" ON "public"."profiles" USING "btree" ("is_approved", "is_submitted", "role");



CREATE INDEX "idx_profiles_age_height" ON "public"."profiles" USING "btree" ("age", "height") WHERE ("is_approved" = true);



CREATE INDEX "idx_profiles_age_height_inches" ON "public"."profiles" USING "btree" ("age", "height_inches") WHERE (("is_approved" = true) AND ("is_submitted" = true) AND ("role" = 'USER'::"text"));



CREATE INDEX "idx_profiles_core_height_inches" ON "public"."profiles" USING "btree" ("is_approved", "is_submitted", "role", "height_inches") WHERE (("is_approved" = true) AND ("is_submitted" = true) AND ("role" = 'USER'::"text"));



CREATE INDEX "idx_profiles_filter_essentials" ON "public"."profiles" USING "btree" ("resident_country", "kovil", "gender") WHERE ("is_approved" = true);



CREATE INDEX "idx_profiles_interests_gin" ON "public"."profiles" USING "gin" ("interests");



CREATE INDEX "idx_profiles_keyset_updated_id" ON "public"."profiles" USING "btree" ("is_approved", "is_submitted", "role", "updated_at" DESC, "id" DESC) WHERE (("is_approved" = true) AND ("is_submitted" = true) AND ("role" = 'USER'::"text"));



CREATE INDEX "idx_profiles_location" ON "public"."profiles" USING "btree" ("resident_country") WHERE (("is_approved" = true) AND ("role" = 'USER'::"text"));



CREATE INDEX "idx_profiles_marital_status" ON "public"."profiles" USING "btree" ("marital_status") WHERE (("is_approved" = true) AND ("role" = 'USER'::"text"));



CREATE INDEX "idx_profiles_performance_bundle" ON "public"."profiles" USING "btree" ("is_approved", "is_submitted", "role", "created_at" DESC);

ALTER TABLE "public"."profiles" CLUSTER ON "idx_profiles_performance_bundle";



CREATE INDEX "idx_profiles_search_covering" ON "public"."profiles" USING "btree" ("is_approved", "is_submitted", "role", "created_at" DESC) INCLUDE ("id", "full_name", "profile_photo_url", "resident_country", "kovil", "age");



CREATE INDEX "idx_profiles_search_filters" ON "public"."profiles" USING "btree" ("is_approved", "is_submitted", "role", "resident_country", "kovil");



CREATE INDEX "idx_profiles_search_lookup" ON "public"."profiles" USING "btree" ("resident_country", "kovil", "pirivu");



CREATE INDEX "idx_profiles_test_data" ON "public"."profiles" USING "btree" ("is_test_data") WHERE ("is_test_data" = true);



CREATE INDEX "profiles_age_idx" ON "public"."profiles" USING "btree" ("age") WHERE (("is_approved" = true) AND ("is_submitted" = true) AND ("role" = 'USER'::"text") AND ("age" IS NOT NULL));



CREATE INDEX "profiles_approved_submitted_age" ON "public"."profiles" USING "btree" ("is_approved", "is_submitted", "age");



CREATE INDEX "profiles_approved_submitted_height" ON "public"."profiles" USING "btree" ("is_approved", "is_submitted", "height");



CREATE INDEX "profiles_approved_submitted_updated" ON "public"."profiles" USING "btree" ("is_approved", "is_submitted", "updated_at" DESC);



CREATE INDEX "profiles_city_trgm_idx" ON "public"."profiles" USING "gin" ("current_city" "public"."gin_trgm_ops") WHERE (("is_approved" = true) AND ("is_submitted" = true) AND ("role" = 'USER'::"text"));



CREATE INDEX "profiles_full_name_trgm_idx" ON "public"."profiles" USING "gin" ("full_name" "public"."gin_trgm_ops") WHERE (("is_approved" = true) AND ("is_submitted" = true) AND ("role" = 'USER'::"text"));



CREATE INDEX "profiles_height_inches_idx" ON "public"."profiles" USING "btree" ("height_inches") WHERE (("is_approved" = true) AND ("is_submitted" = true) AND ("role" = 'USER'::"text") AND ("height_inches" IS NOT NULL));



CREATE INDEX "profiles_interests_gin_idx" ON "public"."profiles" USING "gin" ("interests") WHERE (("is_approved" = true) AND ("is_submitted" = true) AND ("role" = 'USER'::"text"));



CREATE INDEX "profiles_kovil_facet_idx" ON "public"."profiles" USING "btree" ("kovil") WHERE (("is_approved" = true) AND ("is_submitted" = true) AND ("role" = 'USER'::"text") AND ("kovil" IS NOT NULL));



CREATE INDEX "profiles_kovil_idx" ON "public"."profiles" USING "btree" ("kovil") WHERE (("is_approved" = true) AND ("is_submitted" = true) AND ("role" = 'USER'::"text"));



CREATE INDEX "profiles_native_place_idx" ON "public"."profiles" USING "btree" ("native_place") WHERE (("is_approved" = true) AND ("is_submitted" = true) AND ("role" = 'USER'::"text"));



CREATE INDEX "profiles_pirivu_idx" ON "public"."profiles" USING "btree" ("pirivu") WHERE (("is_approved" = true) AND ("is_submitted" = true) AND ("role" = 'USER'::"text"));



CREATE INDEX "profiles_profession_trgm_idx" ON "public"."profiles" USING "gin" ("profession" "public"."gin_trgm_ops") WHERE (("is_approved" = true) AND ("is_submitted" = true) AND ("role" = 'USER'::"text"));



CREATE INDEX "profiles_resident_country_idx" ON "public"."profiles" USING "btree" ("resident_country") WHERE (("is_approved" = true) AND ("is_submitted" = true) AND ("role" = 'USER'::"text") AND ("resident_country" IS NOT NULL));



CREATE INDEX "profiles_search_filters_idx" ON "public"."profiles" USING "btree" ("gender", "resident_country", "marital_status") WHERE (("is_approved" = true) AND ("is_submitted" = true) AND ("role" = 'USER'::"text") AND ("upper"(COALESCE("account_status", 'ACTIVE'::"text")) = 'ACTIVE'::"text"));



CREATE INDEX "profiles_state_trgm_idx" ON "public"."profiles" USING "gin" ("current_state" "public"."gin_trgm_ops") WHERE (("is_approved" = true) AND ("is_submitted" = true) AND ("role" = 'USER'::"text"));



CREATE INDEX "profiles_testdata_idx" ON "public"."profiles" USING "btree" ("id") WHERE ("is_test_data" IS TRUE);



CREATE OR REPLACE TRIGGER "trg_announcements_updated_at" BEFORE UPDATE ON "public"."announcements" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_enforce_favorites_limit" BEFORE INSERT ON "public"."favorites" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_favorites_limit"();



CREATE OR REPLACE TRIGGER "trg_enforce_moderator_profile_update" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_moderator_profile_update"();



CREATE OR REPLACE TRIGGER "trg_reset_profile_role_on_user_roles_delete" AFTER DELETE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."reset_profile_role_on_user_roles_delete"();



CREATE OR REPLACE TRIGGER "trg_sync_height_inches" BEFORE INSERT OR UPDATE OF "height" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_height_inches"();



CREATE OR REPLACE TRIGGER "trg_sync_profile_role_from_user_roles" AFTER INSERT OR UPDATE OF "role" ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_profile_role_from_user_roles"();



CREATE OR REPLACE TRIGGER "trigger_calculate_age" BEFORE INSERT OR UPDATE OF "dob" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_age"();



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_favorite_id_fkey" FOREIGN KEY ("favorite_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Admin full access" ON "public"."announcements" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin full access" ON "public"."audit_logs" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin full access" ON "public"."reports" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admin full access" ON "public"."system_settings" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can view all reports" ON "public"."reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role" = 'ADMIN'::"text") OR ("profiles"."role" = 'MODERATOR'::"text"))))));



CREATE POLICY "Admins can view logs" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'ADMIN'::"text")))));



CREATE POLICY "Admins full access on announcements" ON "public"."announcements" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'ADMIN'::"text")))));



CREATE POLICY "Admins full access on settings" ON "public"."system_settings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'ADMIN'::"text")))));



CREATE POLICY "Admins manage all profiles" ON "public"."profiles" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins manage favorites" ON "public"."favorites" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins manage user_roles" ON "public"."user_roles" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Anyone can read announcements" ON "public"."announcements" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can read settings" ON "public"."system_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Moderators can approve/review profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ("public"."is_moderator"()) WITH CHECK ("public"."is_moderator"());



CREATE POLICY "Search approved profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("is_approved" = true));



CREATE POLICY "Staff can review all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "Staff can see all roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ("public"."is_staff"());



CREATE POLICY "Staff can view settings" ON "public"."system_settings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role" = 'ADMIN'::"text") OR ("profiles"."role" = 'MODERATOR'::"text"))))));



CREATE POLICY "Staff view settings" ON "public"."system_settings" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role" = 'ADMIN'::"text") OR ("profiles"."role" = 'MODERATOR'::"text"))))));



CREATE POLICY "Users can read own role" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own role" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."announcements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."favorites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "favorites_delete_own" ON "public"."favorites" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "favorites_insert_own" ON "public"."favorites" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "favorites_select_own" ON "public"."favorites" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "read_published_announcements" ON "public"."announcements" FOR SELECT TO "authenticated" USING (("is_published" = true));



ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "staff_can_delete_own_announcements" ON "public"."announcements" FOR DELETE TO "authenticated" USING ((("author_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("upper"(COALESCE("p"."role", ''::"text")) = ANY (ARRAY['ADMIN'::"text", 'MODERATOR'::"text"])))))));



CREATE POLICY "staff_can_insert_announcements" ON "public"."announcements" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("upper"(COALESCE("p"."role", ''::"text")) = ANY (ARRAY['ADMIN'::"text", 'MODERATOR'::"text"]))))));



CREATE POLICY "staff_can_update_own_announcements" ON "public"."announcements" FOR UPDATE TO "authenticated" USING ((("author_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("upper"(COALESCE("p"."role", ''::"text")) = ANY (ARRAY['ADMIN'::"text", 'MODERATOR'::"text"]))))))) WITH CHECK (("author_id" = "auth"."uid"()));



ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT ALL ON SCHEMA "public" TO PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "anon";

























































































































































GRANT ALL ON FUNCTION "public"."get_filter_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_filter_metadata"() TO "anon";



GRANT ALL ON FUNCTION "public"."get_profile_by_id_v1"("p_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_profile_by_id_v1"("p_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_moderator"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_moderator"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_staff"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_staff"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."purge_test_data"("batch_size" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."purge_test_data"("batch_size" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."search_profile_cards_v1"("p_query" "text", "p_min_age" integer, "p_max_age" integer, "p_min_height" integer, "p_max_height" integer, "p_countries" "text"[], "p_marital_statuses" "text"[], "p_interests" "text"[], "p_education" "text"[], "p_exclude_kovil_pirivu" "text"[], "p_page_size" integer, "p_cursor_updated_at" timestamp with time zone, "p_cursor_id" "uuid", "p_exclude_user_id" "uuid", "p_forced_gender" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_profile_cards_v1"("p_query" "text", "p_min_age" integer, "p_max_age" integer, "p_min_height" integer, "p_max_height" integer, "p_countries" "text"[], "p_marital_statuses" "text"[], "p_interests" "text"[], "p_education" "text"[], "p_exclude_kovil_pirivu" "text"[], "p_page_size" integer, "p_cursor_updated_at" timestamp with time zone, "p_cursor_id" "uuid", "p_exclude_user_id" "uuid", "p_forced_gender" "text") TO "anon";



GRANT ALL ON FUNCTION "public"."search_profiles_v2"("p_query" "text", "p_min_age" integer, "p_max_age" integer, "p_min_height" integer, "p_max_height" integer, "p_countries" "text"[], "p_marital_statuses" "text"[], "p_educations" "text"[], "p_interests" "text"[], "p_exclude_kovil_pirivu" "text"[], "p_page_size" integer, "p_cursor_updated_at" timestamp with time zone, "p_cursor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_profiles_v2"("p_query" "text", "p_min_age" integer, "p_max_age" integer, "p_min_height" integer, "p_max_height" integer, "p_countries" "text"[], "p_marital_statuses" "text"[], "p_educations" "text"[], "p_interests" "text"[], "p_exclude_kovil_pirivu" "text"[], "p_page_size" integer, "p_cursor_updated_at" timestamp with time zone, "p_cursor_id" "uuid") TO "anon";


















GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."announcements" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."announcements" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."audit_logs" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."audit_logs" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."favorites" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."favorites" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."reports" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."reports" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."system_settings" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."system_settings" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."user_roles" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";


































drop extension if exists "pg_net";

revoke references on table "public"."announcements" from "anon";

revoke trigger on table "public"."announcements" from "anon";

revoke truncate on table "public"."announcements" from "anon";

revoke references on table "public"."announcements" from "authenticated";

revoke trigger on table "public"."announcements" from "authenticated";

revoke truncate on table "public"."announcements" from "authenticated";

revoke delete on table "public"."announcements" from "service_role";

revoke insert on table "public"."announcements" from "service_role";

revoke references on table "public"."announcements" from "service_role";

revoke select on table "public"."announcements" from "service_role";

revoke trigger on table "public"."announcements" from "service_role";

revoke truncate on table "public"."announcements" from "service_role";

revoke update on table "public"."announcements" from "service_role";

revoke references on table "public"."audit_logs" from "anon";

revoke trigger on table "public"."audit_logs" from "anon";

revoke truncate on table "public"."audit_logs" from "anon";

revoke references on table "public"."audit_logs" from "authenticated";

revoke trigger on table "public"."audit_logs" from "authenticated";

revoke truncate on table "public"."audit_logs" from "authenticated";

revoke delete on table "public"."audit_logs" from "service_role";

revoke insert on table "public"."audit_logs" from "service_role";

revoke references on table "public"."audit_logs" from "service_role";

revoke select on table "public"."audit_logs" from "service_role";

revoke trigger on table "public"."audit_logs" from "service_role";

revoke truncate on table "public"."audit_logs" from "service_role";

revoke update on table "public"."audit_logs" from "service_role";

revoke references on table "public"."favorites" from "anon";

revoke trigger on table "public"."favorites" from "anon";

revoke truncate on table "public"."favorites" from "anon";

revoke references on table "public"."favorites" from "authenticated";

revoke trigger on table "public"."favorites" from "authenticated";

revoke truncate on table "public"."favorites" from "authenticated";

revoke delete on table "public"."favorites" from "service_role";

revoke insert on table "public"."favorites" from "service_role";

revoke references on table "public"."favorites" from "service_role";

revoke select on table "public"."favorites" from "service_role";

revoke trigger on table "public"."favorites" from "service_role";

revoke truncate on table "public"."favorites" from "service_role";

revoke update on table "public"."favorites" from "service_role";

revoke references on table "public"."profiles" from "anon";

revoke trigger on table "public"."profiles" from "anon";

revoke truncate on table "public"."profiles" from "anon";

revoke references on table "public"."profiles" from "authenticated";

revoke trigger on table "public"."profiles" from "authenticated";

revoke truncate on table "public"."profiles" from "authenticated";

revoke references on table "public"."reports" from "anon";

revoke trigger on table "public"."reports" from "anon";

revoke truncate on table "public"."reports" from "anon";

revoke references on table "public"."reports" from "authenticated";

revoke trigger on table "public"."reports" from "authenticated";

revoke truncate on table "public"."reports" from "authenticated";

revoke delete on table "public"."reports" from "service_role";

revoke insert on table "public"."reports" from "service_role";

revoke references on table "public"."reports" from "service_role";

revoke select on table "public"."reports" from "service_role";

revoke trigger on table "public"."reports" from "service_role";

revoke truncate on table "public"."reports" from "service_role";

revoke update on table "public"."reports" from "service_role";

revoke references on table "public"."system_settings" from "anon";

revoke trigger on table "public"."system_settings" from "anon";

revoke truncate on table "public"."system_settings" from "anon";

revoke references on table "public"."system_settings" from "authenticated";

revoke trigger on table "public"."system_settings" from "authenticated";

revoke truncate on table "public"."system_settings" from "authenticated";

revoke delete on table "public"."system_settings" from "service_role";

revoke insert on table "public"."system_settings" from "service_role";

revoke references on table "public"."system_settings" from "service_role";

revoke select on table "public"."system_settings" from "service_role";

revoke trigger on table "public"."system_settings" from "service_role";

revoke truncate on table "public"."system_settings" from "service_role";

revoke update on table "public"."system_settings" from "service_role";

revoke references on table "public"."user_roles" from "anon";

revoke trigger on table "public"."user_roles" from "anon";

revoke truncate on table "public"."user_roles" from "anon";

revoke references on table "public"."user_roles" from "authenticated";

revoke trigger on table "public"."user_roles" from "authenticated";

revoke truncate on table "public"."user_roles" from "authenticated";


