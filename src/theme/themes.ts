// src/theme/themes.ts
export type ThemeName = 'warm' | 'cool';

export type AppTheme = {
  name: ThemeName;
  colors: {
    bg: string;
    surface: string;
    surface2: string;
    border: string;
    text: string;
    mutedText: string;

    primary: string;
    primaryText: string;

    danger: string;
    dangerText: string;

    success: string;
    successText: string;

    chipIdleBg: string;
    chipIdleText: string;
    chipActiveBg: string;
    chipActiveText: string;

    inputBg: string;
    shadow: string;
  };
  radius: {
    card: number;
    chip: number;
    input: number;
    button: number;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
};

export const themes: Record<ThemeName, AppTheme> = {
  warm: {
    name: 'warm',
    colors: {
      bg: '#FDF6EC',
      surface: '#FFF8F1',
      surface2: '#FFFFFF',
      border: '#E8D5C4',
      text: '#11181C',
      mutedText: '#6B7280',

      primary: '#7B1E3A',
      primaryText: '#FFFFFF',

      danger: '#B42318',
      dangerText: '#FFFFFF',

      success: '#3E6B48',
      successText: '#FFFFFF',

      chipIdleBg: '#FFFFFF',
      chipIdleText: '#11181C',
      chipActiveBg: '#7B1E3A',
      chipActiveText: '#FFFFFF',

      inputBg: '#FFFFFF',
      shadow: 'rgba(0,0,0,0.08)',
    },
    radius: { card: 20, chip: 999, input: 16, button: 16 },
    spacing: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 },
  },

  // Example alternative theme you can tweak anytime
  cool: {
    name: 'cool',
    colors: {
      bg: '#F6F8FB',
      surface: '#FFFFFF',
      surface2: '#FFFFFF',
      border: '#E5E7EB',
      text: '#0F172A',
      mutedText: '#64748B',

      primary: '#2563EB',
      primaryText: '#FFFFFF',

      danger: '#DC2626',
      dangerText: '#FFFFFF',

      success: '#16A34A',
      successText: '#FFFFFF',

      chipIdleBg: '#F1F5F9',
      chipIdleText: '#0F172A',
      chipActiveBg: '#2563EB',
      chipActiveText: '#FFFFFF',

      inputBg: '#FFFFFF',
      shadow: 'rgba(2,6,23,0.08)',
    },
    radius: { card: 18, chip: 999, input: 14, button: 14 },
    spacing: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 },
  },
};
