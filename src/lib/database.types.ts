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
      antwort: {
        Row: {
          ausgewaehlte_optionen: string[]
          id: string
          pruefung_frage_id: string
          teilnehmer_id: string
          unsicher_markiert: boolean
          zuletzt_geaendert: string
        }
        Insert: {
          ausgewaehlte_optionen?: string[]
          id?: string
          pruefung_frage_id: string
          teilnehmer_id: string
          unsicher_markiert?: boolean
          zuletzt_geaendert?: string
        }
        Update: {
          ausgewaehlte_optionen?: string[]
          id?: string
          pruefung_frage_id?: string
          teilnehmer_id?: string
          unsicher_markiert?: boolean
          zuletzt_geaendert?: string
        }
        Relationships: [
          {
            foreignKeyName: "antwort_pruefung_frage_id_fkey"
            columns: ["pruefung_frage_id"]
            isOneToOne: false
            referencedRelation: "pruefung_frage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "antwort_teilnehmer_id_fkey"
            columns: ["teilnehmer_id"]
            isOneToOne: false
            referencedRelation: "teilnehmer"
            referencedColumns: ["id"]
          },
        ]
      }
      antwortoption: {
        Row: {
          frage_id: string
          id: string
          ist_richtig: boolean
          sortierung: number
          text: string
        }
        Insert: {
          frage_id: string
          id?: string
          ist_richtig?: boolean
          sortierung?: number
          text: string
        }
        Update: {
          frage_id?: string
          id?: string
          ist_richtig?: boolean
          sortierung?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "antwortoption_frage_id_fkey"
            columns: ["frage_id"]
            isOneToOne: false
            referencedRelation: "frage"
            referencedColumns: ["id"]
          },
        ]
      }
      eingeladene_trainer: {
        Row: {
          eingeladen_am: string
          email: string
        }
        Insert: {
          eingeladen_am?: string
          email: string
        }
        Update: {
          eingeladen_am?: string
          email?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          bezug_id: string | null
          created_at: string
          ebene: string
          id: string
          teilnehmer_id: string
          text: string
        }
        Insert: {
          bezug_id?: string | null
          created_at?: string
          ebene: string
          id?: string
          teilnehmer_id: string
          text: string
        }
        Update: {
          bezug_id?: string | null
          created_at?: string
          ebene?: string
          id?: string
          teilnehmer_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_teilnehmer_id_fkey"
            columns: ["teilnehmer_id"]
            isOneToOne: false
            referencedRelation: "teilnehmer"
            referencedColumns: ["id"]
          },
        ]
      }
      frage: {
        Row: {
          erstellt_am: string
          erstellt_von: string | null
          id: string
          kurs_id: string
          text: string
          themengebiet_id: string | null
          typ: string
        }
        Insert: {
          erstellt_am?: string
          erstellt_von?: string | null
          id?: string
          kurs_id: string
          text: string
          themengebiet_id?: string | null
          typ: string
        }
        Update: {
          erstellt_am?: string
          erstellt_von?: string | null
          id?: string
          kurs_id?: string
          text?: string
          themengebiet_id?: string | null
          typ?: string
        }
        Relationships: [
          {
            foreignKeyName: "frage_kurs_id_fkey"
            columns: ["kurs_id"]
            isOneToOne: false
            referencedRelation: "kurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frage_themengebiet_id_fkey"
            columns: ["themengebiet_id"]
            isOneToOne: false
            referencedRelation: "themengebiet"
            referencedColumns: ["id"]
          },
        ]
      }
      frage_ausgeblendet: {
        Row: {
          created_at: string
          frage_id: string
          trainer_id: string
        }
        Insert: {
          created_at?: string
          frage_id: string
          trainer_id: string
        }
        Update: {
          created_at?: string
          frage_id?: string
          trainer_id?: string
        }
        Relationships: []
      }
      kurs: {
        Row: {
          beschreibung: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          beschreibung?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          beschreibung?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kurs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "trainer"
            referencedColumns: ["id"]
          },
        ]
      }
      kurs_freigabe: {
        Row: {
          besitzer_email: string | null
          besitzer_id: string
          created_at: string
          empfaenger_email: string
          empfaenger_id: string | null
          id: string
          kurs_id: string
          kurs_name: string
          modus: string
          status: string
        }
        Insert: {
          besitzer_email?: string | null
          besitzer_id: string
          created_at?: string
          empfaenger_email: string
          empfaenger_id?: string | null
          id?: string
          kurs_id: string
          kurs_name: string
          modus: string
          status?: string
        }
        Update: {
          besitzer_email?: string | null
          besitzer_id?: string
          created_at?: string
          empfaenger_email?: string
          empfaenger_id?: string | null
          id?: string
          kurs_id?: string
          kurs_name?: string
          modus?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "kurs_freigabe_besitzer_id_fkey"
            columns: ["besitzer_id"]
            isOneToOne: false
            referencedRelation: "trainer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kurs_freigabe_empfaenger_id_fkey"
            columns: ["empfaenger_id"]
            isOneToOne: false
            referencedRelation: "trainer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kurs_freigabe_kurs_id_fkey"
            columns: ["kurs_id"]
            isOneToOne: false
            referencedRelation: "kurs"
            referencedColumns: ["id"]
          },
        ]
      }
      korrektur_status: {
        Row: {
          id: string
          korrigiert_am: string
          teilnehmer_id: string
          themengebiet_id: string
          trainer_id: string
          trainer_name: string | null
        }
        Insert: {
          id?: string
          korrigiert_am?: string
          teilnehmer_id: string
          themengebiet_id: string
          trainer_id: string
          trainer_name?: string | null
        }
        Update: {
          id?: string
          korrigiert_am?: string
          teilnehmer_id?: string
          themengebiet_id?: string
          trainer_id?: string
          trainer_name?: string | null
        }
        Relationships: []
      }
      pruefung: {
        Row: {
          created_at: string
          datum: string | null
          end_zeit: string | null
          id: string
          late_join_modus: string
          owner_id: string
          quelle_freigabe_id: string | null
          start_zeit: string | null
          status: string
          uebungsmodus: boolean
          vorlage_id: string
          zugangscode: string
        }
        Insert: {
          created_at?: string
          datum?: string | null
          end_zeit?: string | null
          id?: string
          late_join_modus?: string
          owner_id: string
          quelle_freigabe_id?: string | null
          start_zeit?: string | null
          status?: string
          uebungsmodus?: boolean
          vorlage_id: string
          zugangscode?: string
        }
        Update: {
          created_at?: string
          datum?: string | null
          end_zeit?: string | null
          id?: string
          late_join_modus?: string
          owner_id?: string
          quelle_freigabe_id?: string | null
          start_zeit?: string | null
          status?: string
          uebungsmodus?: boolean
          vorlage_id?: string
          zugangscode?: string
        }
        Relationships: [
          {
            foreignKeyName: "pruefung_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "trainer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pruefung_quelle_freigabe_id_fkey"
            columns: ["quelle_freigabe_id"]
            isOneToOne: false
            referencedRelation: "pruefung_freigabe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pruefung_vorlage_id_fkey"
            columns: ["vorlage_id"]
            isOneToOne: false
            referencedRelation: "pruefungsvorlage"
            referencedColumns: ["id"]
          },
        ]
      }
      pruefung_frage: {
        Row: {
          frage_id: string
          id: string
          pruefung_id: string
          sortierung: number
          themengebiet_id: string | null
        }
        Insert: {
          frage_id: string
          id?: string
          pruefung_id: string
          sortierung?: number
          themengebiet_id?: string | null
        }
        Update: {
          frage_id?: string
          id?: string
          pruefung_id?: string
          sortierung?: number
          themengebiet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pruefung_frage_frage_id_fkey"
            columns: ["frage_id"]
            isOneToOne: false
            referencedRelation: "frage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pruefung_frage_pruefung_id_fkey"
            columns: ["pruefung_id"]
            isOneToOne: false
            referencedRelation: "pruefung"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pruefung_frage_themengebiet_id_fkey"
            columns: ["themengebiet_id"]
            isOneToOne: false
            referencedRelation: "themengebiet"
            referencedColumns: ["id"]
          },
        ]
      }
      pruefung_freigabe: {
        Row: {
          bearbeitbare_themengebiete: string[]
          besitzer_email: string | null
          besitzer_id: string
          created_at: string
          empfaenger_email: string
          empfaenger_id: string | null
          empfaenger_leitet: boolean
          id: string
          modus: string
          pruefung_id: string
          pruefung_name: string
          status: string
        }
        Insert: {
          bearbeitbare_themengebiete?: string[]
          besitzer_email?: string | null
          besitzer_id: string
          created_at?: string
          empfaenger_email: string
          empfaenger_id?: string | null
          empfaenger_leitet?: boolean
          id?: string
          modus: string
          pruefung_id: string
          pruefung_name: string
          status?: string
        }
        Update: {
          bearbeitbare_themengebiete?: string[]
          besitzer_email?: string | null
          besitzer_id?: string
          created_at?: string
          empfaenger_email?: string
          empfaenger_id?: string | null
          empfaenger_leitet?: boolean
          id?: string
          modus?: string
          pruefung_id?: string
          pruefung_name?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pruefung_freigabe_besitzer_id_fkey"
            columns: ["besitzer_id"]
            isOneToOne: false
            referencedRelation: "trainer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pruefung_freigabe_empfaenger_id_fkey"
            columns: ["empfaenger_id"]
            isOneToOne: false
            referencedRelation: "trainer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pruefung_freigabe_pruefung_id_fkey"
            columns: ["pruefung_id"]
            isOneToOne: false
            referencedRelation: "pruefung"
            referencedColumns: ["id"]
          },
        ]
      }
      pruefungsvorlage: {
        Row: {
          bestehensschwelle_pro_themengebiet_prozent: number | null
          bestehensschwelle_prozent: number
          created_at: string
          dauer_minuten: number
          id: string
          kurs_id: string
          name: string
        }
        Insert: {
          bestehensschwelle_pro_themengebiet_prozent?: number | null
          bestehensschwelle_prozent?: number
          created_at?: string
          dauer_minuten: number
          id?: string
          kurs_id: string
          name: string
        }
        Update: {
          bestehensschwelle_pro_themengebiet_prozent?: number | null
          bestehensschwelle_prozent?: number
          created_at?: string
          dauer_minuten?: number
          id?: string
          kurs_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "pruefungsvorlage_kurs_id_fkey"
            columns: ["kurs_id"]
            isOneToOne: false
            referencedRelation: "kurs"
            referencedColumns: ["id"]
          },
        ]
      }
      teilnehmer: {
        Row: {
          abgegeben_am: string | null
          anonymisiert_am: string | null
          auth_user_id: string | null
          created_at: string
          gestartet_am: string | null
          id: string
          name: string
          prozent: number | null
          pruefung_id: string
          punkte_gesamt: number | null
          punkte_max: number | null
        }
        Insert: {
          abgegeben_am?: string | null
          anonymisiert_am?: string | null
          auth_user_id?: string | null
          created_at?: string
          gestartet_am?: string | null
          id?: string
          name: string
          prozent?: number | null
          pruefung_id: string
          punkte_gesamt?: number | null
          punkte_max?: number | null
        }
        Update: {
          abgegeben_am?: string | null
          anonymisiert_am?: string | null
          auth_user_id?: string | null
          created_at?: string
          gestartet_am?: string | null
          id?: string
          name?: string
          prozent?: number | null
          pruefung_id?: string
          punkte_gesamt?: number | null
          punkte_max?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teilnehmer_pruefung_id_fkey"
            columns: ["pruefung_id"]
            isOneToOne: false
            referencedRelation: "pruefung"
            referencedColumns: ["id"]
          },
        ]
      }
      themengebiet: {
        Row: {
          created_at: string
          id: string
          kurs_id: string
          name: string
          sortierung: number
        }
        Insert: {
          created_at?: string
          id?: string
          kurs_id: string
          name: string
          sortierung?: number
        }
        Update: {
          created_at?: string
          id?: string
          kurs_id?: string
          name?: string
          sortierung?: number
        }
        Relationships: [
          {
            foreignKeyName: "themengebiet_kurs_id_fkey"
            columns: ["kurs_id"]
            isOneToOne: false
            referencedRelation: "kurs"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          nachname: string | null
          vorname: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          nachname?: string | null
          vorname?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          nachname?: string | null
          vorname?: string | null
        }
        Relationships: []
      }
      vorlage_themengebiet: {
        Row: {
          anzahl_fragen: number
          id: string
          punkte_gesamt: number
          themengebiet_id: string
          vorlage_id: string
        }
        Insert: {
          anzahl_fragen: number
          id?: string
          punkte_gesamt: number
          themengebiet_id: string
          vorlage_id: string
        }
        Update: {
          anzahl_fragen?: number
          id?: string
          punkte_gesamt?: number
          themengebiet_id?: string
          vorlage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vorlage_themengebiet_themengebiet_id_fkey"
            columns: ["themengebiet_id"]
            isOneToOne: false
            referencedRelation: "themengebiet"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vorlage_themengebiet_vorlage_id_fkey"
            columns: ["vorlage_id"]
            isOneToOne: false
            referencedRelation: "pruefungsvorlage"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      anonymisiere_alte_teilnehmer: { Args: never; Returns: number }
      antwort_speichern: {
        Args: {
          p_optionen: string[]
          p_pruefung_frage_id: string
          p_teilnehmer_id: string
          p_unsicher: boolean
        }
        Returns: undefined
      }
      darf_antwortoption_geteilt: {
        Args: { p_frage_id: string }
        Returns: boolean
      }
      darf_frage_anlegen_geteilt: {
        Args: { p_kurs_id: string; p_themengebiet_id: string }
        Returns: boolean
      }
      darf_frage_ausblenden: {
        Args: { p_frage_id: string }
        Returns: boolean
      }
      darf_geteilte_frage_lesen: {
        Args: { p_frage_id: string }
        Returns: boolean
      }
      darf_geteilte_vorlage_lesen: {
        Args: { p_vorlage_id: string }
        Returns: boolean
      }
      darf_geteiltes_themengebiet_lesen: {
        Args: { p_tg_id: string }
        Returns: boolean
      }
      darf_pruefung_frage_bearbeiten_korrektur: {
        Args: { p_pruefung_id: string; p_themengebiet_id: string }
        Returns: boolean
      }
      darf_pruefung_leiten: {
        Args: { p_pruefung_id: string }
        Returns: boolean
      }
      darf_kurs_bearbeiten: { Args: { p_kurs_id: string }; Returns: boolean }
      darf_kurs_lesen: { Args: { p_kurs_id: string }; Returns: boolean }
      darf_kurs_lesen_via_pruefung: {
        Args: { p_kurs_id: string }
        Returns: boolean
      }
      freigabe_ablehnen: { Args: { p_freigabe_id: string }; Returns: undefined }
      geteilte_pruefung_kurs_kopieren: {
        Args: { p_freigabe_id: string }
        Returns: string
      }
      freigabe_annehmen: { Args: { p_freigabe_id: string }; Returns: undefined }
      kurs_klonen: { Args: { p_kurs_id: string }; Returns: string }
      kurs_teilen: {
        Args: { p_email: string; p_kurs_id: string; p_modus: string }
        Returns: undefined
      }
      pruefung_abgeben: { Args: { p_teilnehmer_id: string }; Returns: Json }
      pruefung_anonymisieren: {
        Args: { p_pruefung_id: string }
        Returns: number
      }
      pruefung_beitreten: {
        Args: { p_code: string; p_name: string }
        Returns: Json
      }
      pruefung_fragen: { Args: { p_teilnehmer_id: string }; Returns: Json }
      pruefung_freigabe_ablehnen: {
        Args: { p_freigabe_id: string }
        Returns: undefined
      }
      pruefung_freigabe_annehmen: {
        Args: { p_freigabe_id: string }
        Returns: undefined
      }
      pruefung_klonen: { Args: { p_pruefung_id: string }; Returns: string }
      pruefung_status: { Args: { p_code: string }; Returns: Json }
      pruefung_teilen: {
        Args: {
          p_email: string
          p_modus: string
          p_pruefung_id: string
          p_themengebiete?: string[]
          p_empfaenger_leitet?: boolean
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
