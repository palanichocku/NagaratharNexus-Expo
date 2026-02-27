// src/services/announcement.service.ts
import { supabase } from '../lib/supabase';

export type Announcement = {
  id: string;
  title: string;
  body: string;
  author_id: string;
  author_role: string;
  created_at: string;
  updated_at: string;
  is_published: boolean;
};

export const announcementService = {
  async getAnnouncements(): Promise<Announcement[]> {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching announcements:', error);
        return [];
      }

      return (data ?? []) as Announcement[];
    } catch (e) {
      console.error('Error fetching announcements:', e);
      return [];
    }
  },
};