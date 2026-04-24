export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          coach_profile_id: string | null
          created_at: string
          id: string
          program_id: string | null
          request_type: string
          status: string
          updated_at: string
          user_email: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          coach_profile_id?: string | null
          created_at?: string
          id?: string
          program_id?: string | null
          request_type?: string
          status?: string
          updated_at?: string
          user_email: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          coach_profile_id?: string | null
          created_at?: string
          id?: string
          program_id?: string | null
          request_type?: string
          status?: string
          updated_at?: string
          user_email?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_requests_coach_profile_id_fkey"
            columns: ["coach_profile_id"]
            isOneToOne: false
            referencedRelation: "coach_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_requests_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "managed_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      action_items: {
        Row: {
          athlete_id: string
          auto_generated: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          pipeline_entry_id: string | null
          priority: Database["public"]["Enums"]["action_priority"]
          status: Database["public"]["Enums"]["action_status"]
          title: string
        }
        Insert: {
          athlete_id: string
          auto_generated?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          pipeline_entry_id?: string | null
          priority?: Database["public"]["Enums"]["action_priority"]
          status?: Database["public"]["Enums"]["action_status"]
          title: string
        }
        Update: {
          athlete_id?: string
          auto_generated?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          pipeline_entry_id?: string | null
          priority?: Database["public"]["Enums"]["action_priority"]
          status?: Database["public"]["Enums"]["action_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_items_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_pipeline_entry_id_fkey"
            columns: ["pipeline_entry_id"]
            isOneToOne: false
            referencedRelation: "pipeline_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_documents: {
        Row: {
          athlete_id: string
          created_at: string
          description: string | null
          display_order: number
          file_name: string | null
          file_path: string | null
          file_size: number | null
          file_type: string | null
          folder_id: string | null
          id: string
          is_visible: boolean
          title: string
          type: string
          updated_at: string
          url: string | null
        }
        Insert: {
          athlete_id: string
          created_at?: string
          description?: string | null
          display_order?: number
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          folder_id?: string | null
          id?: string
          is_visible?: boolean
          title: string
          type?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          athlete_id?: string
          created_at?: string
          description?: string | null
          display_order?: number
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          file_type?: string | null
          folder_id?: string | null
          id?: string
          is_visible?: boolean
          title?: string
          type?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_documents_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "athlete_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_emails: {
        Row: {
          body: string
          campaign_id: string | null
          created_at: string | null
          delay_days: number | null
          id: string
          name: string | null
          step_number: number
          subject: string
        }
        Insert: {
          body: string
          campaign_id?: string | null
          created_at?: string | null
          delay_days?: number | null
          id?: string
          name?: string | null
          step_number: number
          subject: string
        }
        Update: {
          body?: string
          campaign_id?: string | null
          created_at?: string | null
          delay_days?: number | null
          id?: string
          name?: string | null
          step_number?: number
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_emails_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_clean_stats"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "campaign_emails_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          campaign_id: string | null
          coach_email: string | null
          coach_id: string | null
          coach_name: string | null
          created_at: string | null
          current_step: number | null
          dm_sent_at: string | null
          filed_at: string | null
          filed_coach_id: string | null
          filed_program_id: string | null
          id: string
          is_read: boolean
          next_send_at: string | null
          opened_at: string | null
          program_name: string | null
          scanner_detected_at: string | null
          sent_at: string | null
          status: string | null
          twitter_handle: string | null
          twitter_user_id: string | null
          updated_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          coach_email?: string | null
          coach_id?: string | null
          coach_name?: string | null
          created_at?: string | null
          current_step?: number | null
          dm_sent_at?: string | null
          filed_at?: string | null
          filed_coach_id?: string | null
          filed_program_id?: string | null
          id?: string
          is_read?: boolean
          next_send_at?: string | null
          opened_at?: string | null
          program_name?: string | null
          scanner_detected_at?: string | null
          sent_at?: string | null
          status?: string | null
          twitter_handle?: string | null
          twitter_user_id?: string | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          coach_email?: string | null
          coach_id?: string | null
          coach_name?: string | null
          created_at?: string | null
          current_step?: number | null
          dm_sent_at?: string | null
          filed_at?: string | null
          filed_coach_id?: string | null
          filed_program_id?: string | null
          id?: string
          is_read?: boolean
          next_send_at?: string | null
          opened_at?: string | null
          program_name?: string | null
          scanner_detected_at?: string | null
          sent_at?: string | null
          status?: string | null
          twitter_handle?: string | null
          twitter_user_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_clean_stats"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_filed_coach_id_fkey"
            columns: ["filed_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_filed_program_id_fkey"
            columns: ["filed_program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string | null
          dm_message_body: string | null
          goal: string
          id: string
          name: string
          player_id: string | null
          scheduled_at: string | null
          status: string | null
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          dm_message_body?: string | null
          goal: string
          id?: string
          name: string
          player_id?: string | null
          scheduled_at?: string | null
          status?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          dm_message_body?: string | null
          goal?: string
          id?: string
          name?: string
          player_id?: string | null
          scheduled_at?: string | null
          status?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_players: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          player_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          player_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_players_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_profiles: {
        Row: {
          accent_color: string | null
          created_at: string
          id: string
          landing_slug: string | null
          logo_url: string | null
          primary_color: string | null
          program_name: string
          title: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          id: string
          landing_slug?: string | null
          logo_url?: string | null
          primary_color?: string | null
          program_name: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          id?: string
          landing_slug?: string | null
          logo_url?: string | null
          primary_color?: string | null
          program_name?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coaches: {
        Row: {
          cc_source_key: string | null
          created_at: string
          email: string | null
          facebook_handle: string | null
          first_name: string
          id: string
          instagram_handle: string | null
          is_active: boolean
          last_name: string
          phone: string | null
          program_id: string
          rml_source_key: string | null
          title: string | null
          twitter_dm_checked_at: string | null
          twitter_dm_open: boolean | null
          twitter_handle: string | null
          updated_at: string
        }
        Insert: {
          cc_source_key?: string | null
          created_at?: string
          email?: string | null
          facebook_handle?: string | null
          first_name: string
          id?: string
          instagram_handle?: string | null
          is_active?: boolean
          last_name: string
          phone?: string | null
          program_id: string
          rml_source_key?: string | null
          title?: string | null
          twitter_dm_checked_at?: string | null
          twitter_dm_open?: boolean | null
          twitter_handle?: string | null
          updated_at?: string
        }
        Update: {
          cc_source_key?: string | null
          created_at?: string
          email?: string | null
          facebook_handle?: string | null
          first_name?: string
          id?: string
          instagram_handle?: string | null
          is_active?: boolean
          last_name?: string
          phone?: string | null
          program_id?: string
          rml_source_key?: string | null
          title?: string | null
          twitter_dm_checked_at?: string | null
          twitter_dm_open?: boolean | null
          twitter_handle?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaches_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      coaches_backup_2026_04_17: {
        Row: {
          cc_source_key: string | null
          created_at: string | null
          email: string | null
          facebook_handle: string | null
          first_name: string | null
          id: string | null
          instagram_handle: string | null
          is_active: boolean | null
          last_name: string | null
          phone: string | null
          program_id: string | null
          rml_source_key: string | null
          title: string | null
          twitter_dm_checked_at: string | null
          twitter_dm_open: boolean | null
          twitter_handle: string | null
          updated_at: string | null
        }
        Insert: {
          cc_source_key?: string | null
          created_at?: string | null
          email?: string | null
          facebook_handle?: string | null
          first_name?: string | null
          id?: string | null
          instagram_handle?: string | null
          is_active?: boolean | null
          last_name?: string | null
          phone?: string | null
          program_id?: string | null
          rml_source_key?: string | null
          title?: string | null
          twitter_dm_checked_at?: string | null
          twitter_dm_open?: boolean | null
          twitter_handle?: string | null
          updated_at?: string | null
        }
        Update: {
          cc_source_key?: string | null
          created_at?: string | null
          email?: string | null
          facebook_handle?: string | null
          first_name?: string | null
          id?: string | null
          instagram_handle?: string | null
          is_active?: boolean | null
          last_name?: string | null
          phone?: string | null
          program_id?: string | null
          rml_source_key?: string | null
          title?: string | null
          twitter_dm_checked_at?: string | null
          twitter_dm_open?: boolean | null
          twitter_handle?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      compose_emails: {
        Row: {
          id: string
          message_id: string
          sent_at: string | null
          subject: string
          to_address: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          sent_at?: string | null
          subject: string
          to_address: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          sent_at?: string | null
          subject?: string
          to_address?: string
          user_id?: string
        }
        Relationships: []
      }
      email_allowlist: {
        Row: {
          created_at: string | null
          email: string
          id: string
          note: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          note?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          note?: string | null
        }
        Relationships: []
      }
      email_events: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          recipient_id: string | null
          scanner_flagged_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          recipient_id?: string | null
          scanner_flagged_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          recipient_id?: string | null
          scanner_flagged_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_clean_stats"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "email_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "campaign_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      email_notifications: {
        Row: {
          account_key: string
          created_at: string
          from_address: string | null
          id: number
          message_id: string | null
          received_at: string
          subject: string | null
          summary: string | null
          thread_id: string | null
          to_address: string | null
          user_id: string
        }
        Insert: {
          account_key: string
          created_at?: string
          from_address?: string | null
          id?: never
          message_id?: string | null
          received_at?: string
          subject?: string | null
          summary?: string | null
          thread_id?: string | null
          to_address?: string | null
          user_id: string
        }
        Update: {
          account_key?: string
          created_at?: string
          from_address?: string | null
          id?: never
          message_id?: string | null
          received_at?: string
          subject?: string | null
          summary?: string | null
          thread_id?: string | null
          to_address?: string | null
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          campaign_id: string | null
          gmail_message_id: string | null
          id: string
          recipient_email: string
          sent_at: string | null
          user_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          gmail_message_id?: string | null
          id?: string
          recipient_email: string
          sent_at?: string | null
          user_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          gmail_message_id?: string | null
          id?: string
          recipient_email?: string
          sent_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_send_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_clean_stats"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "email_send_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sends: {
        Row: {
          athlete_id: string
          body: string
          coach_id: string
          created_at: string
          id: string
          opened_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          subject: string
          template_id: string | null
          to_email: string
        }
        Insert: {
          athlete_id: string
          body: string
          coach_id: string
          created_at?: string
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject: string
          template_id?: string | null
          to_email: string
        }
        Update: {
          athlete_id?: string
          body?: string
          coach_id?: string
          created_at?: string
          id?: string
          opened_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string
          template_id?: string | null
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          for_role: string | null
          id: string
          is_system: boolean
          name: string
          stage_id: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          for_role?: string | null
          id?: string
          is_system?: boolean
          name: string
          stage_id?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          for_role?: string | null
          id?: string
          is_system?: boolean
          name?: string
          stage_id?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      filed_emails: {
        Row: {
          coach_id: string | null
          coach_name: string | null
          conference: string | null
          division: string | null
          filed_at: string
          from_email: string | null
          from_name: string | null
          gmail_message_id: string
          id: string
          program_id: string | null
          program_name: string | null
          received_at: string | null
          snippet: string | null
          subject: string | null
          thread_id: string | null
          user_id: string
        }
        Insert: {
          coach_id?: string | null
          coach_name?: string | null
          conference?: string | null
          division?: string | null
          filed_at?: string
          from_email?: string | null
          from_name?: string | null
          gmail_message_id: string
          id?: string
          program_id?: string | null
          program_name?: string | null
          received_at?: string | null
          snippet?: string | null
          subject?: string | null
          thread_id?: string | null
          user_id: string
        }
        Update: {
          coach_id?: string | null
          coach_name?: string | null
          conference?: string | null
          division?: string | null
          filed_at?: string
          from_email?: string | null
          from_name?: string | null
          gmail_message_id?: string
          id?: string
          program_id?: string | null
          program_name?: string | null
          received_at?: string | null
          snippet?: string | null
          subject?: string | null
          thread_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "filed_emails_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filed_emails_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filed_emails_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_tokens: {
        Row: {
          access_token: string
          account_tier: string | null
          connected_at: string | null
          created_at: string | null
          email: string
          id: string
          refresh_token: string
          token_expiry: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_token: string
          account_tier?: string | null
          connected_at?: string | null
          created_at?: string | null
          email: string
          id?: string
          refresh_token: string
          token_expiry: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string
          account_tier?: string | null
          connected_at?: string | null
          created_at?: string | null
          email?: string
          id?: string
          refresh_token?: string
          token_expiry?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      interactions: {
        Row: {
          athlete_id: string
          body: string | null
          coach_id: string | null
          created_at: string
          direction: Database["public"]["Enums"]["interaction_direction"]
          id: string
          occurred_at: string
          pipeline_entry_id: string
          subject: string | null
          type: Database["public"]["Enums"]["interaction_type"]
        }
        Insert: {
          athlete_id: string
          body?: string | null
          coach_id?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["interaction_direction"]
          id?: string
          occurred_at?: string
          pipeline_entry_id: string
          subject?: string | null
          type: Database["public"]["Enums"]["interaction_type"]
        }
        Update: {
          athlete_id?: string
          body?: string | null
          coach_id?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["interaction_direction"]
          id?: string
          occurred_at?: string
          pipeline_entry_id?: string
          subject?: string | null
          type?: Database["public"]["Enums"]["interaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "interactions_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_pipeline_entry_id_fkey"
            columns: ["pipeline_entry_id"]
            isOneToOne: false
            referencedRelation: "pipeline_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      managed_programs: {
        Row: {
          accent_color: string | null
          background_image_url: string | null
          city: string | null
          coach_invite_code: string | null
          created_at: string
          hudl_url: string | null
          id: string
          instagram_username: string | null
          landing_slug: string | null
          logo_url: string | null
          mascot: string | null
          max_coaches: number
          max_players: number
          player_invite_code: string | null
          primary_color: string | null
          school_name: string
          secondary_color: string | null
          state: string | null
          twitter_username: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          background_image_url?: string | null
          city?: string | null
          coach_invite_code?: string | null
          created_at?: string
          hudl_url?: string | null
          id?: string
          instagram_username?: string | null
          landing_slug?: string | null
          logo_url?: string | null
          mascot?: string | null
          max_coaches?: number
          max_players?: number
          player_invite_code?: string | null
          primary_color?: string | null
          school_name: string
          secondary_color?: string | null
          state?: string | null
          twitter_username?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          background_image_url?: string | null
          city?: string | null
          coach_invite_code?: string | null
          created_at?: string
          hudl_url?: string | null
          id?: string
          instagram_username?: string | null
          landing_slug?: string | null
          logo_url?: string | null
          mascot?: string | null
          max_coaches?: number
          max_players?: number
          player_invite_code?: string | null
          primary_color?: string | null
          school_name?: string
          secondary_color?: string | null
          state?: string | null
          twitter_username?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_entries: {
        Row: {
          athlete_id: string
          created_at: string
          id: string
          notes: string | null
          primary_coach_id: string | null
          program_id: string
          stage_id: string
          status: Database["public"]["Enums"]["pipeline_status"]
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          id?: string
          notes?: string | null
          primary_coach_id?: string | null
          program_id: string
          stage_id: string
          status?: Database["public"]["Enums"]["pipeline_status"]
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          primary_coach_id?: string | null
          program_id?: string
          stage_id?: string
          status?: Database["public"]["Enums"]["pipeline_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_entries_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_entries_primary_coach_id_fkey"
            columns: ["primary_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_entries_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_entries_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          description: string | null
          display_order: number
          id: string
          name: string
        }
        Insert: {
          description?: string | null
          display_order: number
          id?: string
          name: string
        }
        Update: {
          description?: string | null
          display_order?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          can_send_emails: boolean
          city: string | null
          coach_email: string | null
          coach_name: string | null
          coach_phone: string | null
          created_at: string
          email: string | null
          email_banner_dismissed: boolean
          first_name: string | null
          gpa: number | null
          grad_year: number | null
          height: string | null
          high_school: string | null
          hudl_url: string | null
          id: string
          instagram_handle: string | null
          is_grandfathered: boolean
          jersey_number: string | null
          last_name: string | null
          phone: string | null
          position: string | null
          primary_video_url: string | null
          profile_image_url: string | null
          readiness_score_open: boolean | null
          recovery_email: string | null
          registered_via: string | null
          role: Database["public"]["Enums"]["user_role"]
          share_slug: string | null
          sms_notifications_enabled: boolean
          state: string | null
          stripe_customer_id: string | null
          title: string | null
          twitter_handle: string | null
          updated_at: string
          username: string | null
          weight: number | null
          workspace_email: string | null
          zoho_account_key: string | null
        }
        Insert: {
          can_send_emails?: boolean
          city?: string | null
          coach_email?: string | null
          coach_name?: string | null
          coach_phone?: string | null
          created_at?: string
          email?: string | null
          email_banner_dismissed?: boolean
          first_name?: string | null
          gpa?: number | null
          grad_year?: number | null
          height?: string | null
          high_school?: string | null
          hudl_url?: string | null
          id: string
          instagram_handle?: string | null
          is_grandfathered?: boolean
          jersey_number?: string | null
          last_name?: string | null
          phone?: string | null
          position?: string | null
          primary_video_url?: string | null
          profile_image_url?: string | null
          readiness_score_open?: boolean | null
          recovery_email?: string | null
          registered_via?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          share_slug?: string | null
          sms_notifications_enabled?: boolean
          state?: string | null
          stripe_customer_id?: string | null
          title?: string | null
          twitter_handle?: string | null
          updated_at?: string
          username?: string | null
          weight?: number | null
          workspace_email?: string | null
          zoho_account_key?: string | null
        }
        Update: {
          can_send_emails?: boolean
          city?: string | null
          coach_email?: string | null
          coach_name?: string | null
          coach_phone?: string | null
          created_at?: string
          email?: string | null
          email_banner_dismissed?: boolean
          first_name?: string | null
          gpa?: number | null
          grad_year?: number | null
          height?: string | null
          high_school?: string | null
          hudl_url?: string | null
          id?: string
          instagram_handle?: string | null
          is_grandfathered?: boolean
          jersey_number?: string | null
          last_name?: string | null
          phone?: string | null
          position?: string | null
          primary_video_url?: string | null
          profile_image_url?: string | null
          readiness_score_open?: boolean | null
          recovery_email?: string | null
          registered_via?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          share_slug?: string | null
          sms_notifications_enabled?: boolean
          state?: string | null
          stripe_customer_id?: string | null
          title?: string | null
          twitter_handle?: string | null
          updated_at?: string
          username?: string | null
          weight?: number | null
          workspace_email?: string | null
          zoho_account_key?: string | null
        }
        Relationships: []
      }
      program_members: {
        Row: {
          created_at: string
          email: string
          id: string
          program_id: string
          registered_via: string | null
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          program_id: string
          registered_via?: string | null
          role: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          program_id?: string
          registered_via?: string | null
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_members_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "managed_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_twitter_tokens: {
        Row: {
          access_token: string
          connected_at: string | null
          connected_by: string | null
          id: string
          program_id: string
          refresh_token: string | null
          token_expiry: string | null
          twitter_handle: string
          twitter_user_id: string
        }
        Insert: {
          access_token: string
          connected_at?: string | null
          connected_by?: string | null
          id?: string
          program_id: string
          refresh_token?: string | null
          token_expiry?: string | null
          twitter_handle: string
          twitter_user_id: string
        }
        Update: {
          access_token?: string
          connected_at?: string | null
          connected_by?: string | null
          id?: string
          program_id?: string
          refresh_token?: string | null
          token_expiry?: string | null
          twitter_handle?: string
          twitter_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_twitter_tokens_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_twitter_tokens_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: true
            referencedRelation: "managed_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          city: string | null
          conference: string | null
          created_at: string
          division: Database["public"]["Enums"]["division"]
          espn_id: number | null
          id: string
          logo_url: string | null
          rml_school_name: string | null
          school_name: string
          state: string | null
          twitter_handle: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          city?: string | null
          conference?: string | null
          created_at?: string
          division: Database["public"]["Enums"]["division"]
          espn_id?: number | null
          id?: string
          logo_url?: string | null
          rml_school_name?: string | null
          school_name: string
          state?: string | null
          twitter_handle?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          city?: string | null
          conference?: string | null
          created_at?: string
          division?: Database["public"]["Enums"]["division"]
          espn_id?: number | null
          id?: string
          logo_url?: string | null
          rml_school_name?: string | null
          school_name?: string
          state?: string | null
          twitter_handle?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: string | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string | null
          status?: string
          stripe_customer_id: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string | null
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      twitter_tokens: {
        Row: {
          access_token: string
          connected_at: string
          id: string
          refresh_token: string | null
          token_expiry: string | null
          twitter_handle: string
          twitter_user_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          connected_at?: string
          id?: string
          refresh_token?: string | null
          token_expiry?: string | null
          twitter_handle: string
          twitter_user_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          connected_at?: string
          id?: string
          refresh_token?: string | null
          token_expiry?: string | null
          twitter_handle?: string
          twitter_user_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twitter_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unsubscribes: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          email: string
          id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          email: string
          id?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unsubscribes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaign_clean_stats"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "unsubscribes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      x_partner_profiles: {
        Row: {
          athlete_id: string
          created_at: string
          display_name: string | null
          id: string
          profile_image_url: string | null
          twitter_handle: string
          twitter_user_id: string | null
        }
        Insert: {
          athlete_id: string
          created_at?: string
          display_name?: string | null
          id?: string
          profile_image_url?: string | null
          twitter_handle: string
          twitter_user_id?: string | null
        }
        Update: {
          athlete_id?: string
          created_at?: string
          display_name?: string | null
          id?: string
          profile_image_url?: string | null
          twitter_handle?: string
          twitter_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "x_partner_profiles_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      campaign_clean_stats: {
        Row: {
          campaign_id: string | null
          error_count: number | null
          replied_count: number | null
          sent_count: number | null
          total_clicks: number | null
          total_recipients: number | null
          unique_clickers: number | null
          unique_opens: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      schedule_campaign_send: {
        Args: { p_campaign_id: string; p_send_at: string }
        Returns: number
      }
      unschedule_campaign_send: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
    }
    Enums: {
      action_priority: "low" | "medium" | "high" | "urgent"
      action_status: "pending" | "completed" | "dismissed"
      division: "FBS" | "FCS" | "DII" | "DIII" | "JUCO" | "NAIA"
      email_status:
        | "queued"
        | "sent"
        | "delivered"
        | "opened"
        | "bounced"
        | "failed"
      interaction_direction: "inbound" | "outbound"
      interaction_type:
        | "email_sent"
        | "email_received"
        | "dm_sent"
        | "dm_received"
        | "call"
        | "visit"
        | "film_sent"
        | "questionnaire"
        | "camp_invite"
        | "offer"
        | "other"
      pipeline_status: "active" | "dead" | "committed"
      user_role: "athlete" | "admin" | "coach"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      action_priority: ["low", "medium", "high", "urgent"],
      action_status: ["pending", "completed", "dismissed"],
      division: ["FBS", "FCS", "DII", "DIII", "JUCO", "NAIA"],
      email_status: [
        "queued",
        "sent",
        "delivered",
        "opened",
        "bounced",
        "failed",
      ],
      interaction_direction: ["inbound", "outbound"],
      interaction_type: [
        "email_sent",
        "email_received",
        "dm_sent",
        "dm_received",
        "call",
        "visit",
        "film_sent",
        "questionnaire",
        "camp_invite",
        "offer",
        "other",
      ],
      pipeline_status: ["active", "dead", "committed"],
      user_role: ["athlete", "admin", "coach"],
    },
  },
} as const

