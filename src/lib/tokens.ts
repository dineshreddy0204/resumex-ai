/**
 * ResumeX AI — Core Ultra Design System Tokens
 * 
 * Palette:
 * - Ultra White: #FFFFFF (Dominant canvas & surfaces, ~90-95%)
 * - Warm White:  #FAF9F5 (Page backgrounds & subtle contrast)
 * - Primary Olive: #4F5D2F (Primary interactions, active states, ~3-7%)
 * - Deep Olive:    #37421F (Hover, pressed, deep accents)
 * - Premium Gold:  #C49A3A (Restrained high-value accents, ~1-3%)
 * - Soft Gold:     #E6D3A3 (Borders, pill highlights, subtle badges)
 * - Primary Text:  #171713 (High contrast charcoal)
 * - Secondary Text:#6E6E63 (Muted readable neutral)
 * - Border:        #E5E5DE (Subtle crisp borders)
 */

export const TOKENS = {
  colors: {
    bg: '#FAF9F5',
    surface: '#FFFFFF',
    surfaceHover: '#F7F6F0',
    primaryOlive: '#4F5D2F',
    deepOlive: '#37421F',
    lightOlive: '#EEF2E6',
    premiumGold: '#C49A3A',
    softGold: '#E6D3A3',
    lightGold: '#FBF7ED',
    textPrimary: '#171713',
    textSecondary: '#6E6E63',
    textMuted: '#9B9B8F',
    border: '#E5E5DE',
    borderLight: '#F0F0EA',
    borderGold: '#E6D3A3',
    success: '#2E7D32',
    successLight: '#E8F5E9',
    warning: '#D97706',
    warningLight: '#FEF3C7',
    error: '#DC2626',
    errorLight: '#FEE2E2',
  },
  typography: {
    fontSans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
} as const;
