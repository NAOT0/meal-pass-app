export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: number
          name: string
          slug: string
          recommendation_weight: number
        }
        Insert: {
          id?: number
          name: string
          slug: string
          recommendation_weight?: number
        }
        Update: {
          id?: number
          name?: string
          slug?: string
          recommendation_weight?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          name: string
          price: number
          category_id: number | null
          image_url: string | null
          is_active: boolean
          is_verified: boolean
          is_recommended: boolean // Added
          is_temporary: boolean // Added
          expires_at: string | null // Added
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          price: number
          category_id?: number | null
          image_url?: string | null
          is_active?: boolean
          is_verified?: boolean
          is_recommended?: boolean
          is_temporary?: boolean
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          price?: number
          category_id?: number | null
          image_url?: string | null
          is_active?: boolean
          is_verified?: boolean
          is_recommended?: boolean
          is_temporary?: boolean
          expires_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
      product_barcodes: {
        Row: {
          jan_code: string
          product_id: string
        }
        Insert: {
          jan_code: string
          product_id: string
        }
        Update: {
          jan_code?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_barcodes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
      classification_votes: {
        Row: {
          id: number
          product_id: string
          voted_category_id: number | null
          session_id: string | null
          created_at: string
        }
        Insert: {
          id?: number
          product_id: string
          voted_category_id?: number | null
          session_id?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          product_id: string
          voted_category_id?: number | null
          session_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classification_votes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classification_votes_voted_category_id_fkey"
            columns: ["voted_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          }
        ]
      }
    }
  }
}
