export const colors = {
    primary: '#0366d6',
    primaryLight: '#58a6ff',
    primaryDark: '#024ea4',

    accent: '#22c55e',
    accentRed: '#ef4444',
    accentPurple: '#8b5cf6',
    accentAmber: '#f59e0b',

    background: '#f0f4f8',
    surface: '#ffffff',
    surfaceHover: '#f8fafc',

    categoryTab: '#e8edf2',
    categoryTabActive: '#0366d6',

    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',

    border: '#e2e8f0',
    borderLight: '#f1f5f9',

    overlay: 'rgba(15, 23, 42, 0.5)',
};

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
};

export const borderRadius = {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    full: 999,
};

export const shadows = {
    sm: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 2,
        elevation: 1,
    },
    md: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    lg: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 5,
    },
};

export const typography = {
    h1: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
    h2: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
    h3: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
    body: { fontSize: 15, color: colors.textPrimary },
    bodySmall: { fontSize: 13, color: colors.textSecondary },
    caption: { fontSize: 12, color: colors.textMuted },
    badge: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
};

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };
