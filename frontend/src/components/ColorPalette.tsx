export const T = {
  // Brand palette
  rust: '#9A2811',   // danger, cancelled, destructive actions
  orange: '#F2542D',   // primary CTA, highlights, active accents
  cream: '#F5DFBB',   // warm surface tint, hover rows, badges
  teal: '#19A2A2',   // success, delivered, secondary accent
  deepTeal: '#127475',   // sidebar, headers, primary data color

  // Extended surface scale
  darkBg: '#0E1F1F',   // sidebar background
  charcoal: '#1C2B2B',   // detail panels, avatar backgrounds
  white: '#FFFFFF',
  offWhite: '#FDFAF4',   // main page background (warm, not cold)
  mutedCream: '#EDE8DA',   // dividers, input borders, table lines
  panelBg: '#F7F4EE',   // alternating table rows, card insets

  // Ink (text)
  inkPrimary: '#1C2B2B',
  inkSecondary: '#5C6E6E',
  inkGhost: '#A09585',

  // Semantic
  success: '#127475',   // deepTeal — authoritative confirmation
  warning: '#F2542D',   // orange   — needs attention
  danger: '#9A2811',   // rust     — critical / cancelled
} as const