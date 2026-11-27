
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "album_photos": {
                  Row: {
                    "caption": string | null,"created_at": string,"event_id": string,"height": number | null,"id": string,"storage_path": string,"uploader_id": string,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "caption"?: string | null,"created_at"?: string,"event_id": string,"height"?: number | null,"id"?: string,"storage_path": string,"uploader_id"?: string,"width"?: number | null
                  }
                  Update: {
                    "caption"?: string | null,"created_at"?: string,"event_id"?: string,"height"?: number | null,"id"?: string,"storage_path"?: string,"uploader_id"?: string,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "album_photos_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "album_photos_uploader_id_fkey"
      columns: ["uploader_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"announcements": {
                  Row: {
                    "author_id": string | null,"body": string | null,"created_at": string,"event_id": string,"id": string,"pinned": boolean,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body"?: string | null,"created_at"?: string,"event_id": string,"id"?: string,"pinned"?: boolean,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string | null,"created_at"?: string,"event_id"?: string,"id"?: string,"pinned"?: boolean,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"assignments": {
                  Row: {
                    "created_at": string,"draw_version": number,"event_id": string,"giver_id": string,"giver_muted_by_admin": boolean,"id": string,"receiver_blocked_messages": boolean,"receiver_id": string,"viewed_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"draw_version": number,"event_id": string,"giver_id": string,"giver_muted_by_admin"?: boolean,"id"?: string,"receiver_blocked_messages"?: boolean,"receiver_id": string,"viewed_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"draw_version"?: number,"event_id"?: string,"giver_id"?: string,"giver_muted_by_admin"?: boolean,"id"?: string,"receiver_blocked_messages"?: boolean,"receiver_id"?: string,"viewed_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "assignments_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assignments_giver_id_fkey"
      columns: ["giver_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assignments_receiver_id_fkey"
      columns: ["receiver_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["id"]
    }
                  ]
                },"bingo_cards": {
                  Row: {
                    "bingo_at": string | null,"cells": (number)[],"created_at": string,"game_id": string,"marked": (number)[],"participant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bingo_at"?: string | null,"cells": (number)[],"created_at"?: string,"game_id": string,"marked"?: (number)[],"participant_id": string
                  }
                  Update: {
                    "bingo_at"?: string | null,"cells"?: (number)[],"created_at"?: string,"game_id"?: string,"marked"?: (number)[],"participant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bingo_cards_game_id_fkey"
      columns: ["game_id"]
isOneToOne: false
      referencedRelation: "bingo_games"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bingo_cards_participant_id_fkey"
      columns: ["participant_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["id"]
    }
                  ]
                },"bingo_games": {
                  Row: {
                    "called": (number)[],"created_at": string,"created_by": string | null,"event_id": string,"finished_at": string | null,"id": string,"started_at": string | null,"status": string,"winners": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "called"?: (number)[],"created_at"?: string,"created_by"?: string | null,"event_id": string,"finished_at"?: string | null,"id"?: string,"started_at"?: string | null,"status"?: string,"winners"?: (string)[]
                  }
                  Update: {
                    "called"?: (number)[],"created_at"?: string,"created_by"?: string | null,"event_id"?: string,"finished_at"?: string | null,"id"?: string,"started_at"?: string | null,"status"?: string,"winners"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "bingo_games_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bingo_games_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"cards": {
                  Row: {
                    "anonymous": boolean,"body": string,"created_at": string,"event_id": string,"id": string,"read_at": string | null,"recipient_id": string,"sender_id": string,"template": string,"title": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anonymous"?: boolean,"body": string,"created_at"?: string,"event_id": string,"id"?: string,"read_at"?: string | null,"recipient_id": string,"sender_id": string,"template": string,"title"?: string | null
                  }
                  Update: {
                    "anonymous"?: boolean,"body"?: string,"created_at"?: string,"event_id"?: string,"id"?: string,"read_at"?: string | null,"recipient_id"?: string,"sender_id"?: string,"template"?: string,"title"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cards_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cards_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cards_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["id"]
    }
                  ]
                },"challenge_spins": {
                  Row: {
                    "challenge_index": number,"challenge_text": string,"created_at": string,"event_id": string,"id": string,"participant_id": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "challenge_index": number,"challenge_text": string,"created_at"?: string,"event_id": string,"id"?: string,"participant_id": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "challenge_index"?: number,"challenge_text"?: string,"created_at"?: string,"event_id"?: string,"id"?: string,"participant_id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "challenge_spins_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "challenge_spins_participant_id_fkey"
      columns: ["participant_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["id"]
    }
                  ]
                },"chat_messages": {
                  Row: {
                    "body": string,"created_at": string,"deleted_at": string | null,"deleted_by": string | null,"event_id": string,"id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"deleted_at"?: string | null,"deleted_by"?: string | null,"event_id": string,"id"?: string,"user_id"?: string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"deleted_at"?: string | null,"deleted_by"?: string | null,"event_id"?: string,"id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chat_messages_deleted_by_fkey"
      columns: ["deleted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_messages_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chat_messages_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"draw_log": {
                  Row: {
                    "created_at": string,"event_id": string,"id": number,"kind": string,"participant_count": number,"performed_by": string | null,"reason": string | null,"scheduled": boolean,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"id"?: never,"kind": string,"participant_count": number,"performed_by"?: string | null,"reason"?: string | null,"scheduled"?: boolean,"version": number
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"id"?: never,"kind"?: string,"participant_count"?: number,"performed_by"?: string | null,"reason"?: string | null,"scheduled"?: boolean,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "draw_log_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "draw_log_performed_by_fkey"
      columns: ["performed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_invites": {
                  Row: {
                    "accepted_at": string | null,"created_at": string,"email": string,"event_id": string,"id": string,"invited_by": string | null,"revoked_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"created_at"?: string,"email": string,"event_id": string,"id"?: string,"invited_by"?: string | null,"revoked_at"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"created_at"?: string,"email"?: string,"event_id"?: string,"id"?: string,"invited_by"?: string | null,"revoked_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_invites_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_invites_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"event_log": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"data": NonNullable<Json>,"event_id": string,"id": number,"kind": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"event_id": string,"id"?: never,"kind": string
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"data"?: NonNullable<Json>,"event_id"?: string,"id"?: never,"kind"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_log_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "archived_at": string | null,"cover_path": string | null,"created_at": string,"description": string | null,"draw_at": string | null,"draw_mode": Database["public"]['Enums']["draw_mode"],"draw_version": number,"drawn_at": string | null,"finished_at": string | null,"gift_max": number | null,"gift_min": number | null,"id": string,"invite_code": string,"join_deadline": string | null,"location": string | null,"max_participants": number | null,"name": string,"owner_id": string | null,"requires_approval": boolean,"reveal_at": string | null,"rules": string | null,"status": Database["public"]['Enums']["event_status"],"theme": Database["public"]['Enums']["event_theme"],"updated_at": string,"visibility": Database["public"]['Enums']["event_visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"cover_path"?: string | null,"created_at"?: string,"description"?: string | null,"draw_at"?: string | null,"draw_mode"?: Database["public"]['Enums']["draw_mode"],"draw_version"?: number,"drawn_at"?: string | null,"finished_at"?: string | null,"gift_max"?: number | null,"gift_min"?: number | null,"id"?: string,"invite_code": string,"join_deadline"?: string | null,"location"?: string | null,"max_participants"?: number | null,"name": string,"owner_id"?: string | null,"requires_approval"?: boolean,"reveal_at"?: string | null,"rules"?: string | null,"status"?: Database["public"]['Enums']["event_status"],"theme"?: Database["public"]['Enums']["event_theme"],"updated_at"?: string,"visibility"?: Database["public"]['Enums']["event_visibility"]
                  }
                  Update: {
                    "archived_at"?: string | null,"cover_path"?: string | null,"created_at"?: string,"description"?: string | null,"draw_at"?: string | null,"draw_mode"?: Database["public"]['Enums']["draw_mode"],"draw_version"?: number,"drawn_at"?: string | null,"finished_at"?: string | null,"gift_max"?: number | null,"gift_min"?: number | null,"id"?: string,"invite_code"?: string,"join_deadline"?: string | null,"location"?: string | null,"max_participants"?: number | null,"name"?: string,"owner_id"?: string | null,"requires_approval"?: boolean,"reveal_at"?: string | null,"rules"?: string | null,"status"?: Database["public"]['Enums']["event_status"],"theme"?: Database["public"]['Enums']["event_theme"],"updated_at"?: string,"visibility"?: Database["public"]['Enums']["event_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"gift_preferences": {
                  Row: {
                    "dislikes": (string)[],"favorite_colors": (string)[],"hobbies": (string)[],"interests": (string)[],"notes": string | null,"pants_size": string | null,"shirt_size": string | null,"shoe_size": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "dislikes"?: (string)[],"favorite_colors"?: (string)[],"hobbies"?: (string)[],"interests"?: (string)[],"notes"?: string | null,"pants_size"?: string | null,"shirt_size"?: string | null,"shoe_size"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "dislikes"?: (string)[],"favorite_colors"?: (string)[],"hobbies"?: (string)[],"interests"?: (string)[],"notes"?: string | null,"pants_size"?: string | null,"shirt_size"?: string | null,"shoe_size"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "gift_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"guesses": {
                  Row: {
                    "event_id": string,"guessed_id": string,"guesser_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"guessed_id": string,"guesser_id": string,"updated_at"?: string
                  }
                  Update: {
                    "event_id"?: string,"guessed_id"?: string,"guesser_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "guesses_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guesses_guessed_id_fkey"
      columns: ["guessed_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guesses_guesser_id_fkey"
      columns: ["guesser_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["id"]
    }
                  ]
                },"live_clues": {
                  Row: {
                    "body": string,"created_at": string,"event_id": string,"id": string,"participant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"event_id": string,"id"?: string,"participant_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"event_id"?: string,"id"?: string,"participant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_clues_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_clues_participant_id_fkey"
      columns: ["participant_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["id"]
    }
                  ]
                },"live_reveals": {
                  Row: {
                    "event_id": string,"giver_id": string,"id": string,"method": string,"receiver_id": string,"revealed_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"giver_id": string,"id"?: string,"method": string,"receiver_id": string,"revealed_at"?: string
                  }
                  Update: {
                    "event_id"?: string,"giver_id"?: string,"id"?: string,"method"?: string,"receiver_id"?: string,"revealed_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_reveals_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_reveals_giver_id_fkey"
      columns: ["giver_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_reveals_receiver_id_fkey"
      columns: ["receiver_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["id"]
    }
                  ]
                },"live_sessions": {
                  Row: {
                    "current_id": string | null,"event_id": string,"finished_at": string | null,"mode": string,"presented": (string)[],"queue": (string)[],"speech_seconds": number,"started_at": string,"started_by": string | null,"status": string,"timer_ends_at": string | null,"timer_paused_left": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "current_id"?: string | null,"event_id": string,"finished_at"?: string | null,"mode"?: string,"presented"?: (string)[],"queue"?: (string)[],"speech_seconds"?: number,"started_at"?: string,"started_by"?: string | null,"status"?: string,"timer_ends_at"?: string | null,"timer_paused_left"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "current_id"?: string | null,"event_id"?: string,"finished_at"?: string | null,"mode"?: string,"presented"?: (string)[],"queue"?: (string)[],"speech_seconds"?: number,"started_at"?: string,"started_by"?: string | null,"status"?: string,"timer_ends_at"?: string | null,"timer_paused_left"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_sessions_current_id_fkey"
      columns: ["current_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_sessions_event_id_fkey"
      columns: ["event_id"]
isOneToOne: true
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_sessions_started_by_fkey"
      columns: ["started_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string | null,"created_at": string,"email_status": string,"event_id": string | null,"id": string,"kind": string,"link": string | null,"push_status": string,"read_at": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"email_status"?: string,"event_id"?: string | null,"id"?: string,"kind": string,"link"?: string | null,"push_status"?: string,"read_at"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"email_status"?: string,"event_id"?: string | null,"id"?: string,"kind"?: string,"link"?: string | null,"push_status"?: string,"read_at"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"participants": {
                  Row: {
                    "allow_public_reveal": boolean,"approved_at": string | null,"created_at": string,"event_id": string,"gift_bought": boolean,"gift_bought_at": string | null,"id": string,"join_message": string | null,"muted_until": string | null,"result_viewed_at": string | null,"role": Database["public"]['Enums']["participant_role"],"rsvp": Database["public"]['Enums']["rsvp_status"] | null,"status": Database["public"]['Enums']["participant_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allow_public_reveal"?: boolean,"approved_at"?: string | null,"created_at"?: string,"event_id": string,"gift_bought"?: boolean,"gift_bought_at"?: string | null,"id"?: string,"join_message"?: string | null,"muted_until"?: string | null,"result_viewed_at"?: string | null,"role"?: Database["public"]['Enums']["participant_role"],"rsvp"?: Database["public"]['Enums']["rsvp_status"] | null,"status"?: Database["public"]['Enums']["participant_status"],"user_id": string
                  }
                  Update: {
                    "allow_public_reveal"?: boolean,"approved_at"?: string | null,"created_at"?: string,"event_id"?: string,"gift_bought"?: boolean,"gift_bought_at"?: string | null,"id"?: string,"join_message"?: string | null,"muted_until"?: string | null,"result_viewed_at"?: string | null,"role"?: Database["public"]['Enums']["participant_role"],"rsvp"?: Database["public"]['Enums']["rsvp_status"] | null,"status"?: Database["public"]['Enums']["participant_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "participants_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "participants_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"poll_options": {
                  Row: {
                    "id": string,"label": string,"poll_id": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"label": string,"poll_id": string,"position"?: number
                  }
                  Update: {
                    "id"?: string,"label"?: string,"poll_id"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "poll_options_poll_id_fkey"
      columns: ["poll_id"]
isOneToOne: false
      referencedRelation: "polls"
      referencedColumns: ["id"]
    }
                  ]
                },"poll_votes": {
                  Row: {
                    "created_at": string,"option_id": string,"poll_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"option_id": string,"poll_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"option_id"?: string,"poll_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "poll_votes_option_id_fkey"
      columns: ["option_id"]
isOneToOne: false
      referencedRelation: "poll_options"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "poll_votes_poll_id_fkey"
      columns: ["poll_id"]
isOneToOne: false
      referencedRelation: "polls"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "poll_votes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"polls": {
                  Row: {
                    "allow_multiple": boolean,"category": string,"closed_at": string | null,"closes_at": string | null,"created_at": string,"created_by": string | null,"event_id": string,"id": string,"question": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allow_multiple"?: boolean,"category"?: string,"closed_at"?: string | null,"closes_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"event_id": string,"id"?: string,"question": string
                  }
                  Update: {
                    "allow_multiple"?: boolean,"category"?: string,"closed_at"?: string | null,"closes_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"event_id"?: string,"id"?: string,"question"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "polls_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "polls_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"bio": string | null,"created_at": string,"display_name": string,"id": string,"is_guest": boolean,"nickname": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"bio"?: string | null,"created_at"?: string,"display_name"?: string,"id": string,"is_guest"?: boolean,"nickname"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"bio"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"is_guest"?: boolean,"nickname"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"p256dh": string,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"p256dh": string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"p256dh"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_answers": {
                  Row: {
                    "choice": number,"created_at": string,"is_correct": boolean,"participant_id": string,"question_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "choice": number,"created_at"?: string,"is_correct": boolean,"participant_id": string,"question_id": string
                  }
                  Update: {
                    "choice"?: number,"created_at"?: string,"is_correct"?: boolean,"participant_id"?: string,"question_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_answers_participant_id_fkey"
      columns: ["participant_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_answers_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "quiz_questions"
      referencedColumns: ["id"]
    }
                  ]
                },"quiz_questions": {
                  Row: {
                    "correct_index": number,"created_at": string,"event_id": string,"id": string,"options": (string)[],"question": string,"subject_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "correct_index": number,"created_at"?: string,"event_id": string,"id"?: string,"options": (string)[],"question": string,"subject_id": string
                  }
                  Update: {
                    "correct_index"?: number,"created_at"?: string,"event_id"?: string,"id"?: string,"options"?: (string)[],"question"?: string,"subject_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quiz_questions_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quiz_questions_subject_id_fkey"
      columns: ["subject_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["id"]
    }
                  ]
                },"reminder_log": {
                  Row: {
                    "event_id": string,"kind": string,"sent_at": string,"target": string
                  }
                  ComputedFields: never
                  Insert: {
                    "event_id": string,"kind": string,"sent_at"?: string,"target"?: string
                  }
                  Update: {
                    "event_id"?: string,"kind"?: string,"sent_at"?: string,"target"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminder_log_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"event_id": string,"id": string,"kind": string,"reason": string | null,"reporter_id": string | null,"resolution": string | null,"resolved_at": string | null,"resolved_by": string | null,"snapshot": string | null,"target_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"id"?: string,"kind": string,"reason"?: string | null,"reporter_id"?: string | null,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"snapshot"?: string | null,"target_id": string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"id"?: string,"kind"?: string,"reason"?: string | null,"reporter_id"?: string | null,"resolution"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"snapshot"?: string | null,"target_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"restrictions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"event_id": string,"giver_id": string,"id": string,"mutual": boolean,"note": string | null,"receiver_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"event_id": string,"giver_id": string,"id"?: string,"mutual"?: boolean,"note"?: string | null,"receiver_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"event_id"?: string,"giver_id"?: string,"id"?: string,"mutual"?: boolean,"note"?: string | null,"receiver_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "restrictions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "restrictions_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "restrictions_giver_id_fkey"
      columns: ["giver_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "restrictions_receiver_id_fkey"
      columns: ["receiver_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["id"]
    }
                  ]
                },"secret_messages": {
                  Row: {
                    "assignment_id": string,"body": string,"created_at": string,"event_id": string,"from_role": string,"hidden_at": string | null,"id": string,"kind": string,"read_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assignment_id": string,"body": string,"created_at"?: string,"event_id": string,"from_role": string,"hidden_at"?: string | null,"id"?: string,"kind"?: string,"read_at"?: string | null
                  }
                  Update: {
                    "assignment_id"?: string,"body"?: string,"created_at"?: string,"event_id"?: string,"from_role"?: string,"hidden_at"?: string | null,"id"?: string,"kind"?: string,"read_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "secret_messages_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "assignments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "secret_messages_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"time_capsules": {
                  Row: {
                    "body": string,"created_at": string,"event_id": string,"id": string,"open_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"event_id": string,"id"?: string,"open_at": string,"user_id"?: string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"event_id"?: string,"id"?: string,"open_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "time_capsules_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "time_capsules_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"user_settings": {
                  Row: {
                    "color_mode": string,"notify_email": boolean,"notify_push": boolean,"reduce_motion": boolean,"sound_effects": boolean,"updated_at": string,"user_id": string,"vibration": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "color_mode"?: string,"notify_email"?: boolean,"notify_push"?: boolean,"reduce_motion"?: boolean,"sound_effects"?: boolean,"updated_at"?: string,"user_id": string,"vibration"?: boolean
                  }
                  Update: {
                    "color_mode"?: string,"notify_email"?: boolean,"notify_push"?: boolean,"reduce_motion"?: boolean,"sound_effects"?: boolean,"updated_at"?: string,"user_id"?: string,"vibration"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"wall_posts": {
                  Row: {
                    "body": string,"color": string,"created_at": string,"event_id": string,"id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"color"?: string,"created_at"?: string,"event_id": string,"id"?: string,"user_id"?: string
                  }
                  Update: {
                    "body"?: string,"color"?: string,"created_at"?: string,"event_id"?: string,"id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wall_posts_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wall_posts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"wishlist_items": {
                  Row: {
                    "created_at": string,"id": string,"image_path": string | null,"notes": string | null,"position": number,"price_estimate": number | null,"title": string,"updated_at": string,"url": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"image_path"?: string | null,"notes"?: string | null,"position"?: number,"price_estimate"?: number | null,"title": string,"updated_at"?: string,"url"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"image_path"?: string | null,"notes"?: string | null,"position"?: number,"price_estimate"?: number | null,"title"?: string,"updated_at"?: string,"url"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "wishlist_items_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "_admin_of_participant":
{ Args: { "p_participant": string }; Returns: {
              "allow_public_reveal": boolean,
"approved_at": string | null,
"created_at": string,
"event_id": string,
"gift_bought": boolean,
"gift_bought_at": string | null,
"id": string,
"join_message": string | null,
"muted_until": string | null,
"result_viewed_at": string | null,
"role": Database["public"]['Enums']["participant_role"],
"rsvp": Database["public"]['Enums']["rsvp_status"] | null,
"status": Database["public"]['Enums']["participant_status"],
"user_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "participants"
        isOneToOne: true
        isSetofReturn: false
      } },
"_live_do_reveal":
{ Args: { "p_event": string,"p_giver": string,"p_method": string }; Returns: undefined
                           },
"_live_random_remaining":
{ Args: { "p_event": string,"p_excluir": (string)[] }; Returns: string
                           },
"_my_giver_assignment":
{ Args: { "p_event": string }; Returns: {
              "created_at": string,
"draw_version": number,
"event_id": string,
"giver_id": string,
"giver_muted_by_admin": boolean,
"id": string,
"receiver_blocked_messages": boolean,
"receiver_id": string,
"viewed_at": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "assignments"
        isOneToOne: true
        isSetofReturn: false
      } },
"_my_receiver_assignment":
{ Args: { "p_event": string }; Returns: {
              "created_at": string,
"draw_version": number,
"event_id": string,
"giver_id": string,
"giver_muted_by_admin": boolean,
"id": string,
"receiver_blocked_messages": boolean,
"receiver_id": string,
"viewed_at": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "assignments"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_event_stats":
{ Args: { "p_event": string }; Returns: Json
                           },
"album_open":
{ Args: { "p_event": string }; Returns: boolean
                           },
"approve_participant":
{ Args: { "p_approve": boolean,"p_participant": string }; Returns: undefined
                           },
"archive_event":
{ Args: { "p_archive": boolean,"p_event": string }; Returns: undefined
                           },
"bingo_call":
{ Args: { "p_game": string }; Returns: number
                           },
"bingo_claim":
{ Args: { "p_game": string }; Returns: boolean
                           },
"bingo_finish":
{ Args: { "p_game": string }; Returns: undefined
                           },
"bingo_join":
{ Args: { "p_game": string }; Returns: undefined
                           },
"bingo_mark":
{ Args: { "p_game": string,"p_position": number }; Returns: (number)[]
                           },
"bingo_new":
{ Args: { "p_event": string }; Returns: string
                           },
"block_secret_santa":
{ Args: { "p_block": boolean,"p_event": string }; Returns: undefined
                           },
"can_chat":
{ Args: { "p_event": string }; Returns: boolean
                           },
"capsule_summary":
{ Args: { "p_event": string }; Returns: Json
                           },
"challenge_catalog":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"claim_notifications":
{ Args: { "p_limit"?: number }; Returns: {
              "body": string,"email": string,"event_id": string,"id": string,"kind": string,"link": string,"send_email": boolean,"send_push": boolean,"title": string,"user_id": string
            }[]
                           },
"close_poll":
{ Args: { "p_poll": string }; Returns: undefined
                           },
"commit_draw":
{ Args: { "p_actor"?: string,"p_event": string,"p_expected_version": number,"p_pairs": Json,"p_reason"?: string,"p_redraw"?: boolean,"p_scheduled"?: boolean }; Returns: number
                           },
"create_event":
{ Args: { "p_cover_path"?: string,"p_description"?: string,"p_draw_at"?: string,"p_draw_mode"?: Database["public"]['Enums']["draw_mode"],"p_gift_max"?: number,"p_gift_min"?: number,"p_join_deadline"?: string,"p_location"?: string,"p_max_participants"?: number,"p_name": string,"p_requires_approval"?: boolean,"p_reveal_at"?: string,"p_rules"?: string,"p_theme"?: Database["public"]['Enums']["event_theme"],"p_visibility"?: Database["public"]['Enums']["event_visibility"] }; Returns: string
                           },
"create_poll":
{ Args: { "p_category"?: string,"p_closes_at"?: string,"p_event": string,"p_multiple"?: boolean,"p_options": (string)[],"p_question": string }; Returns: string
                           },
"cron_auto_finish":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"cron_due_draws":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"cron_reminders":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"delete_chat_message":
{ Args: { "p_message": string }; Returns: undefined
                           },
"delete_event":
{ Args: { "p_event": string }; Returns: undefined
                           },
"draw_input":
{ Args: { "p_event": string }; Returns: Json
                           },
"event_is_open":
{ Args: { "p_event": string }; Returns: boolean
                           },
"event_preview":
{ Args: { "p_code": string }; Returns: Json
                           },
"fail":
{ Args: { "p_code": string }; Returns: undefined
                           },
"finish_event":
{ Args: { "p_event": string }; Returns: undefined
                           },
"finish_notification_delivery":
{ Args: { "p_channel": string,"p_id": string,"p_status": string }; Returns: undefined
                           },
"generate_invite_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"invite_emails":
{ Args: { "p_emails": (string)[],"p_event": string }; Returns: number
                           },
"is_anonymous_user":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_event_admin":
{ Args: { "p_event": string }; Returns: boolean
                           },
"is_event_member":
{ Args: { "p_event": string }; Returns: boolean
                           },
"is_event_participant_any":
{ Args: { "p_event": string }; Returns: boolean
                           },
"join_event":
{ Args: { "p_code": string,"p_message"?: string }; Returns: Json
                           },
"join_public_event":
{ Args: { "p_event": string,"p_message"?: string }; Returns: Json
                           },
"leave_event":
{ Args: { "p_event": string }; Returns: undefined
                           },
"live_clue":
{ Args: { "p_body": string,"p_event": string }; Returns: undefined
                           },
"live_finish":
{ Args: { "p_event": string }; Returns: undefined
                           },
"live_next":
{ Args: { "p_event": string }; Returns: string
                           },
"live_reveal":
{ Args: { "p_event": string }; Returns: undefined
                           },
"live_reveal_for":
{ Args: { "p_event": string,"p_participant": string }; Returns: undefined
                           },
"live_set_seconds":
{ Args: { "p_event": string,"p_seconds": number }; Returns: undefined
                           },
"live_start":
{ Args: { "p_event": string,"p_mode"?: string,"p_seconds"?: number }; Returns: undefined
                           },
"live_timer":
{ Args: { "p_action": string,"p_event": string }; Returns: undefined
                           },
"log_event":
{ Args: { "p_data"?: Json,"p_event": string,"p_kind": string }; Returns: undefined
                           },
"mark_result_viewed":
{ Args: { "p_event": string }; Returns: undefined
                           },
"mark_secret_read":
{ Args: { "p_event": string,"p_side": string }; Returns: undefined
                           },
"mute_participant":
{ Args: { "p_minutes": number,"p_participant": string }; Returns: undefined
                           },
"my_assignment":
{ Args: { "p_event": string }; Returns: Json
                           },
"my_cards":
{ Args: { "p_event": string }; Returns: Json
                           },
"my_guess":
{ Args: { "p_event": string }; Returns: Json
                           },
"my_participant_id":
{ Args: { "p_event": string }; Returns: string
                           },
"notify":
{ Args: { "p_body"?: string,"p_event": string,"p_kind": string,"p_link"?: string,"p_title": string,"p_user": string }; Returns: undefined
                           },
"notify_members":
{ Args: { "p_body"?: string,"p_event": string,"p_except"?: string,"p_kind": string,"p_link"?: string,"p_only_admins"?: boolean,"p_title": string }; Returns: number
                           },
"participation_stats":
{ Args: { "p_event": string }; Returns: Json
                           },
"public_events":
{ Args: { "p_limit"?: number,"p_offset"?: number }; Returns: Json
                           },
"quiz_answer":
{ Args: { "p_choice": number,"p_question": string }; Returns: Json
                           },
"quiz_create":
{ Args: { "p_correct": number,"p_event": string,"p_options": (string)[],"p_question": string }; Returns: string
                           },
"quiz_delete":
{ Args: { "p_question": string }; Returns: undefined
                           },
"quiz_list":
{ Args: { "p_event": string }; Returns: Json
                           },
"regenerate_invite_code":
{ Args: { "p_event": string }; Returns: string
                           },
"remove_participant":
{ Args: { "p_participant": string }; Returns: undefined
                           },
"report_content":
{ Args: { "p_kind": string,"p_reason"?: string,"p_target": string }; Returns: undefined
                           },
"report_secret_message":
{ Args: { "p_message": string,"p_reason"?: string }; Returns: undefined
                           },
"resolve_report":
{ Args: { "p_action": string,"p_report": string }; Returns: undefined
                           },
"save_guess":
{ Args: { "p_event": string,"p_guessed": string }; Returns: undefined
                           },
"secret_threads":
{ Args: { "p_event": string }; Returns: Json
                           },
"secure_random_int":
{ Args: { "n": number }; Returns: number
                           },
"send_card":
{ Args: { "p_anonymous"?: boolean,"p_body": string,"p_event": string,"p_recipient": string,"p_template": string,"p_title": string }; Returns: string
                           },
"send_reminder":
{ Args: { "p_event": string,"p_kind": string }; Returns: number
                           },
"send_secret_message":
{ Args: { "p_body": string,"p_event": string,"p_kind": string,"p_to": string }; Returns: string
                           },
"set_participant_role":
{ Args: { "p_participant": string,"p_role": Database["public"]['Enums']["participant_role"] }; Returns: undefined
                           },
"shares_event_with":
{ Args: { "p_user": string }; Returns: boolean
                           },
"spin_challenge":
{ Args: { "p_event": string }; Returns: Json
                           },
"try_uuid":
{ Args: { "p": string }; Returns: string
                           },
"update_challenge":
{ Args: { "p_spin": string,"p_status": string }; Returns: undefined
                           },
"vote_poll":
{ Args: { "p_options": (string)[],"p_poll": string }; Returns: undefined
                           }
          }
          Enums: {
            "draw_mode": "manual"|"scheduled","event_status": "open"|"drawn"|"finished","event_theme": "natal"|"aniversario"|"classico"|"corporativo","event_visibility": "private"|"public","participant_role": "admin"|"member","participant_status": "pending"|"approved"|"rejected","rsvp_status": "yes"|"no"|"maybe"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "draw_mode": ["manual", "scheduled"],"event_status": ["open", "drawn", "finished"],"event_theme": ["natal", "aniversario", "classico", "corporativo"],"event_visibility": ["private", "public"],"participant_role": ["admin", "member"],"participant_status": ["pending", "approved", "rejected"],"rsvp_status": ["yes", "no", "maybe"]
          }
        }
} as const
