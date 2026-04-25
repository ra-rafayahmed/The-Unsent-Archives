---
name: The Unsent Archives
colors:
  surface: '#fcf9f5'
  surface-dim: '#dcdad6'
  surface-bright: '#fcf9f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3ef'
  surface-container: '#f0edea'
  surface-container-high: '#ebe8e4'
  surface-container-highest: '#e5e2de'
  on-surface: '#1c1c1a'
  on-surface-variant: '#594138'
  inverse-surface: '#31302e'
  inverse-on-surface: '#f3f0ec'
  outline: '#8d7167'
  outline-variant: '#e2bfb3'
  surface-tint: '#a83900'
  primary: '#a83900'
  on-primary: '#ffffff'
  primary-container: '#ff6b2b'
  on-primary-container: '#5c1c00'
  inverse-primary: '#ffb59a'
  secondary: '#615e57'
  on-secondary: '#ffffff'
  secondary-container: '#e7e2d9'
  on-secondary-container: '#67645d'
  tertiary: '#5d5f5f'
  on-tertiary: '#ffffff'
  tertiary-container: '#989999'
  on-tertiary-container: '#2f3132'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbce'
  primary-fixed-dim: '#ffb59a'
  on-primary-fixed: '#380d00'
  on-primary-fixed-variant: '#802a00'
  secondary-fixed: '#e7e2d9'
  secondary-fixed-dim: '#cbc6bd'
  on-secondary-fixed: '#1d1b16'
  on-secondary-fixed-variant: '#494640'
  tertiary-fixed: '#e2e2e2'
  tertiary-fixed-dim: '#c6c6c7'
  on-tertiary-fixed: '#1a1c1c'
  on-tertiary-fixed-variant: '#454747'
  background: '#fcf9f5'
  on-background: '#1c1c1a'
  surface-variant: '#e5e2de'
typography:
  display-serif:
    fontFamily: Newsreader
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Newsreader
    fontSize: 32px
    fontWeight: '500'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Newsreader
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
  quote-text:
    fontFamily: Newsreader
    fontSize: 20px
    fontWeight: '400'
    lineHeight: '1.6'
  body-lg:
    fontFamily: Work Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Work Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.08em
  ui-button:
    fontFamily: Work Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1120px
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 64px
  stack-sm: 12px
  stack-md: 24px
  stack-lg: 48px
---

## Brand & Style
The design system is anchored in the concept of "Digital Ephemera"—the preservation of intimate thoughts that were never meant to be shared. It evokes the emotional weight of a handwritten letter discovered in an attic. The brand personality is quiet, intellectual, and deeply human, prioritizing the act of reading and reflection over rapid consumption.

The aesthetic blends **Minimalism** with **Tactile** editorial design. It utilizes expansive whitespace to give words "room to breathe," mimicking the margins of a high-quality literary journal. The interface remains intentionally understated to allow the primary orange—representing the spark of a creative or emotional impulse—to guide the user’s journey through the archives.

## Colors
The palette is a dialogue between "Ink" and "Paper." The primary background utilizes a warm, aged-paper tone to reduce eye strain and provide a historical, archival feel. Pure white is reserved strictly for cards and elevated surfaces to create a subtle "layered paper" effect.

The brand orange serves as a high-energy focal point. It is used sparingly for interactive triggers, progress indicators, and branding elements to represent the "living" nature of these archives. Muted text tones are pulled from the shadows of folded paper, ensuring that secondary information does not compete with the primary narrative content.

## Typography
This design system employs a dual-typeface strategy to distinguish between content and container. 

**Newsreader** is the voice of the author. It is used for headlines, long-form prose, and pull-quotes. Its traditional, authoritative serif structure provides the necessary literary gravity. 

**Work Sans** is the voice of the platform. It is used for navigation, metadata, labels, and functional UI. Its clean, geometric clarity ensures that the interface feels modern and efficient, preventing the "aged paper" aesthetic from feeling dated. Use increased line-height for body text to honor the reading experience.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy for desktop to maintain optimal line lengths for reading (roughly 65-75 characters). Content should be centered with generous horizontal margins to mimic the feel of a printed page.

A vertical rhythm of 8px (the base unit) governs all elements. Text-heavy views should utilize "Stack LG" spacing between major sections to prevent visual clutter. For archives and feeds, use a single-column or staggered masonry layout to emphasize the individual importance of each "unsent" entry rather than a dense, overwhelming grid.

## Elevation & Depth
Depth in this design system is achieved through **Ambient Shadows** and tonal layering rather than harsh borders. 

Cards utilize a very soft, diffused shadow (0px 4px 20px rgba(26, 26, 24, 0.06)) to appear as if they are resting naturally on the aged-paper background. There are only two levels of elevation:
1. **The Base:** The page background (#F5EFE6).
2. **The Surface:** The Card (#FFFFFF), used for individual posts, letters, or menu overlays.

When an element is hovered, the shadow should slightly deepen and the card should lift (translate Y) by 2px, mimicking the physical sensation of picking up a piece of correspondence.

## Shapes
The shape language balances the rigid lines of traditional paper with the softness of modern social interaction. 

- **Cards:** Use a consistent 12px (rounded-lg) corner radius to soften the literary content and make the platform feel approachable.
- **Buttons:** Follow a full **Pill-shaped** (rounded-full) geometry. This creates a distinct visual contrast against the rectangular cards, making interactive elements immediately recognizable.
- **Inputs:** Use a soft 8px radius to align with the cards while maintaining a structured appearance for data entry.

## Components
### Buttons
Buttons are strictly pill-shaped. The Primary CTA uses the brand orange with white text. Ghost buttons use a subtle "Ink" border (1px) with the muted text color for secondary actions.

### Cards
Cards are the primary container for "Archives." They must always have a pure white background and the defined 12px rounded corners. Internal padding should be generous (min 24px) to maintain the editorial feel.

### Chips & Tags
Used for categorization (e.g., "Unrequited," "Family," "Regrets"). These should have a subtle background color (#EAE2D5) and Work Sans Label-Caps typography to distinguish them from the letter content.

### Inputs
Text fields should be minimal, utilizing a light border that only darkens on focus. Use the brand orange for the cursor/caret to provide a subtle hint of the brand’s energy during the writing process.

### Postmarks (Platform Speciality)
A unique component for this design system: a small, circular metadata badge (containing date/location) that sits in the top-right corner of a card, styled to look like a subtle physical postmark using the muted text color.