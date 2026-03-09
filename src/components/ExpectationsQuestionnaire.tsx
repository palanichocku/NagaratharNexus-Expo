// src/components/ExpectationsQuestionnaire.tsx

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EXPECTATIONS_QUESTIONS } from '@/src/constants/expectationsQuestions';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseAnswers(raw: string): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    return { q1: raw };
  }
  return {};
}

function serializeAnswers(answers: Record<string, string>): string {
  return JSON.stringify(answers);
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  value: string;
  onChange: (v: string) => void;
  theme: any;
  styles?: any;
}

export function ExpectationsQuestionnaire({ value, onChange, theme }: Props) {
  const [current, setCurrent] = useState(0);
  const answers = useMemo(() => parseAnswers(value), [value]);

  const total = EXPECTATIONS_QUESTIONS.length;
  const answered = Object.values(answers).filter((a) => a.trim()).length;

  const handleChange = useCallback(
    (text: string) => {
      const id = EXPECTATIONS_QUESTIONS[current].id;
      const updated = { ...answers, [id]: text };
      onChange(serializeAnswers(updated));
    },
    [answers, current, onChange],
  );

  const goNext = () => setCurrent((c) => Math.min(c + 1, total - 1));
  const goPrev = () => setCurrent((c) => Math.max(c - 1, 0));

  const s = useMemo(() => makeQStyles(theme), [theme]);
  const q = EXPECTATIONS_QUESTIONS[current];
  const currentAnswer = answers[q.id] || '';
  const progressPct = ((current + 1) / total) * 100;

  return (
    <View style={s.wrapper}>
      <View style={s.header}>
        <Text style={s.headerLabel}>Partner Expectations</Text>
        <View style={s.badge}>
          <Text style={s.badgeText}>{answered}/{total} answered</Text>
        </View>
      </View>

      <View style={s.dotsRow}>
        {EXPECTATIONS_QUESTIONS.map((_, i) => {
          const isAnswered = !!(answers[EXPECTATIONS_QUESTIONS[i].id]?.trim());
          const isActive = i === current;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => setCurrent(i)}
              activeOpacity={0.8}
              style={[
                s.dot,
                isActive && s.dotActive,
                isAnswered && !isActive && s.dotAnswered,
              ]}
            />
          );
        })}
      </View>

      <View style={s.card}>
        <View style={s.cardTopRow}>
          <Text style={s.qNumber}>{q.shortLabel}</Text>
          <View style={s.progressPill}>
            <View style={[s.progressFill, { width: `${progressPct}%` as any }]} />
          </View>
        </View>

        <Text style={s.questionText}>{q.q}</Text>

        <TextInput
          style={s.answerInput}
          value={currentAnswer}
          onChangeText={handleChange}
          placeholder={q.placeholder}
          placeholderTextColor={theme.colors.mutedText}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          returnKeyType="default"
        />

        <View style={s.inputMeta}>
          <Text style={s.charCount}>{currentAnswer.length} chars</Text>
          {!currentAnswer.trim() && (
            <TouchableOpacity onPress={goNext} activeOpacity={0.8}>
              <Text style={s.skipText}>Skip →</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={s.navRow}>
        <TouchableOpacity
          onPress={goPrev}
          disabled={current === 0}
          style={[s.navBtn, current === 0 && s.navBtnDisabled]}
          activeOpacity={0.8}
        >
          <Ionicons
            name="chevron-back"
            size={16}
            color={current === 0 ? theme.colors.border : theme.colors.text}
          />
          <Text style={[s.navText, current === 0 && s.navTextDisabled]}>Prev</Text>
        </TouchableOpacity>

        <Text style={s.navCounter}>{current + 1} / {total}</Text>

        <TouchableOpacity
          onPress={goNext}
          disabled={current === total - 1}
          style={[s.navBtn, current === total - 1 && s.navBtnDisabled]}
          activeOpacity={0.8}
        >
          <Text style={[s.navText, current === total - 1 && s.navTextDisabled]}>Next</Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={current === total - 1 ? theme.colors.border : theme.colors.text}
          />
        </TouchableOpacity>
      </View>

      {answered > 0 && (
        <View style={s.summaryBox}>
          <Text style={s.summaryTitle}>Your answers so far</Text>
          {EXPECTATIONS_QUESTIONS.map((qs) => {
            const ans = answers[qs.id];
            if (!ans?.trim()) return null;
            return (
              <TouchableOpacity
                key={qs.id}
                onPress={() =>
                  setCurrent(EXPECTATIONS_QUESTIONS.findIndex((x) => x.id === qs.id))
                }
                activeOpacity={0.85}
                style={s.summaryRow}
              >
                <View style={s.summaryDot} />
                <View style={{ flex: 1 }}>
                  <Text style={s.summaryQ} numberOfLines={1}>
                    {qs.shortLabel} • {qs.q}
                  </Text>
                  <Text style={s.summaryA} numberOfLines={2}>{ans}</Text>
                </View>
                <Ionicons name="pencil-outline" size={13} color={theme.colors.mutedText} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

function makeQStyles(theme: any) {
  const r = theme.radius ?? {};

  return StyleSheet.create({
    wrapper: {
      marginTop: 4,
    },

    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    headerLabel: {
      fontSize: 11,
      fontWeight: '900',
      color: theme.colors.mutedText,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    badge: {
      backgroundColor: theme.colors.primary + '22',
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '900',
      color: theme.colors.primary,
    },

    dotsRow: {
      flexDirection: 'row',
      gap: 5,
      marginBottom: 14,
      flexWrap: 'wrap',
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.border,
    },
    dotActive: {
      backgroundColor: theme.colors.primary,
      width: 22,
      borderRadius: 4,
    },
    dotAnswered: {
      backgroundColor: theme.colors.primary + '66',
    },

    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: r.card ?? 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 16,
      marginBottom: 12,
    },
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    qNumber: {
      fontSize: 11,
      fontWeight: '900',
      color: theme.colors.primary,
      letterSpacing: 0.5,
    },
    progressPill: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.border,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.colors.primary,
    },
    questionText: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.text,
      lineHeight: 22,
      marginBottom: 14,
    },
    answerInput: {
      minHeight: 100,
      borderRadius: r.input ?? 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.inputBg,
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 12,
      fontSize: 14,
      color: theme.colors.text,
      fontWeight: '600',
      lineHeight: 20,
    },
    inputMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    charCount: {
      fontSize: 11,
      color: theme.colors.mutedText,
      fontWeight: '700',
    },
    skipText: {
      fontSize: 11,
      color: theme.colors.primary,
      fontWeight: '900',
    },

    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    navBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    navBtnDisabled: {
      opacity: 0.4,
    },
    navText: {
      fontSize: 13,
      fontWeight: '900',
      color: theme.colors.text,
    },
    navTextDisabled: {
      color: theme.colors.border,
    },
    navCounter: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.mutedText,
    },

    summaryBox: {
      backgroundColor: theme.colors.surface,
      borderRadius: r.card ?? 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
    },
    summaryTitle: {
      fontSize: 10,
      fontWeight: '900',
      color: theme.colors.mutedText,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderColor: theme.colors.border,
    },
    summaryDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.primary,
      marginTop: 5,
    },
    summaryQ: {
      fontSize: 11,
      fontWeight: '900',
      color: theme.colors.mutedText,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    summaryA: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.colors.text,
      lineHeight: 18,
    },
  });
}