export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          created_at: string
          description: string
          evidence_urls: string[] | null
          id: string
          match_id: string | null
          raised_by: string
          resolution: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          tournament_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          evidence_urls?: string[] | null
          id?: string
          match_id?: string | null
          raised_by: string
          resolution?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          tournament_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          evidence_urls?: string[] | null
          id?: string
          match_id?: string | null
          raised_by?: string
          resolution?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          tournament_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_records: {
        Row: {
          aadhaar_last4: string | null
          created_at: string
          full_name: string | null
          pan_number: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          aadhaar_last4?: string | null
          created_at?: string
          full_name?: string | null
          pan_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          aadhaar_last4?: string | null
          created_at?: string
          full_name?: string | null
          pan_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_records_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_results: {
        Row: {
          created_at: string
          id: string
          kills: number
          match_id: string
          placement: number | null
          points: number
          screenshot_url: string | null
          submitted_by: string | null
          team_id: string | null
          updated_at: string
          user_id: string | null
          verified: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          kills?: number
          match_id: string
          placement?: number | null
          points?: number
          screenshot_url?: string | null
          submitted_by?: string | null
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
          verified?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          kills?: number
          match_id?: string
          placement?: number | null
          points?: number
          screenshot_url?: string | null
          submitted_by?: string | null
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "match_results_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          credentials_release_at: string | null
          id: string
          match_number: number
          notes: string | null
          room_id: string | null
          room_password: string | null
          round: number
          scheduled_at: string | null
          status: Database["public"]["Enums"]["match_status"]
          tournament_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credentials_release_at?: string | null
          id?: string
          match_number?: number
          notes?: string | null
          room_id?: string | null
          room_password?: string | null
          round?: number
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credentials_release_at?: string | null
          id?: string
          match_number?: number
          notes?: string | null
          room_id?: string | null
          room_password?: string | null
          round?: number
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string | null
          notes: string | null
          provider: string
          provider_order_id: string | null
          provider_payment_id: string | null
          provider_signature: string | null
          registration_id: string | null
          retry_count: number
          status: Database["public"]["Enums"]["payment_status"]
          tournament_id: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          provider?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          provider_signature?: string | null
          registration_id?: string | null
          retry_count?: number
          status?: Database["public"]["Enums"]["payment_status"]
          tournament_id?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          provider?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          provider_signature?: string | null
          registration_id?: string | null
          retry_count?: number
          status?: Database["public"]["Enums"]["payment_status"]
          tournament_id?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          country: string | null
          created_at: string
          discord_handle: string | null
          display_name: string | null
          email: string | null
          game_uid: string | null
          id: string
          ign: string | null
          instagram_handle: string | null
          kills: number
          losses: number
          matches_played: number
          mvp_count: number
          phone: string | null
          region: string | null
          total_earnings: number
          updated_at: string
          username: string
          wins: number
          youtube_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          discord_handle?: string | null
          display_name?: string | null
          email?: string | null
          game_uid?: string | null
          id: string
          ign?: string | null
          instagram_handle?: string | null
          kills?: number
          losses?: number
          matches_played?: number
          mvp_count?: number
          phone?: string | null
          region?: string | null
          total_earnings?: number
          updated_at?: string
          username: string
          wins?: number
          youtube_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          discord_handle?: string | null
          display_name?: string | null
          email?: string | null
          game_uid?: string | null
          id?: string
          ign?: string | null
          instagram_handle?: string | null
          kills?: number
          losses?: number
          matches_played?: number
          mvp_count?: number
          phone?: string | null
          region?: string | null
          total_earnings?: number
          updated_at?: string
          username?: string
          wins?: number
          youtube_url?: string | null
        }
        Relationships: []
      }
      team_invitations: {
        Row: {
          created_at: string
          id: string
          invited_by: string
          invited_user_id: string
          status: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by: string
          invited_user_id: string
          status?: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string
          invited_user_id?: string
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          banner_url: string | null
          captain_id: string
          created_at: string
          description: string | null
          id: string
          is_recruiting: boolean
          logo_url: string | null
          losses: number
          name: string
          region: string | null
          tag: string
          total_earnings: number
          total_kills: number
          updated_at: string
          wins: number
        }
        Insert: {
          banner_url?: string | null
          captain_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_recruiting?: boolean
          logo_url?: string | null
          losses?: number
          name: string
          region?: string | null
          tag: string
          total_earnings?: number
          total_kills?: number
          updated_at?: string
          wins?: number
        }
        Update: {
          banner_url?: string | null
          captain_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_recruiting?: boolean
          logo_url?: string | null
          losses?: number
          name?: string
          region?: string | null
          tag?: string
          total_earnings?: number
          total_kills?: number
          updated_at?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "teams_captain_id_fkey"
            columns: ["captain_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_escrow_entries: {
        Row: {
          amount: number
          created_at: string
          entry_type: string
          id: string
          notes: string | null
          reference_id: string | null
          team_id: string | null
          tournament_id: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          entry_type: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          team_id?: string | null
          tournament_id: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          entry_type?: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          team_id?: string | null
          tournament_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tournament_registrations: {
        Row: {
          checked_in_at: string | null
          created_at: string
          id: string
          payment_ref: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          registered_by: string
          status: Database["public"]["Enums"]["registration_status"]
          team_id: string | null
          tournament_id: string
          updated_at: string
          user_id: string | null
          waitlist_position: number | null
        }
        Insert: {
          checked_in_at?: string | null
          created_at?: string
          id?: string
          payment_ref?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          registered_by: string
          status?: Database["public"]["Enums"]["registration_status"]
          team_id?: string | null
          tournament_id: string
          updated_at?: string
          user_id?: string | null
          waitlist_position?: number | null
        }
        Update: {
          checked_in_at?: string | null
          created_at?: string
          id?: string
          payment_ref?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          registered_by?: string
          status?: Database["public"]["Enums"]["registration_status"]
          team_id?: string | null
          tournament_id?: string
          updated_at?: string
          user_id?: string | null
          waitlist_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_registrations_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          banner_url: string | null
          checkin_closes_at: string | null
          checkin_opens_at: string | null
          created_at: string
          created_by: string
          description: string | null
          ends_at: string | null
          entry_fee: number
          game: string
          id: string
          max_players_per_team: number
          max_teams: number
          mode: Database["public"]["Enums"]["tournament_mode"]
          name: string
          platform_fee_percent: number
          prize_distributed_at: string | null
          prize_pool: number
          region: string | null
          registration_closes_at: string | null
          registration_opens_at: string | null
          rules: string | null
          settlement_status: string
          slug: string
          starts_at: string | null
          status: Database["public"]["Enums"]["tournament_status"]
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          checkin_closes_at?: string | null
          checkin_opens_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          ends_at?: string | null
          entry_fee?: number
          game?: string
          id?: string
          max_players_per_team?: number
          max_teams?: number
          mode?: Database["public"]["Enums"]["tournament_mode"]
          name: string
          platform_fee_percent?: number
          prize_distributed_at?: string | null
          prize_pool?: number
          region?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          rules?: string | null
          settlement_status?: string
          slug: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          checkin_closes_at?: string | null
          checkin_opens_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string | null
          entry_fee?: number
          game?: string
          id?: string
          max_players_per_team?: number
          max_teams?: number
          mode?: Database["public"]["Enums"]["tournament_mode"]
          name?: string
          platform_fee_percent?: number
          prize_distributed_at?: string | null
          prize_pool?: number
          region?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          rules?: string | null
          settlement_status?: string
          slug?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_ledger: {
        Row: {
          amount: number
          category: string
          created_at: string
          entry_type: string
          id: string
          notes: string | null
          reference_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          entry_type: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          entry_type?: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          amount: number
          created_at: string
          id: string
          payout_details: Json | null
          payout_method: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payout_details?: Json | null
          payout_method?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payout_details?: Json | null
          payout_method?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_tournament_status: {
        Args: {
          _new_status: Database["public"]["Enums"]["tournament_status"]
          _tournament_id: string
        }
        Returns: Database["public"]["Enums"]["tournament_status"]
      }
      get_match_credentials: {
        Args: { _match_id: string }
        Returns: {
          room_id: string
          room_password: string
        }[]
      }
      get_tournament_escrow: {
        Args: { _tournament_id: string }
        Returns: number
      }
      get_wallet_balance: { Args: { _user_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      log_audit: {
        Args: {
          _action: string
          _entity_id: string
          _entity_type: string
          _metadata: Json
        }
        Returns: undefined
      }
      mark_no_shows: { Args: { _tournament_id: string }; Returns: number }
      promote_from_waitlist: {
        Args: { _tournament_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "player"
        | "team_captain"
        | "moderator"
        | "tournament_admin"
        | "finance_admin"
        | "super_admin"
      dispute_status: "open" | "under_review" | "resolved" | "rejected"
      kyc_status: "not_submitted" | "pending" | "approved" | "rejected"
      match_status:
        | "scheduled"
        | "live"
        | "completed"
        | "under_review"
        | "cancelled"
      notification_type:
        | "info"
        | "success"
        | "warning"
        | "error"
        | "tournament"
        | "match"
        | "payment"
        | "team"
      payment_status: "created" | "pending" | "success" | "failed" | "refunded"
      registration_status:
        | "pending"
        | "confirmed"
        | "waitlisted"
        | "checked_in"
        | "no_show"
        | "disqualified"
        | "cancelled"
      tournament_mode: "solo" | "duo" | "squad" | "clan"
      tournament_status:
        | "draft"
        | "scheduled"
        | "registration_open"
        | "registration_closed"
        | "checkin_open"
        | "checkin_closed"
        | "live"
        | "under_review"
        | "completed"
        | "cancelled"
      withdrawal_status:
        | "pending"
        | "under_review"
        | "approved"
        | "processing"
        | "sent"
        | "rejected"
        | "paid"
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
  public: {
    Enums: {
      app_role: [
        "player",
        "team_captain",
        "moderator",
        "tournament_admin",
        "finance_admin",
        "super_admin",
      ],
      dispute_status: ["open", "under_review", "resolved", "rejected"],
      kyc_status: ["not_submitted", "pending", "approved", "rejected"],
      match_status: [
        "scheduled",
        "live",
        "completed",
        "under_review",
        "cancelled",
      ],
      notification_type: [
        "info",
        "success",
        "warning",
        "error",
        "tournament",
        "match",
        "payment",
        "team",
      ],
      payment_status: ["created", "pending", "success", "failed", "refunded"],
      registration_status: [
        "pending",
        "confirmed",
        "waitlisted",
        "checked_in",
        "no_show",
        "disqualified",
        "cancelled",
      ],
      tournament_mode: ["solo", "duo", "squad", "clan"],
      tournament_status: [
        "draft",
        "scheduled",
        "registration_open",
        "registration_closed",
        "checkin_open",
        "checkin_closed",
        "live",
        "under_review",
        "completed",
        "cancelled",
      ],
      withdrawal_status: [
        "pending",
        "under_review",
        "approved",
        "processing",
        "sent",
        "rejected",
        "paid",
      ],
    },
  },
} as const
