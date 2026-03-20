// app/(tabs)/success-stories.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '@/src/lib/supabase';
import { useAppTheme } from '@/src/theme/ThemeProvider';

const PAGE_SIZE = 10;

type SuccessStoryListItem = {
  id: string;
  title: string;
  wedding_date: string | null;
  short_description: string | null;
  is_featured: boolean;
  photo_url: string | null;
};

type SuccessStoryDetail = {
  id: string;
  title: string;
  wedding_date: string | null;
  short_description: string | null;
  feedback: string | null;
  photo_url: string | null;
};

export default function SuccessStoriesScreen() {
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stories, setStories] = useState<SuccessStoryListItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedStory, setSelectedStory] = useState<SuccessStoryDetail | null>(null);

  const fetchStoriesPage = useCallback(async (pageIndex: number) => {
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('success_stories')
      .select('id,title,wedding_date,short_description,is_featured,photo_url')
      .eq('is_published', true)
      .order('is_featured', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('wedding_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    return (data ?? []) as SuccessStoryListItem[];
  }, []);

  const loadInitialStories = useCallback(async () => {
    setLoading(true);
    try {
      const firstPage = await fetchStoriesPage(0);
      setStories(firstPage);
      setPage(0);
      setHasMore(firstPage.length === PAGE_SIZE);
    } catch (e) {
      console.error('Failed to load success stories:', e);
      setStories([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [fetchStoriesPage]);

  const loadMoreStories = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const nextPageIndex = page + 1;
      const nextPage = await fetchStoriesPage(nextPageIndex);

      setStories((prev) => [...prev, ...nextPage]);
      setPage(nextPageIndex);
      setHasMore(nextPage.length === PAGE_SIZE);
    } catch (e) {
      console.error('Failed to load more success stories:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchStoriesPage, hasMore, loadingMore, page]);

  const openStory = useCallback(async (storyId: string) => {
    setSelectedStoryId(storyId);
    setSelectedStory(null);
    setDetailLoading(true);

    try {
      const { data, error } = await supabase
        .from('success_stories')
        .select('id,title,wedding_date,short_description,feedback,photo_url')
        .eq('id', storyId)
        .eq('is_published', true)
        .single();

      if (error) throw error;

      setSelectedStory(data as SuccessStoryDetail);
    } catch (e) {
      console.error('Failed to load success story detail:', e);
      setSelectedStory(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeStory = useCallback(() => {
    setSelectedStoryId(null);
    setSelectedStory(null);
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    loadInitialStories();
  }, [loadInitialStories]);

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Success Stories</Text>
          <Text style={styles.subtitle}>
            Celebrating couples and families who found the right match through the community.
          </Text>
        </View>

        <TouchableOpacity style={styles.refreshBtn} onPress={loadInitialStories}>
          <Ionicons name="refresh" size={18} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.centerText}>Loading success stories...</Text>
        </View>
      ) : stories.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="sparkles-outline" size={28} color={theme.colors.mutedText} />
          <Text style={styles.emptyTitle}>No stories published yet</Text>
          <Text style={styles.centerText}>Published success stories will appear here.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {stories.map((story) => (
            <TouchableOpacity
              key={story.id}
              style={styles.storyCard}
              onPress={() => openStory(story.id)}
              activeOpacity={0.9}
            >
              <View style={styles.storyRow}>
                <View style={styles.thumbWrap}>
                  {story.photo_url ? (
                    <Image
                      source={{ uri: story.photo_url }}
                      style={styles.thumb}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.thumbPlaceholder}>
                      <Ionicons name="image-outline" size={18} color={theme.colors.mutedText} />
                    </View>
                  )}
                </View>

                <View style={styles.storyContent}>
                  <View style={styles.storyTitleRow}>
                    <Text style={styles.storyTitle} numberOfLines={1}>
                      {story.title}
                    </Text>

                    {story.is_featured ? (
                      <View style={styles.featuredBadge}>
                        <Ionicons name="star" size={12} color={theme.colors.primary} />
                        <Text style={styles.featuredText}>Featured</Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={styles.storyDate}>
                    {story.wedding_date ? formatDate(story.wedding_date) : 'Wedding date not listed'}
                  </Text>

                  <Text style={styles.storyDescription} numberOfLines={2}>
                    {story.short_description || 'Tap to view this success story.'}
                  </Text>
                </View>

                <View style={styles.chevronWrap}>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={theme.colors.mutedText}
                  />
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {hasMore ? (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={loadMoreStories}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={theme.colors.surface2} />
              ) : (
                <Text style={styles.loadMoreText}>Load More</Text>
              )}
            </TouchableOpacity>
          ) : (
            <Text style={styles.endText}>You’ve reached the end.</Text>
          )}
        </ScrollView>
      )}

      <Modal visible={selectedStoryId !== null} animationType="slide" onRequestClose={closeStory}>
        <View style={styles.modalPage}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Success Story</Text>
            <TouchableOpacity onPress={closeStory} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={26} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {detailLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.centerText}>Loading story...</Text>
            </View>
          ) : !selectedStory ? (
            <View style={styles.centerState}>
              <Text style={styles.emptyTitle}>Unable to load story</Text>
              <Text style={styles.centerText}>Please try again.</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.detailTitle}>{selectedStory.title}</Text>
              <Text style={styles.detailDate}>
                {selectedStory.wedding_date
                  ? formatDate(selectedStory.wedding_date)
                  : 'Wedding date not listed'}
              </Text>

              {selectedStory.photo_url ? (
                <Image
                  source={{ uri: selectedStory.photo_url }}
                  style={styles.detailImage}
                  resizeMode="cover"
                />
              ) : null}

              {selectedStory.short_description ? (
                <View style={styles.detailCard}>
                  <Text style={styles.detailSectionTitle}>About</Text>
                  <Text style={styles.detailBody}>{selectedStory.short_description}</Text>
                </View>
              ) : null}

              {selectedStory.feedback ? (
                <View style={styles.detailCard}>
                  <Text style={styles.detailSectionTitle}>Feedback</Text>
                  <Text style={styles.detailBody}>{selectedStory.feedback}</Text>
                </View>
              ) : null}

              {!selectedStory.short_description && !selectedStory.feedback ? (
                <View style={styles.detailCard}>
                  <Text style={styles.detailBody}>No additional details were added for this story.</Text>
                </View>
              ) : null}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

function formatDate(value: string) {
  try {
    const d = new Date(value);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}

function makeStyles(theme: any) {
  const bg = theme?.colors?.bg ?? '#FDF6EC';
  const surface = theme?.colors?.surface ?? '#FFF8F1';
  const surface2 = theme?.colors?.surface2 ?? '#FFFFFF';
  const border = theme?.colors?.border ?? '#E8D5C4';
  const text = theme?.colors?.text ?? '#11181C';
  const muted = theme?.colors?.mutedText ?? '#6B7280';
  const primary = theme?.colors?.primary ?? '#7B1E3A';

  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: bg,
    },

    header: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: border,
      backgroundColor: surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: text,
    },
    subtitle: {
      marginTop: 6,
      fontSize: 14,
      fontWeight: '600',
      color: muted,
      lineHeight: 20,
      maxWidth: 820,
    },
    refreshBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: surface2,
    },

    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 28,
    },

    centerState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    centerText: {
      marginTop: 12,
      fontSize: 14,
      fontWeight: '600',
      color: muted,
      textAlign: 'center',
    },
    emptyTitle: {
      marginTop: 12,
      fontSize: 18,
      fontWeight: '800',
      color: text,
      textAlign: 'center',
    },

    storyCard: {
      backgroundColor: surface2,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: border,
      paddingHorizontal: 14,
      paddingVertical: 14,
      marginBottom: 12,
      ...Platform.select({
        web: { boxShadow: '0 10px 22px rgba(0,0,0,0.04)' } as any,
      }),
    },
    storyRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    thumbWrap: {
      marginRight: 12,
    },
    thumb: {
      width: 60,
      height: 60,
      borderRadius: 16,
      backgroundColor: '#EAEAEA',
    },
    thumbPlaceholder: {
      width: 60,
      height: 60,
      borderRadius: 16,
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    storyContent: {
      flex: 1,
      minWidth: 0,
    },
    storyTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    storyTitle: {
      flexShrink: 1,
      fontSize: 18,
      fontWeight: '800',
      color: text,
    },
    featuredBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: surface,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    featuredText: {
      fontSize: 11,
      fontWeight: '800',
      color: primary,
    },
    storyDate: {
      marginTop: 5,
      fontSize: 13,
      fontWeight: '600',
      color: muted,
    },
    storyDescription: {
      marginTop: 8,
      fontSize: 14,
      lineHeight: 20,
      color: text,
      fontWeight: '500',
    },
    chevronWrap: {
      marginLeft: 12,
      width: 36,
      height: 36,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: surface,
    },

    loadMoreBtn: {
      marginTop: 4,
      backgroundColor: primary,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadMoreText: {
      color: surface2,
      fontWeight: '800',
      fontSize: 14,
    },
    endText: {
      marginTop: 12,
      textAlign: 'center',
      color: muted,
      fontWeight: '600',
      fontSize: 13,
    },

    modalPage: {
      flex: 1,
      backgroundColor: bg,
    },
    modalHeader: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: border,
      backgroundColor: surface,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: text,
    },
    modalCloseBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalScroll: {
      flex: 1,
    },
    modalScrollContent: {
      padding: 20,
      paddingBottom: 36,
    },
    detailTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: text,
      lineHeight: 34,
    },
    detailDate: {
      marginTop: 8,
      marginBottom: 16,
      fontSize: 14,
      fontWeight: '600',
      color: muted,
    },
    detailImage: {
      width: '100%',
      height: 320,
      borderRadius: 20,
      backgroundColor: '#EAEAEA',
      marginBottom: 16,
    },
    detailCard: {
      backgroundColor: surface,
      borderWidth: 1,
      borderColor: border,
      borderRadius: 18,
      padding: 16,
      marginBottom: 14,
    },
    detailSectionTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: muted,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    detailBody: {
      fontSize: 15,
      lineHeight: 23,
      color: text,
      fontWeight: '500',
    },
  });
}