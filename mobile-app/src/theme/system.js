// CampSiteModern design system
// Source of truth for palettes, semantic colors, and component tokens.

const THEMES = {
  campsiteModern: {
    palette: {
      // Foundations
      charcoal900: '#0f1214',
      charcoal850: '#14191d',
      charcoal800: '#181f24',
      charcoal700: '#202a31',
      charcoal600: '#2a3640',
      charcoal500: '#3a4854',

      // Text neutrals
      sandstone100: '#f8f5ef',
      sandstone200: '#e8dfd0',
      sandstone400: '#b7ad9f',
      sandstone500: '#8b8379',

      // Brand accents
      amber400: '#f6a623',
      amber500: '#d68117',
      rose400: '#ff5f87',
      blue400: '#5aa8ff',
      emerald400: '#43d17f',
      red400: '#ff6b6b',
    },
    radius: {
      sm: 8,
      md: 12,
      lg: 16,
      xl: 20,
      full: 999,
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 12,
      lg: 16,
      xl: 20,
      xxl: 24,
    },
    shadow: {
      card: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 5 },
        shadowRadius: 13,
        elevation: 5,
      },
      elevated: {
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 22,
        elevation: 10,
      },
    },
  },
};

const ACTIVE_THEME_NAME = process.env.EXPO_PUBLIC_APP_THEME || 'campsiteModern';

function alpha(hex, opacityHex) {
  return `${hex}${opacityHex}`;
}

function buildTheme(config) {
  const p = config.palette;

  const colors = {
    // Core surfaces
    bg: p.charcoal900,
    bgElevated: p.charcoal850,
    panel: p.charcoal800,
    card: p.charcoal700,
    surface: p.charcoal600,
    border: p.charcoal500,
    borderStrong: alpha(p.sandstone200, '44'),
    primaryBorder: alpha(p.amber400, '66'),
    dangerBorder: alpha(p.red400, '66'),
    successBorder: alpha(p.emerald400, '66'),

    // Text
    text: p.sandstone100,
    secondary: p.sandstone200,
    muted: p.sandstone400,
    placeholder: p.sandstone500,

    // Brand + state
    primary: p.amber400,
    primaryMuted: p.amber500,
    primaryText: '#1f1406',
    primarySoft: alpha(p.amber400, '22'),
    primarySoftStrong: alpha(p.amber400, '38'),
    blue: p.blue400,
    rose: p.rose400,
    amber: p.amber400,
    emerald: p.emerald400,
    emeraldSoft: alpha(p.emerald400, '22'),
    danger: p.red400,
    dangerSoft: alpha(p.red400, '1e'),
    focusRing: p.amber400,

    // Ambient/glow helpers
    glowAmber: alpha(p.amber400, '4d'),
    glowBlue: alpha(p.blue400, '4d'),
    glowRose: alpha(p.rose400, '4d'),
    overlaySoft: 'rgba(0,0,0,0.25)',
    overlayMedium: 'rgba(0,0,0,0.58)',
    overlayStrong: 'rgba(0,0,0,0.78)',
  };

  return {
    name: ACTIVE_THEME_NAME,
    colors,
    radius: config.radius,
    spacing: config.spacing,
    shadow: config.shadow,
    focusRing: {
      borderWidth: 2,
      borderColor: colors.focusRing,
    },
    components: {
      screen: {
        ambientTop: alpha(colors.amber, '1f'),
        ambientLeft: alpha(colors.blue, '14'),
        ambientRight: alpha(colors.rose, '14'),
      },
      button: {
        variants: {
          primary: {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
            textColor: colors.primaryText,
          },
          secondary: {
            backgroundColor: colors.panel,
            borderColor: colors.borderStrong,
            textColor: colors.text,
          },
          danger: {
            backgroundColor: colors.dangerSoft,
            borderColor: colors.danger,
            textColor: colors.danger,
          },
        },
      },
      discovery: {
        pass: {
          backgroundColor: colors.surface,
          borderColor: colors.borderStrong,
          iconColor: colors.danger,
          labelColor: colors.secondary,
          shadowColor: alpha(colors.danger, '66'),
        },
        like: {
          iconColor: colors.text,
          labelColor: colors.text,
        },
      },
    },
  };
}

const rawTheme = THEMES[ACTIVE_THEME_NAME] || THEMES.campsiteModern;

export const theme = buildTheme(rawTheme);
export const availableThemes = Object.keys(THEMES);
