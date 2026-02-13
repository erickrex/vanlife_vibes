// DesertSunrise design system
// Warm, optimistic visual language with soft surfaces and energetic CTAs.

function alpha(hex, opacityHex) {
  return `${hex}${opacityHex}`;
}

const THEMES = {
  desertSunrise: {
    palette: {
      // Foundation layers
      sand100: '#fff5ec',
      sand150: '#fdf0e4',
      sand200: '#f7e3d2',
      sand300: '#efd0ba',
      clay350: '#e4bea2',
      clay450: '#cc9a7d',

      // Text neutrals
      dusk900: '#3e2b31',
      dusk700: '#5f4850',
      dusk500: '#7c646d',
      dusk400: '#927983',

      // Brand accents
      peach400: '#f59b87',
      amber400: '#f3b45e',
      rust500: '#d46f54',
      rose400: '#e784a8',
      lilac400: '#8f83cf',
      mint400: '#5cb69f',
      red400: '#d95f57',
    },
    radius: {
      sm: 8,
      md: 12,
      lg: 16,
      xl: 22,
      full: 999,
    },
    spacing: {
      xs: 4,
      sm: 8,
      md: 14,
      lg: 18,
      xl: 24,
      xxl: 28,
      xxxl: 36,
    },
    shadow: {
      card: {
        shadowColor: '#8f5e4a',
        shadowOpacity: 0.14,
        shadowOffset: { width: 0, height: 5 },
        shadowRadius: 12,
        elevation: 4,
      },
      elevated: {
        shadowColor: '#9a634f',
        shadowOpacity: 0.18,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 20,
        elevation: 7,
      },
    },
  },
};

const ACTIVE_THEME_NAME = process.env.EXPO_PUBLIC_APP_THEME || 'desertSunrise';

function buildTheme(config) {
  const p = config.palette;

  const colors = {
    // Core surfaces
    bg: p.sand100,
    bgElevated: p.sand150,
    panel: p.sand200,
    card: p.sand150,
    surface: p.sand300,
    border: p.clay350,
    borderStrong: alpha(p.clay450, '66'),
    primaryBorder: alpha(p.rust500, '7a'),
    dangerBorder: alpha(p.red400, '85'),
    successBorder: alpha(p.mint400, '85'),

    // Text
    text: p.dusk900,
    secondary: p.dusk700,
    muted: p.dusk500,
    placeholder: p.dusk400,

    // Brand + state
    primary: p.peach400,
    primaryMuted: p.amber400,
    primaryText: '#3a1d17',
    primarySoft: alpha(p.peach400, '24'),
    primarySoftStrong: alpha(p.peach400, '38'),
    blue: p.lilac400,
    rose: p.rose400,
    amber: p.amber400,
    emerald: p.mint400,
    emeraldSoft: alpha(p.mint400, '22'),
    danger: p.red400,
    dangerSoft: alpha(p.red400, '24'),
    focusRing: p.rose400,

    // Ambient / overlays
    glowAmber: alpha(p.amber400, '66'),
    glowBlue: alpha(p.lilac400, '44'),
    glowRose: alpha(p.rose400, '52'),
    overlaySoft: 'rgba(34,18,15,0.20)',
    overlayMedium: 'rgba(34,18,15,0.48)',
    overlayStrong: 'rgba(34,18,15,0.72)',

    // Text and surfaces shown on top of dark media/photo overlays.
    onImageText: '#fff8f2',
    onImageSecondary: 'rgba(255,243,233,0.92)',
    onImageChipBg: 'rgba(28,16,13,0.42)',
    onImageChipBorder: 'rgba(255,232,214,0.48)',
    onImageOverlayStrong: 'rgba(22,12,10,0.62)',
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
        ambientTop: alpha(colors.amber, '30'),
        ambientLeft: alpha(colors.rose, '22'),
        ambientRight: alpha(colors.primary, '24'),
        contour: alpha(colors.borderStrong, '7f'),
      },
      button: {
        base: {
          minHeight: 50,
          paddingVertical: 12,
          paddingHorizontal: 18,
          borderRadius: config.radius.lg,
        },
        text: {
          fontSize: 16,
          fontWeight: '800',
          letterSpacing: 0.15,
        },
        variants: {
          primary: {
            backgroundColor: colors.primary,
            borderColor: colors.primaryBorder,
            textColor: colors.primaryText,
            topGlow: alpha(colors.amber, '52'),
            bottomGlow: alpha(colors.rose, '38'),
          },
          secondary: {
            backgroundColor: colors.panel,
            borderColor: colors.borderStrong,
            textColor: colors.text,
          },
          danger: {
            backgroundColor: colors.dangerSoft,
            borderColor: colors.dangerBorder,
            textColor: colors.danger,
          },
        },
      },
      input: {
        label: {
          color: colors.secondary,
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 0.3,
        },
        field: {
          minHeight: 48,
          borderRadius: config.radius.lg,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: alpha(colors.card, 'f2'),
          color: colors.text,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 15,
        },
      },
      card: {
        shell: {
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.card,
          borderRadius: config.radius.xl,
        },
      },
      filter: {
        bar: {
          borderWidth: 1,
          borderColor: colors.borderStrong,
          borderRadius: config.radius.lg,
          backgroundColor: colors.panel,
        },
        active: {
          borderColor: colors.primaryBorder,
          backgroundColor: alpha(colors.primary, '30'),
        },
      },
      discovery: {
        pass: {
          backgroundColor: colors.panel,
          borderColor: colors.borderStrong,
          iconColor: colors.danger,
          labelColor: colors.secondary,
          shadowColor: alpha(colors.danger, '4d'),
        },
        like: {
          iconColor: colors.text,
          labelColor: colors.text,
        },
      },
    },
  };
}

const rawTheme = THEMES[ACTIVE_THEME_NAME] || THEMES.desertSunrise;

export const theme = buildTheme(rawTheme);
export const availableThemes = Object.keys(THEMES);
