-- Baseline schema: a pg_dump --schema-only --no-owner --no-privileges --schema=public
-- snapshot of production (project ufmzldfkdpjeyvjfpoid) taken 2026-04-19.
-- 
-- This consolidates migrations 001-017 which had diverged from the live database
-- (many tables and views had been created directly in the Supabase dashboard and
-- never backported). Originals are preserved in supabase/migrations_legacy/.
-- 
-- Local `supabase db reset` applies this single file and results in a local DB
-- that matches production exactly. Future schema changes add 002_*.sql onward.

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9 (Debian 17.9-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: action_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.action_priority AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
);


--
-- Name: action_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.action_status AS ENUM (
    'pending',
    'completed',
    'dismissed'
);


--
-- Name: division; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.division AS ENUM (
    'FBS',
    'FCS',
    'DII',
    'DIII',
    'JUCO',
    'NAIA'
);


--
-- Name: email_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.email_status AS ENUM (
    'queued',
    'sent',
    'delivered',
    'opened',
    'bounced',
    'failed'
);


--
-- Name: interaction_direction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.interaction_direction AS ENUM (
    'inbound',
    'outbound'
);


--
-- Name: interaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.interaction_type AS ENUM (
    'email_sent',
    'email_received',
    'dm_sent',
    'dm_received',
    'call',
    'visit',
    'film_sent',
    'questionnaire',
    'camp_invite',
    'offer',
    'other'
);


--
-- Name: pipeline_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pipeline_status AS ENUM (
    'active',
    'dead',
    'committed'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'athlete',
    'admin',
    'coach'
);


--
-- Name: broadcast_email_notification_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.broadcast_email_notification_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  PERFORM realtime.broadcast_changes(
    'email-notifications:updates',
    TG_OP,
    TG_OP,
    TG_TABLE_NAME,
    TG_TABLE_SCHEMA,
    NEW,
    OLD
  );
  RETURN NULL;
END;
$$;


--
-- Name: custom_access_token_hook(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.custom_access_token_hook(event jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    AS $$
  DECLARE
    original_claims jsonb;
    new_claims jsonb;
    claim text;
  BEGIN
    original_claims := event->'claims';
    new_claims := '{}'::jsonb;

    FOREACH claim IN ARRAY ARRAY[
      'iss',
      'aud',
      'exp',
      'iat',
      'sub',
      'role',
      'aal',
      'session_id',
      'email',
      'phone',
      'is_anonymous'
    ] LOOP
      IF original_claims ? claim THEN
        new_claims := jsonb_set(new_claims, ARRAY[claim], original_claims->claim);
      END IF;
    END LOOP;

    RETURN jsonb_build_object('claims', new_claims);
  END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
      BEGIN
        INSERT INTO public.profiles (id, email, first_name, last_name)
        VALUES (
          NEW.id,
          NEW.email,
          NEW.raw_user_meta_data->>'first_name',
          NEW.raw_user_meta_data->>'last_name'
        )
        ON CONFLICT (id) DO UPDATE SET
          email = COALESCE(profiles.email, EXCLUDED.email),
          first_name = COALESCE(profiles.first_name, EXCLUDED.first_name),
          last_name = COALESCE(profiles.last_name, EXCLUDED.last_name),
          updated_at = NOW();
        RETURN NEW;
      END;
      $$;


--
-- Name: is_admin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin(user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
        SELECT EXISTS (
          SELECT 1 FROM public.profiles WHERE id = user_id AND role = 'admin'
        )
      $$;


--
-- Name: schedule_campaign_send(text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.schedule_campaign_send(p_campaign_id text, p_send_at timestamp with time zone) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_job_name TEXT;
  v_cron_expr TEXT;
  v_job_id BIGINT;
  v_url TEXT;
  v_secret TEXT;
BEGIN
  v_job_name := 'campaign_' || p_campaign_id;

  -- Read config from system_settings
  SELECT value INTO v_url FROM system_settings WHERE key = 'process_queue_url';
  SELECT value INTO v_secret FROM system_settings WHERE key = 'cron_secret';

  -- Convert send_at to UTC cron expression (minute hour day month *)
  v_cron_expr := EXTRACT(MINUTE FROM p_send_at AT TIME ZONE 'UTC') || ' ' ||
                 EXTRACT(HOUR FROM p_send_at AT TIME ZONE 'UTC') || ' ' ||
                 EXTRACT(DAY FROM p_send_at AT TIME ZONE 'UTC') || ' ' ||
                 EXTRACT(MONTH FROM p_send_at AT TIME ZONE 'UTC') || ' *';

  -- Schedule the job
  SELECT cron.schedule(
    v_job_name,
    v_cron_expr,
    format(
      'SELECT net.http_get(url := %L, headers := %L::jsonb); SELECT cron.unschedule(%L);',
      v_url,
      json_build_object('Authorization', 'Bearer ' || v_secret)::text,
      v_job_name
    )
  ) INTO v_job_id;

  RETURN v_job_id;
END;
$$;


--
-- Name: unschedule_campaign_send(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unschedule_campaign_send(p_campaign_id text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  PERFORM cron.unschedule('campaign_' || p_campaign_id);
EXCEPTION WHEN OTHERS THEN
  -- Job may not exist, that's fine
  NULL;
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: access_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    user_email text NOT NULL,
    user_name text,
    coach_profile_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    program_id uuid,
    request_type text DEFAULT 'program'::text NOT NULL
);


--
-- Name: action_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    athlete_id uuid NOT NULL,
    pipeline_entry_id uuid,
    title text NOT NULL,
    description text,
    due_date date,
    priority public.action_priority DEFAULT 'medium'::public.action_priority NOT NULL,
    status public.action_status DEFAULT 'pending'::public.action_status NOT NULL,
    auto_generated boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: athlete_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.athlete_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    athlete_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    type text DEFAULT 'link'::text NOT NULL,
    url text,
    file_path text,
    file_name text,
    file_size integer,
    file_type text,
    display_order integer DEFAULT 0 NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    folder_id uuid
);


--
-- Name: campaign_recipients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_recipients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    coach_id uuid,
    coach_name text,
    coach_email text,
    program_name text,
    current_step integer DEFAULT 1,
    status text DEFAULT 'pending'::text,
    next_send_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    twitter_handle text,
    dm_sent_at timestamp with time zone,
    twitter_user_id text,
    is_read boolean DEFAULT false NOT NULL,
    filed_at timestamp with time zone,
    filed_program_id uuid,
    filed_coach_id uuid,
    sent_at timestamp with time zone,
    opened_at timestamp with time zone,
    scanner_detected_at timestamp with time zone,
    CONSTRAINT campaign_recipients_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'scheduled'::text, 'sending'::text, 'sent'::text, 'replied'::text, 'bounced'::text, 'unsubscribed'::text, 'error'::text])))
);


--
-- Name: COLUMN campaign_recipients.scanner_detected_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.campaign_recipients.scanner_detected_at IS 'Set when honeypot link is triggered — indicates email security scanner is active for this recipient';


--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    name text NOT NULL,
    goal text NOT NULL,
    status text DEFAULT 'draft'::text,
    scheduled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    type text DEFAULT 'email'::text NOT NULL,
    dm_message_body text,
    player_id uuid,
    CONSTRAINT campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: email_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    recipient_id uuid,
    event_type text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    scanner_flagged_at timestamp with time zone,
    CONSTRAINT email_events_event_type_check CHECK ((event_type = ANY (ARRAY['sent'::text, 'opened'::text, 'clicked'::text, 'replied'::text, 'bounced'::text])))
);


--
-- Name: COLUMN email_events.scanner_flagged_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email_events.scanner_flagged_at IS 'Set when honeypot or cohort analysis identifies this event as scanner-generated. Excluded from stats but never deleted.';


--
-- Name: campaign_clean_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.campaign_clean_stats AS
 SELECT c.id AS campaign_id,
    count(DISTINCT cr.id) AS total_recipients,
    count(DISTINCT
        CASE
            WHEN (ee.event_type = 'sent'::text) THEN ee.recipient_id
            ELSE NULL::uuid
        END) AS sent_count,
    count(DISTINCT
        CASE
            WHEN ((ee.event_type = 'opened'::text) AND (ee.scanner_flagged_at IS NULL)) THEN ee.recipient_id
            ELSE NULL::uuid
        END) AS unique_opens,
    count(DISTINCT
        CASE
            WHEN ((ee.event_type = 'clicked'::text) AND (ee.scanner_flagged_at IS NULL)) THEN ee.recipient_id
            ELSE NULL::uuid
        END) AS unique_clickers,
    count(
        CASE
            WHEN ((ee.event_type = 'clicked'::text) AND (ee.scanner_flagged_at IS NULL)) THEN 1
            ELSE NULL::integer
        END) AS total_clicks,
    count(DISTINCT
        CASE
            WHEN (ee.event_type = 'replied'::text) THEN ee.recipient_id
            ELSE NULL::uuid
        END) AS replied_count,
    count(DISTINCT
        CASE
            WHEN (cr.status = ANY (ARRAY['bounced'::text, 'error'::text])) THEN cr.id
            ELSE NULL::uuid
        END) AS error_count
   FROM ((public.campaigns c
     LEFT JOIN public.campaign_recipients cr ON ((cr.campaign_id = c.id)))
     LEFT JOIN public.email_events ee ON ((ee.recipient_id = cr.id)))
  GROUP BY c.id;


--
-- Name: VIEW campaign_clean_stats; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.campaign_clean_stats IS 'Single source of truth for campaign engagement stats. Excludes scanner-flagged events from opens/clicks. ALL pages and APIs that display open/click counts MUST query this view, never email_events directly.';


--
-- Name: campaign_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    step_number integer NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    delay_days integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    name text
);


--
-- Name: coach_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coach_players (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id uuid NOT NULL,
    player_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: coach_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coach_profiles (
    id uuid NOT NULL,
    program_name text NOT NULL,
    title text,
    logo_url text,
    primary_color text,
    accent_color text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    landing_slug text
);


--
-- Name: coaches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coaches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_id uuid NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    title text,
    email text,
    phone text,
    twitter_handle text,
    twitter_dm_open boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    rml_source_key text,
    cc_source_key text,
    facebook_handle text,
    instagram_handle text,
    twitter_dm_checked_at timestamp with time zone
);


--
-- Name: coaches_backup_2026_04_17; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coaches_backup_2026_04_17 (
    id uuid,
    program_id uuid,
    first_name text,
    last_name text,
    title text,
    email text,
    phone text,
    twitter_handle text,
    twitter_dm_open boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    is_active boolean,
    rml_source_key text,
    cc_source_key text,
    facebook_handle text,
    instagram_handle text,
    twitter_dm_checked_at timestamp with time zone
);


--
-- Name: compose_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compose_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    message_id text NOT NULL,
    to_address text NOT NULL,
    subject text NOT NULL,
    sent_at timestamp with time zone DEFAULT now()
);


--
-- Name: email_allowlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_allowlist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: email_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_notifications (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    account_key text NOT NULL,
    thread_id text,
    message_id text,
    from_address text,
    to_address text,
    subject text,
    summary text,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.email_notifications ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.email_notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: email_send_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_send_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    campaign_id uuid,
    recipient_email text NOT NULL,
    gmail_message_id text,
    sent_at timestamp with time zone DEFAULT now()
);


--
-- Name: email_sends; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_sends (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    athlete_id uuid NOT NULL,
    template_id uuid,
    coach_id uuid NOT NULL,
    to_email text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    status public.email_status DEFAULT 'queued'::public.email_status NOT NULL,
    sent_at timestamp with time zone,
    opened_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    stage_id uuid,
    subject text NOT NULL,
    body text NOT NULL,
    created_by uuid,
    is_system boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    for_role text DEFAULT 'athlete'::text
);


--
-- Name: filed_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.filed_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    gmail_message_id text NOT NULL,
    thread_id text,
    from_email text,
    from_name text,
    subject text,
    snippet text,
    received_at timestamp with time zone,
    filed_at timestamp with time zone DEFAULT now() NOT NULL,
    coach_id uuid,
    program_id uuid,
    coach_name text,
    program_name text,
    division text,
    conference text
);


--
-- Name: gmail_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gmail_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    token_expiry timestamp with time zone NOT NULL,
    email text NOT NULL,
    connected_at timestamp with time zone DEFAULT now(),
    account_tier text DEFAULT 'new'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT gmail_tokens_account_tier_check CHECK ((account_tier = ANY (ARRAY['new'::text, 'building'::text, 'established'::text, 'veteran'::text])))
);


--
-- Name: interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.interactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pipeline_entry_id uuid NOT NULL,
    athlete_id uuid NOT NULL,
    coach_id uuid,
    type public.interaction_type NOT NULL,
    direction public.interaction_direction NOT NULL,
    subject text,
    body text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: managed_programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.managed_programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_name text NOT NULL,
    mascot text,
    city text,
    state text,
    landing_slug text,
    logo_url text,
    primary_color text DEFAULT '#0047AB'::text,
    secondary_color text DEFAULT '#FFFFFF'::text,
    accent_color text DEFAULT '#CC0000'::text,
    twitter_username text,
    hudl_url text,
    instagram_username text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    coach_invite_code text,
    player_invite_code text,
    max_coaches integer DEFAULT 5 NOT NULL,
    max_players integer DEFAULT 30 NOT NULL,
    background_image_url text
);


--
-- Name: pipeline_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    athlete_id uuid NOT NULL,
    program_id uuid NOT NULL,
    stage_id uuid NOT NULL,
    primary_coach_id uuid,
    status public.pipeline_status DEFAULT 'active'::public.pipeline_status NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pipeline_stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_stages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    display_order integer NOT NULL,
    description text
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    role public.user_role DEFAULT 'athlete'::public.user_role NOT NULL,
    first_name text,
    last_name text,
    email text,
    phone text,
    grad_year integer,
    high_school text,
    city text,
    state text,
    "position" text,
    height text,
    weight integer,
    gpa numeric(3,2),
    hudl_url text,
    twitter_handle text,
    profile_image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    can_send_emails boolean DEFAULT true NOT NULL,
    share_slug text,
    readiness_score_open boolean DEFAULT true,
    username text,
    workspace_email text,
    recovery_email text,
    jersey_number text,
    stripe_customer_id text,
    is_grandfathered boolean DEFAULT false NOT NULL,
    zoho_account_key text,
    title text,
    registered_via text,
    instagram_handle text,
    primary_video_url text,
    email_banner_dismissed boolean DEFAULT false NOT NULL,
    coach_name text,
    coach_phone text,
    coach_email text,
    sms_notifications_enabled boolean DEFAULT true NOT NULL
);


--
-- Name: COLUMN profiles.registered_via; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.registered_via IS 'Registration origin: ''main_site'' = prod runwayrecruit.com, ''slug:{slug}'' = specific program landing page (e.g. slug:prairie-ia)';


--
-- Name: program_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_id uuid NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    registered_via text,
    CONSTRAINT program_members_role_check CHECK ((role = ANY (ARRAY['coach'::text, 'player'::text])))
);


--
-- Name: COLUMN program_members.registered_via; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.program_members.registered_via IS 'How this member joined: ''slug_registration'' = registered via the slug invite flow, ''admin_added'' = manually added by admin';


--
-- Name: program_twitter_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_twitter_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    program_id uuid NOT NULL,
    twitter_user_id text NOT NULL,
    twitter_handle text NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    token_expiry timestamp with time zone,
    connected_at timestamp with time zone DEFAULT now(),
    connected_by uuid
);


--
-- Name: programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_name text NOT NULL,
    division public.division NOT NULL,
    conference text,
    state text,
    city text,
    website text,
    logo_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    espn_id integer,
    rml_school_name text,
    twitter_handle text
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    stripe_customer_id text NOT NULL,
    stripe_subscription_id text,
    status text DEFAULT 'inactive'::text NOT NULL,
    plan text,
    current_period_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: twitter_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.twitter_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    twitter_user_id text NOT NULL,
    twitter_handle text NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    token_expiry timestamp with time zone,
    connected_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: unsubscribes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unsubscribes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    campaign_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: x_partner_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.x_partner_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    athlete_id uuid NOT NULL,
    twitter_handle text NOT NULL,
    twitter_user_id text,
    display_name text,
    profile_image_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: access_requests access_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_requests
    ADD CONSTRAINT access_requests_pkey PRIMARY KEY (id);


--
-- Name: access_requests access_requests_user_id_coach_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_requests
    ADD CONSTRAINT access_requests_user_id_coach_profile_id_key UNIQUE (user_id, coach_profile_id);


--
-- Name: action_items action_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_pkey PRIMARY KEY (id);


--
-- Name: athlete_documents athlete_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athlete_documents
    ADD CONSTRAINT athlete_documents_pkey PRIMARY KEY (id);


--
-- Name: campaign_emails campaign_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_emails
    ADD CONSTRAINT campaign_emails_pkey PRIMARY KEY (id);


--
-- Name: campaign_recipients campaign_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: coach_players coach_players_coach_id_player_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_players
    ADD CONSTRAINT coach_players_coach_id_player_id_key UNIQUE (coach_id, player_id);


--
-- Name: coach_players coach_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_players
    ADD CONSTRAINT coach_players_pkey PRIMARY KEY (id);


--
-- Name: coach_profiles coach_profiles_landing_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_profiles
    ADD CONSTRAINT coach_profiles_landing_slug_key UNIQUE (landing_slug);


--
-- Name: coach_profiles coach_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_profiles
    ADD CONSTRAINT coach_profiles_pkey PRIMARY KEY (id);


--
-- Name: coaches coaches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaches
    ADD CONSTRAINT coaches_pkey PRIMARY KEY (id);


--
-- Name: coaches coaches_program_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaches
    ADD CONSTRAINT coaches_program_name_key UNIQUE (program_id, first_name, last_name);


--
-- Name: compose_emails compose_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compose_emails
    ADD CONSTRAINT compose_emails_pkey PRIMARY KEY (id);


--
-- Name: email_allowlist email_allowlist_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_allowlist
    ADD CONSTRAINT email_allowlist_email_key UNIQUE (email);


--
-- Name: email_allowlist email_allowlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_allowlist
    ADD CONSTRAINT email_allowlist_pkey PRIMARY KEY (id);


--
-- Name: email_events email_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT email_events_pkey PRIMARY KEY (id);


--
-- Name: email_notifications email_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_notifications
    ADD CONSTRAINT email_notifications_pkey PRIMARY KEY (id);


--
-- Name: email_send_log email_send_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_send_log
    ADD CONSTRAINT email_send_log_pkey PRIMARY KEY (id);


--
-- Name: email_sends email_sends_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_sends
    ADD CONSTRAINT email_sends_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: filed_emails filed_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.filed_emails
    ADD CONSTRAINT filed_emails_pkey PRIMARY KEY (id);


--
-- Name: filed_emails filed_emails_user_id_gmail_message_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.filed_emails
    ADD CONSTRAINT filed_emails_user_id_gmail_message_id_key UNIQUE (user_id, gmail_message_id);


--
-- Name: gmail_tokens gmail_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gmail_tokens
    ADD CONSTRAINT gmail_tokens_pkey PRIMARY KEY (id);


--
-- Name: gmail_tokens gmail_tokens_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gmail_tokens
    ADD CONSTRAINT gmail_tokens_user_id_key UNIQUE (user_id);


--
-- Name: interactions interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interactions
    ADD CONSTRAINT interactions_pkey PRIMARY KEY (id);


--
-- Name: managed_programs managed_programs_coach_invite_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.managed_programs
    ADD CONSTRAINT managed_programs_coach_invite_code_key UNIQUE (coach_invite_code);


--
-- Name: managed_programs managed_programs_landing_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.managed_programs
    ADD CONSTRAINT managed_programs_landing_slug_key UNIQUE (landing_slug);


--
-- Name: managed_programs managed_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.managed_programs
    ADD CONSTRAINT managed_programs_pkey PRIMARY KEY (id);


--
-- Name: managed_programs managed_programs_player_invite_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.managed_programs
    ADD CONSTRAINT managed_programs_player_invite_code_key UNIQUE (player_invite_code);


--
-- Name: pipeline_entries pipeline_entries_athlete_id_program_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_entries
    ADD CONSTRAINT pipeline_entries_athlete_id_program_id_key UNIQUE (athlete_id, program_id);


--
-- Name: pipeline_entries pipeline_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_entries
    ADD CONSTRAINT pipeline_entries_pkey PRIMARY KEY (id);


--
-- Name: pipeline_stages pipeline_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_stages
    ADD CONSTRAINT pipeline_stages_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_share_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_share_slug_key UNIQUE (share_slug);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: profiles profiles_workspace_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_workspace_email_key UNIQUE (workspace_email);


--
-- Name: program_members program_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_members
    ADD CONSTRAINT program_members_pkey PRIMARY KEY (id);


--
-- Name: program_members program_members_program_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_members
    ADD CONSTRAINT program_members_program_id_email_key UNIQUE (program_id, email);


--
-- Name: program_twitter_tokens program_twitter_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_twitter_tokens
    ADD CONSTRAINT program_twitter_tokens_pkey PRIMARY KEY (id);


--
-- Name: program_twitter_tokens program_twitter_tokens_program_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_twitter_tokens
    ADD CONSTRAINT program_twitter_tokens_program_id_key UNIQUE (program_id);


--
-- Name: programs programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_pkey PRIMARY KEY (id);


--
-- Name: programs programs_school_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_school_name_key UNIQUE (school_name);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_stripe_subscription_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_stripe_subscription_id_key UNIQUE (stripe_subscription_id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: twitter_tokens twitter_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twitter_tokens
    ADD CONSTRAINT twitter_tokens_pkey PRIMARY KEY (id);


--
-- Name: twitter_tokens twitter_tokens_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twitter_tokens
    ADD CONSTRAINT twitter_tokens_user_id_key UNIQUE (user_id);


--
-- Name: unsubscribes unsubscribes_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unsubscribes
    ADD CONSTRAINT unsubscribes_email_key UNIQUE (email);


--
-- Name: unsubscribes unsubscribes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unsubscribes
    ADD CONSTRAINT unsubscribes_pkey PRIMARY KEY (id);


--
-- Name: x_partner_profiles x_partner_profiles_athlete_id_twitter_handle_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x_partner_profiles
    ADD CONSTRAINT x_partner_profiles_athlete_id_twitter_handle_key UNIQUE (athlete_id, twitter_handle);


--
-- Name: x_partner_profiles x_partner_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x_partner_profiles
    ADD CONSTRAINT x_partner_profiles_pkey PRIMARY KEY (id);


--
-- Name: idx_actions_athlete; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_actions_athlete ON public.action_items USING btree (athlete_id);


--
-- Name: idx_actions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_actions_status ON public.action_items USING btree (status);


--
-- Name: idx_athlete_documents_athlete; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_athlete_documents_athlete ON public.athlete_documents USING btree (athlete_id);


--
-- Name: idx_athlete_documents_folder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_athlete_documents_folder ON public.athlete_documents USING btree (folder_id);


--
-- Name: idx_athlete_documents_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_athlete_documents_order ON public.athlete_documents USING btree (athlete_id, display_order);


--
-- Name: idx_campaign_recipients_filed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_recipients_filed ON public.campaign_recipients USING btree (filed_program_id, filed_coach_id, filed_at) WHERE (filed_at IS NOT NULL);


--
-- Name: idx_campaign_recipients_inbox; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_recipients_inbox ON public.campaign_recipients USING btree (campaign_id, status, filed_at) WHERE (status = 'replied'::text);


--
-- Name: idx_campaign_recipients_next_send; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_recipients_next_send ON public.campaign_recipients USING btree (next_send_at) WHERE (status = ANY (ARRAY['pending'::text, 'scheduled'::text]));


--
-- Name: idx_campaigns_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_type ON public.campaigns USING btree (type);


--
-- Name: idx_campaigns_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaigns_user_status ON public.campaigns USING btree (user_id, status);


--
-- Name: idx_coach_players_coach; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coach_players_coach ON public.coach_players USING btree (coach_id);


--
-- Name: idx_coach_players_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coach_players_player ON public.coach_players USING btree (player_id);


--
-- Name: idx_coaches_cc_source_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coaches_cc_source_key ON public.coaches USING btree (cc_source_key) WHERE (cc_source_key IS NOT NULL);


--
-- Name: idx_coaches_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coaches_is_active ON public.coaches USING btree (is_active);


--
-- Name: idx_coaches_program; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coaches_program ON public.coaches USING btree (program_id);


--
-- Name: idx_coaches_rml_source_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coaches_rml_source_key ON public.coaches USING btree (rml_source_key);


--
-- Name: idx_compose_emails_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compose_emails_user ON public.compose_emails USING btree (user_id);


--
-- Name: idx_email_events_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_events_campaign ON public.email_events USING btree (campaign_id, event_type);


--
-- Name: idx_email_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_notifications_user_id ON public.email_notifications USING btree (user_id);


--
-- Name: idx_email_send_log_rate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_send_log_rate ON public.email_send_log USING btree (user_id, sent_at DESC);


--
-- Name: idx_email_sends_athlete; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_sends_athlete ON public.email_sends USING btree (athlete_id);


--
-- Name: idx_interactions_athlete; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_athlete ON public.interactions USING btree (athlete_id);


--
-- Name: idx_interactions_pipeline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_interactions_pipeline ON public.interactions USING btree (pipeline_entry_id);


--
-- Name: idx_managed_programs_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_managed_programs_slug ON public.managed_programs USING btree (landing_slug);


--
-- Name: idx_pipeline_athlete; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_athlete ON public.pipeline_entries USING btree (athlete_id);


--
-- Name: idx_pipeline_program; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_program ON public.pipeline_entries USING btree (program_id);


--
-- Name: idx_pipeline_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_stage ON public.pipeline_entries USING btree (stage_id);


--
-- Name: idx_profiles_share_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_share_slug ON public.profiles USING btree (share_slug);


--
-- Name: idx_program_members_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_program_members_email ON public.program_members USING btree (email);


--
-- Name: idx_program_members_program; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_program_members_program ON public.program_members USING btree (program_id);


--
-- Name: idx_programs_rml_school_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_programs_rml_school_name ON public.programs USING btree (rml_school_name);


--
-- Name: idx_unique_user_template_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_unique_user_template_name ON public.email_templates USING btree (lower(name), created_by) WHERE (is_system = false);


--
-- Name: email_notifications email_notifications_broadcast_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER email_notifications_broadcast_trigger AFTER INSERT ON public.email_notifications FOR EACH ROW EXECUTE FUNCTION public.broadcast_email_notification_changes();


--
-- Name: athlete_documents update_athlete_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_athlete_documents_updated_at BEFORE UPDATE ON public.athlete_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: coach_profiles update_coach_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_coach_profiles_updated_at BEFORE UPDATE ON public.coach_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: coaches update_coaches_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_coaches_updated_at BEFORE UPDATE ON public.coaches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: email_templates update_email_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: managed_programs update_managed_programs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_managed_programs_updated_at BEFORE UPDATE ON public.managed_programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: pipeline_entries update_pipeline_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_pipeline_entries_updated_at BEFORE UPDATE ON public.pipeline_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: programs update_programs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON public.programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: twitter_tokens update_twitter_tokens_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_twitter_tokens_updated_at BEFORE UPDATE ON public.twitter_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: access_requests access_requests_coach_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_requests
    ADD CONSTRAINT access_requests_coach_profile_id_fkey FOREIGN KEY (coach_profile_id) REFERENCES public.coach_profiles(id) ON DELETE CASCADE;


--
-- Name: access_requests access_requests_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_requests
    ADD CONSTRAINT access_requests_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.managed_programs(id) ON DELETE CASCADE;


--
-- Name: access_requests access_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_requests
    ADD CONSTRAINT access_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: action_items action_items_athlete_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_athlete_id_fkey FOREIGN KEY (athlete_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: action_items action_items_pipeline_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_items
    ADD CONSTRAINT action_items_pipeline_entry_id_fkey FOREIGN KEY (pipeline_entry_id) REFERENCES public.pipeline_entries(id) ON DELETE CASCADE;


--
-- Name: athlete_documents athlete_documents_athlete_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athlete_documents
    ADD CONSTRAINT athlete_documents_athlete_id_fkey FOREIGN KEY (athlete_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: athlete_documents athlete_documents_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.athlete_documents
    ADD CONSTRAINT athlete_documents_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.athlete_documents(id) ON DELETE SET NULL;


--
-- Name: campaign_emails campaign_emails_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_emails
    ADD CONSTRAINT campaign_emails_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_recipients campaign_recipients_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: campaign_recipients campaign_recipients_filed_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_filed_coach_id_fkey FOREIGN KEY (filed_coach_id) REFERENCES public.coaches(id);


--
-- Name: campaign_recipients campaign_recipients_filed_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT campaign_recipients_filed_program_id_fkey FOREIGN KEY (filed_program_id) REFERENCES public.programs(id);


--
-- Name: campaigns campaigns_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id);


--
-- Name: campaigns campaigns_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: coach_players coach_players_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_players
    ADD CONSTRAINT coach_players_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: coach_players coach_players_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_players
    ADD CONSTRAINT coach_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: coach_profiles coach_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coach_profiles
    ADD CONSTRAINT coach_profiles_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: coaches coaches_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coaches
    ADD CONSTRAINT coaches_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE CASCADE;


--
-- Name: compose_emails compose_emails_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compose_emails
    ADD CONSTRAINT compose_emails_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: email_events email_events_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT email_events_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;


--
-- Name: email_events email_events_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT email_events_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.campaign_recipients(id) ON DELETE CASCADE;


--
-- Name: email_notifications email_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_notifications
    ADD CONSTRAINT email_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: email_send_log email_send_log_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_send_log
    ADD CONSTRAINT email_send_log_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id);


--
-- Name: email_send_log email_send_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_send_log
    ADD CONSTRAINT email_send_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: email_sends email_sends_athlete_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_sends
    ADD CONSTRAINT email_sends_athlete_id_fkey FOREIGN KEY (athlete_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: email_sends email_sends_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_sends
    ADD CONSTRAINT email_sends_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.coaches(id);


--
-- Name: email_sends email_sends_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_sends
    ADD CONSTRAINT email_sends_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.email_templates(id);


--
-- Name: email_templates email_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: email_templates email_templates_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.pipeline_stages(id);


--
-- Name: filed_emails filed_emails_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.filed_emails
    ADD CONSTRAINT filed_emails_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.coaches(id);


--
-- Name: filed_emails filed_emails_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.filed_emails
    ADD CONSTRAINT filed_emails_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id);


--
-- Name: filed_emails filed_emails_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.filed_emails
    ADD CONSTRAINT filed_emails_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: gmail_tokens gmail_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gmail_tokens
    ADD CONSTRAINT gmail_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: interactions interactions_athlete_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interactions
    ADD CONSTRAINT interactions_athlete_id_fkey FOREIGN KEY (athlete_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: interactions interactions_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interactions
    ADD CONSTRAINT interactions_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.coaches(id);


--
-- Name: interactions interactions_pipeline_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.interactions
    ADD CONSTRAINT interactions_pipeline_entry_id_fkey FOREIGN KEY (pipeline_entry_id) REFERENCES public.pipeline_entries(id) ON DELETE CASCADE;


--
-- Name: pipeline_entries pipeline_entries_athlete_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_entries
    ADD CONSTRAINT pipeline_entries_athlete_id_fkey FOREIGN KEY (athlete_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: pipeline_entries pipeline_entries_primary_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_entries
    ADD CONSTRAINT pipeline_entries_primary_coach_id_fkey FOREIGN KEY (primary_coach_id) REFERENCES public.coaches(id);


--
-- Name: pipeline_entries pipeline_entries_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_entries
    ADD CONSTRAINT pipeline_entries_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE CASCADE;


--
-- Name: pipeline_entries pipeline_entries_stage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_entries
    ADD CONSTRAINT pipeline_entries_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES public.pipeline_stages(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: program_members program_members_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_members
    ADD CONSTRAINT program_members_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.managed_programs(id) ON DELETE CASCADE;


--
-- Name: program_members program_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_members
    ADD CONSTRAINT program_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: program_twitter_tokens program_twitter_tokens_connected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_twitter_tokens
    ADD CONSTRAINT program_twitter_tokens_connected_by_fkey FOREIGN KEY (connected_by) REFERENCES public.profiles(id);


--
-- Name: program_twitter_tokens program_twitter_tokens_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_twitter_tokens
    ADD CONSTRAINT program_twitter_tokens_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.managed_programs(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: twitter_tokens twitter_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.twitter_tokens
    ADD CONSTRAINT twitter_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: unsubscribes unsubscribes_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unsubscribes
    ADD CONSTRAINT unsubscribes_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id);


--
-- Name: x_partner_profiles x_partner_profiles_athlete_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.x_partner_profiles
    ADD CONSTRAINT x_partner_profiles_athlete_id_fkey FOREIGN KEY (athlete_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: coach_players Admins can manage coach_players; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage coach_players" ON public.coach_players USING (public.is_admin(auth.uid()));


--
-- Name: coach_profiles Admins can manage coach_profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage coach_profiles" ON public.coach_profiles USING (public.is_admin(auth.uid()));


--
-- Name: coaches Admins can manage coaches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage coaches" ON public.coaches USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: program_members Admins can manage members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage members" ON public.program_members USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: managed_programs Admins can manage programs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage programs" ON public.managed_programs USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: programs Admins can manage programs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage programs" ON public.programs USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: email_templates Admins can manage templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage templates" ON public.email_templates USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: subscriptions Admins manage subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins manage subscriptions" ON public.subscriptions USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
-- Name: coach_profiles Anyone can view coach_profiles by landing_slug; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view coach_profiles by landing_slug" ON public.coach_profiles FOR SELECT USING ((landing_slug IS NOT NULL));


--
-- Name: programs Anyone can view programs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view programs" ON public.programs FOR SELECT USING (true);


--
-- Name: athlete_documents Athletes can delete own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Athletes can delete own documents" ON public.athlete_documents FOR DELETE USING ((athlete_id = auth.uid()));


--
-- Name: athlete_documents Athletes can insert own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Athletes can insert own documents" ON public.athlete_documents FOR INSERT WITH CHECK ((athlete_id = auth.uid()));


--
-- Name: athlete_documents Athletes can update own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Athletes can update own documents" ON public.athlete_documents FOR UPDATE USING ((athlete_id = auth.uid()));


--
-- Name: athlete_documents Athletes can view own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Athletes can view own documents" ON public.athlete_documents FOR SELECT USING (((athlete_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role))))));


--
-- Name: x_partner_profiles Athletes manage own x partners; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Athletes manage own x partners" ON public.x_partner_profiles USING ((auth.uid() = athlete_id));


--
-- Name: action_items Athletes see own actions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Athletes see own actions" ON public.action_items USING (((athlete_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role))))));


--
-- Name: email_sends Athletes see own email sends; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Athletes see own email sends" ON public.email_sends USING (((athlete_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role))))));


--
-- Name: interactions Athletes see own interactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Athletes see own interactions" ON public.interactions USING (((athlete_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role))))));


--
-- Name: pipeline_entries Athletes see own pipeline; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Athletes see own pipeline" ON public.pipeline_entries USING (((athlete_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role))))));


--
-- Name: coaches Authenticated users can view coaches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view coaches" ON public.coaches FOR SELECT USING (true);


--
-- Name: pipeline_stages Authenticated users can view stages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view stages" ON public.pipeline_stages FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: email_templates Authenticated users can view templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view templates" ON public.email_templates FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: coach_profiles Coaches can update own coach_profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coaches can update own coach_profile" ON public.coach_profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: access_requests Coaches can update their access requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coaches can update their access requests" ON public.access_requests FOR UPDATE USING ((coach_profile_id = auth.uid()));


--
-- Name: pipeline_entries Coaches can view assigned player pipeline; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coaches can view assigned player pipeline" ON public.pipeline_entries FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.coach_players
  WHERE ((coach_players.coach_id = auth.uid()) AND (coach_players.player_id = pipeline_entries.athlete_id)))));


--
-- Name: profiles Coaches can view assigned player profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coaches can view assigned player profiles" ON public.profiles FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.coach_players
  WHERE ((coach_players.coach_id = auth.uid()) AND (coach_players.player_id = profiles.id)))));


--
-- Name: coach_players Coaches can view own coach_players; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coaches can view own coach_players" ON public.coach_players FOR SELECT USING ((auth.uid() = coach_id));


--
-- Name: coach_profiles Coaches can view own coach_profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coaches can view own coach_profile" ON public.coach_profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: access_requests Coaches can view their access requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Coaches can view their access requests" ON public.access_requests FOR SELECT USING ((coach_profile_id = auth.uid()));


--
-- Name: program_members Members can view own membership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view own membership" ON public.program_members FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: profiles New users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "New users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (((auth.uid() = id) AND (can_send_emails = false)));


--
-- Name: managed_programs Public read for landing pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read for landing pages" ON public.managed_programs FOR SELECT USING ((landing_slug IS NOT NULL));


--
-- Name: email_notifications Service role can insert notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert notifications" ON public.email_notifications FOR INSERT WITH CHECK (true);


--
-- Name: access_requests Users can create access requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create access requests" ON public.access_requests FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: email_notifications Users can read own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own notifications" ON public.email_notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: twitter_tokens Users can read own twitter tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own twitter tokens" ON public.twitter_tokens FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: access_requests Users can view their own requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own requests" ON public.access_requests FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: compose_emails Users insert own compose emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own compose emails" ON public.compose_emails FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: filed_emails Users manage own filed emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own filed emails" ON public.filed_emails USING ((auth.uid() = user_id));


--
-- Name: campaign_emails Users see own campaign_emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users see own campaign_emails" ON public.campaign_emails USING ((campaign_id IN ( SELECT campaigns.id
   FROM public.campaigns
  WHERE (campaigns.user_id = auth.uid()))));


--
-- Name: campaign_recipients Users see own campaign_recipients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users see own campaign_recipients" ON public.campaign_recipients USING ((campaign_id IN ( SELECT campaigns.id
   FROM public.campaigns
  WHERE (campaigns.user_id = auth.uid()))));


--
-- Name: campaigns Users see own campaigns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users see own campaigns" ON public.campaigns USING ((auth.uid() = user_id));


--
-- Name: compose_emails Users see own compose emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users see own compose emails" ON public.compose_emails FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: email_events Users see own email_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users see own email_events" ON public.email_events USING ((campaign_id IN ( SELECT campaigns.id
   FROM public.campaigns
  WHERE (campaigns.user_id = auth.uid()))));


--
-- Name: email_send_log Users see own email_send_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users see own email_send_log" ON public.email_send_log USING ((auth.uid() = user_id));


--
-- Name: gmail_tokens Users see own gmail_tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users see own gmail_tokens" ON public.gmail_tokens USING ((auth.uid() = user_id));


--
-- Name: subscriptions Users see own subscription; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users see own subscription" ON public.subscriptions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: access_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: action_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;

--
-- Name: athlete_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.athlete_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: campaign_recipients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

--
-- Name: campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_players; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coach_players ENABLE ROW LEVEL SECURITY;

--
-- Name: coach_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: coaches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;

--
-- Name: compose_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compose_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: email_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

--
-- Name: email_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: email_send_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

--
-- Name: email_sends; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;

--
-- Name: email_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: filed_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.filed_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: gmail_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: interactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;

--
-- Name: managed_programs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.managed_programs ENABLE ROW LEVEL SECURITY;

--
-- Name: pipeline_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pipeline_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: pipeline_stages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: program_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.program_members ENABLE ROW LEVEL SECURITY;

--
-- Name: programs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: twitter_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.twitter_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: unsubscribes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.unsubscribes ENABLE ROW LEVEL SECURITY;

--
-- Name: x_partner_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.x_partner_profiles ENABLE ROW LEVEL SECURITY;

--
-- Cross-schema trigger: auto-create public.profiles row when auth.users is inserted.
-- Not included in the pg_dump --schema=public output (trigger lives on auth.users),
-- pulled separately via Supabase MCP on 2026-04-19 to match prod behavior.
--
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

--
-- PostgreSQL database dump complete
--

