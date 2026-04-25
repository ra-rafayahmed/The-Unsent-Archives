# The Unsent Archives — Frontend Implementation Plan

## 1. Design System (Extracted from Stitch Inspirations)

The stitch folder contains 7 conceptual HTML mockups and a comprehensive `DESIGN.md`. These are **not** code to be reused — they are visual references for the aesthetic, layout patterns, and interaction style. The following design DNA should be extracted and applied:

### 1.1 Brand Philosophy
> "Digital Ephemera" — the preservation of intimate thoughts that were never meant to be shared. The personality is quiet, intellectual, and deeply human.

### 1.2 Color Palette
All stitch screens use the same **Material Design 3** token family. The core values are:

| Token | Hex | Usage |
|---|---|---|
| `background` (page) | `#F5EFE6` | Warm aged-paper base for all pages |
| `surface` (cards) | `#FFFFFF` | Pure white for cards and elevated surfaces |
| `primary` | `#a83900` | Deep burnt orange, used for text links and active states |
| `primary-container` | `#FF6B2B` | Vibrant orange, used for CTAs, FAB, active pills |
| `on-surface` | `#1c1c1a` | Primary text color |
| `outline-variant` | `#e2bfb3` | Subtle borders and dividers |
| `secondary-container` | `#e7e2d9` | Tag chip backgrounds |
| Card shadow | `0px 4px 20px rgba(26,26,24,0.06)` | Consistent ambient shadow across all cards |
| Hover shadow | `0px 8px 30px rgba(26,26,24,0.10)` | Deepened shadow on card hover |

### 1.3 Typography (Dual Typeface Strategy)
- **Newsreader** (serif) — "Voice of the author". Headlines, quotes, poetry, pull-quotes
- **Work Sans** (sans-serif) — "Voice of the platform". Navigation, labels, metadata, buttons

| Scale | Font | Size | Weight | Use |
|---|---|---|---|---|
| `display-serif` | Newsreader | 48px | 600 | Hero text, splash |
| `headline-lg` | Newsreader | 32px | 500 | Page headings |
| `headline-md` | Newsreader | 24px | 500 | Section titles, card titles |
| `quote-text` | Newsreader | 20px | 400 | Post content, literary text |
| `body-lg` | Work Sans | 18px | 400 | Extended paragraphs |
| `body-md` | Work Sans | 16px | 400 | Default body text |
| `label-caps` | Work Sans | 12px | 600 | Uppercase metadata labels, tags |
| `ui-button` | Work Sans | 14px | 500 | Button text |

### 1.4 Component Patterns (From Stitch Screens)

**Cards** — Pure white `#FFFFFF`, 12px rounded corners, generous 24px+ internal padding, ambient shadow. Hover: lift `translateY(-2px)` + deeper shadow.

**Buttons** — Always pill-shaped (`rounded-full`). Primary CTA uses `#FF6B2B` bg with white text. Ghost buttons use 1px border with muted text.

**Tags/Chips** — Background `#EAE2D5`, `label-caps` typography, `rounded-full`. Orange-tinted variant for suggested tags: `bg-[#FF6B2B]/10 text-primary border border-primary/20`.

**Postmark Badge** — A unique circular metadata stamp (date/location) positioned top-right of cards, rotated ~12deg, using `label-caps` at 8-10px. Visible in: `single_note_view`, `note_editor`.

**FAB (Floating Action Button)** — Fixed `bottom-8 right-8`, `w-14 h-14`, orange `#FF6B2B`, strong shadow `0 8px 30px rgba(255,107,43,0.4)`. Contains `edit` icon. Present on all authenticated pages.

**Mobile Bottom Nav** — Fixed bottom bar with 4 tabs, `backdrop-blur-md`, shows on `md:hidden`. Active tab gets `#FF6B2B` color with filled icon variant.

**Masonry Layout** — CSS column-based masonry (1 col mobile → 2 col tablet → 3 col desktop). Used for feeds and profile grids. `break-inside: avoid` on items with consistent `margin-bottom`.

---

## 2. Page-by-Page Architecture

Each page below maps to one stitch inspiration + corresponding backend API endpoints.

---

### 2.1 Authentication Pages (`/login`, `/register`)
**Stitch Reference:** None (no auth mockup exists). Design a minimal card-based form centered on the `#F5EFE6` background, consistent with the editorial aesthetic.

**Backend Endpoints:**
- `POST /api/auth/register` — Body: `{ username, email, password }`
- `POST /api/auth/login` — Body: `{ email, password }` → Returns `{ token, user }`
- `GET /api/auth/me` — Validate stored JWT on app load

**Implementation Notes:**
- Store JWT in `localStorage`; attach via Axios interceptor on all requests
- Use React Context (`AuthContext`) for global auth state
- Protect private routes (`/write`, `/library`, `/profile`) with a `<ProtectedRoute>` wrapper
- Login form: email + password fields, pill-shaped submit button
- Register form: username ("Pen Name") + email + password
- Brand name in `display-serif` italic at the top of the form card

---

### 2.2 Home / Discovery Feed (`/`)
**Stitch Reference:** `home_discovery_feed/`

**Key Design Patterns from Stitch:**
- Sticky top navbar with brand name, search input (in a white pill with orange focus ring), user avatar
- Filter row: horizontal scrollable pills (`All`, `Quotes`, `Micro-poetry`, `Thoughts`, `Reflections`, `Anonymous`, `Trending`) — All pill = orange filled, rest = white ghost border
- Masonry grid below with mixed card types:
  - **Quote card:** large quote icon top-left, italic `quote-text`, author `label-caps` bottom, heart/share icons
  - **Anonymous card:** no quote icon, `person_off` icon + "Anonymous" label
  - **Reflection card:** postmark badge top-right, multiple paragraphs, author in orange
  - **Image card:** background image with dark overlay, white text overlay, author avatar + label
  - **Trending card:** trending_up icon + "TRENDING" label in orange, read count
  - **Poetry card:** centered text, serif italic, larger spacing, `ink_pen` icon
  - **Music card:** parchment texture background, music_note icon + "Listening: [track]" label
- Floating Action Button (write) in bottom-right

**Backend Endpoints:**
- `GET /api/feed/` — General explore feed (paginated, returns array of Post objects)
- `GET /api/feed/trending` — Trending posts
- `GET /api/feed/following` — Posts from followed users (authenticated)
- `GET /api/tags/trending` — For the filter/tag pills
- `GET /api/search/` — For the search bar functionality (query param: `?q=`)

**Data Mapping (Post Model → Card):**
```
Post.content        → card body text
Post.style.font     → determines serif vs sans vs monospace rendering
Post.style.background → card background color or determines image card type
Post.media[0]       → if type === "image", render as image card with overlay
Post.media[0]       → if type === "audio", show ♪ icon + track name
Post.isAnonymous    → show person_off icon + "Anonymous" vs author username
Post.tagSlugs       → render as tag chips below content
Post.viewCount      → "X reads" label
Post.reactionCount  → heart count
Post.createdAt      → postmark date badge
Post.authorId       → populated to get username, avatarUrl
```

---

### 2.3 Single Note View (`/posts/:id`)
**Stitch Reference:** `single_note_view_the_unsent_archives/`

**Key Design Patterns from Stitch:**
- Full-width centered layout (`max-w-[640px]`)
- Hero card with background image, gradient overlay `from-black/80`, white overlay text in `display-serif` italic
- Postmark badge (circular, rotated, top-right of hero)
- Footer tags row: tag chips in `secondary-container` color
- **Reaction Strip:** Horizontal row of emoji reactions (`❤️ Love`, `🫂 Felt`, `💧 Cried`, `🕯️ Need`, `✨ Saved`) in a rounded pill container
- **Writer Band:** Author avatar (with orange ring), display name in `headline-md`, bio italic, Follow + Message buttons
- **Audio Player:** Play button (orange circle), track name, visual waveform bars
- **Save Strip:** Collection mosaic thumbnail grid, "Save to Collection" label, add_circle button
- **Comments Section ("Letters to the Writer"):** Current user avatar + textarea + "Post Anonymously" button. Past comments show: avatar, username, timestamp, quoted excerpt border-left, response text

**Backend Endpoints:**
- `GET /api/posts/:id` — Fetch full post with populated author & embedded comments
- `POST /api/posts/:id/reactions` — Body: `{ type }` where type ∈ `[like, love, haha, wow, sad, angry]`
- `DELETE /api/posts/:id/reactions` — Remove own reaction
- `GET /api/posts/:id/reactions` — Get reaction summary `{ like: N, love: N, ... }`
- `POST /api/posts/:id/comments` — Body: `{ text }`
- `DELETE /api/posts/:id/comments/:commentId`
- `POST /api/collections/:id/posts` — Save post to a collection
- `POST /api/events` — Log view event for analytics: `{ type: "view", postId }`

**Data Mapping:**
```
Post.content              → hero text overlay
Post.media[0] (image)     → hero background image
Post.media[0] (audio)     → audio player section (url, track name)
Post.style                → font/color customization of text
Post.tagSlugs             → tag chips row
Post.comments[]           → comments list (each has userId→populated, text, createdAt)
Post.reactionCount        → reaction strip counts
Post.authorId (populated) → writer band (username, bio, avatarUrl)
Post.isAnonymous          → hide author band, show person_off placeholder instead
```

---

### 2.4 Note Editor / Creator (`/write`)
**Stitch Reference:** `note_editor_creator_refined/`

**Key Design Patterns from Stitch:**
- Split screen layout: Left panel (35%) = Editor Settings, Right panel (65%) = Live Canvas
- Top bar: back arrow, brand name, "Save Draft" (ghost) + "Publish" (orange pill) buttons
- **Left Panel Settings:**
  - Typography: 2×2 grid of font style buttons (Serif, Handwritten, Typewriter, Minimal). Active = filled dark
  - Canvas: 5 color swatches as circles (active has orange ring), plus dashed upload area for custom texture/image
  - Ambiance: Music selector input with ♪ icon prefix
  - Visibility: 3-option segmented control pill (`Public` | `Anonymous` | `Private`). Active = white bg + shadow + orange text
  - Metadata: Tag chips in orange tint, dashed "+ Tag" button
  - Reset All Settings link at bottom
- **Right Panel Canvas:**
  - Main editor card: 24px rounded, editorial shadow, optional header image slot with "Change Image" overlay button, textarea area below with blinking orange cursor, author label + char counter in footer
  - Editing / Preview toggle tabs below the card
  - "How it appears in feed" miniature preview strip at bottom (40% scale)
- Postmark badge floating bottom-right (date + city, decorative)

**Backend Endpoints:**
- `POST /api/posts/` — Create new post
  ```json
  {
    "content": "string",
    "visibility": "public|followers|private",
    "isAnonymous": true|false,
    "style": { "font": "string", "background": "string", "textColor": "string" },
    "tagSlugs": ["unsent", "3am"],
    "media": [{ "url": "string", "type": "image|audio", "mimeType": "string" }]
  }
  ```
- `PUT /api/posts/:id` — Update existing post (same body)
- `GET /api/tags/` — Autocomplete tags in metadata section

**Key Implementation Details:**
- The editor should live-preview styling changes (font, background color) on the canvas card in real time
- Character counter maps to `Post.content.maxlength` (5000 chars from the model)
- Visibility toggle directly maps to `Post.visibility` enum + `Post.isAnonymous` boolean
- On mobile, collapse to single column with settings in a bottom sheet or expandable panel

---

### 2.5 User Profile (`/profile/:id`)
**Stitch Reference:** `user_profile_clara_whitmore/`

**Key Design Patterns from Stitch:**
- Desktop: 12-column grid (8 col main + 4 col sidebar)
- **Profile Header Card:** Avatar with orange ring border, display name in `headline-md`, @username below, italic bio quote, Follow + Message pills, stats row (Notes count / Followers / Following)
- **Tab Navigation:** `Notes` | `Collections` | `Saved` — Active tab = orange text + orange bottom border
- **Pinned Banner:** pin icon + italic quote in `quote-text` — the user's pinned/featured note
- **Masonry Grid of Posts:** Mixed card types identical to feed (text cards, image cards, private cards with dashed border + lock icon, anonymous cards with mist icon, poetry cards centered, music/draft cards)
- **Sidebar:**
  - "About this writer" card: Core Themes (tag chips), "Reading now" (book thumbnail + title + author)
  - "Writers like [user]" card: List of similar writers with avatars + follow buttons

**Backend Endpoints:**
- `GET /api/users/:id` — Profile data: `{ username, email, avatarUrl, bio, profile: { displayName, location, website }, tagInterests }`
- `PUT /api/users/:id` — Update own profile (authenticated, self only)
- `GET /api/users/:id/posts` — User's posts (paginated, respects visibility)
- `GET /api/users/:id/collections` — User's public collections
- `POST /api/follows` — Follow: `{ followeeId }`
- `DELETE /api/follows` — Unfollow: `{ followeeId }`
- `GET /api/follows/followers` — Followers list
- `GET /api/follows/following` — Following list

**Data Mapping:**
```
User.username        → @username label
User.profile.displayName → display name heading
User.avatarUrl       → profile avatar
User.bio             → italic bio quote
User.tagInterests    → "Core Themes" chips in sidebar
```

---

### 2.6 My Collections / Library (`/library`)
**Stitch Reference:** `my_collections/`

**Key Design Patterns from Stitch:**
- Header: "My Collections" title + italic subtitle + "+ New Collection" orange pill button
- Tab pills: `My Collections` (active, filled) | `Saved by Others` (ghost)
- **Collection Card Grid** (3 columns desktop): Each card is 340px tall with:
  - Top 60% = decorative visual zone (grain texture + scattered italic text fragments, or solid dark bg with lock icons, or colored bg with collaborator avatars, or themed bg with trending badge)
  - Bottom 40% = title in `headline-md`, visibility badge (Public/Private/Collaborative + icon), note count in `label-caps`
  - Hover: lift -2px
- **"Create New" placeholder card:** Dashed border, add icon, hover turns border orange
- "Collections you might like" horizontal scroll suggestions section
- **Right Sidebar:** Collection Stats card (Total Notes, Collections count, Followers), Suggested Tags cloud, "Writers You Save Most" list

**Backend Endpoints:**
- `GET /api/users/:id/collections` — Fetch own collections
- `POST /api/collections/` — Create: `{ name, description, visibility }`
- `GET /api/collections/:id` — Fetch single collection with populated posts
- `PUT /api/collections/:id` — Update name, description, visibility
- `DELETE /api/collections/:id` — Delete
- `POST /api/collections/:id/posts` — Add post: `{ postId }`
- `DELETE /api/collections/:id/posts/:postId` — Remove post

**Data Mapping:**
```
Collection.name       → card title
Collection.visibility → public/private badge + icon
Collection.postCount  → "X Notes" label
Collection.postIds    → populated for collection detail view
```

---

### 2.7 Explore / Search (`/explore`)
**Stitch Reference:** `explore_search_the_unsent_archives/`

**Key Design Patterns from Stitch:**
- Active search bar with orange ring highlight, populated search text + close icon
- Search dropdown overlay: recent search (history icon), tag suggestion, user suggestion, autocomplete, recent tag chips
- Trending Tags pill strip (horizontal scroll): first tag = orange filled "TRENDING: [tag]", rest = white ghost
- Best Match Banner: white card with orange left border accent, `quote-text` italic, highlighted matching text in `#FFE8D6`, anonymous author + timestamp
- Explore by Mood: horizontal scroll of mood cards (colored backgrounds: peach for Longing, beige for Grief, green for Hope, dark for 3am, yellow for Gratitude, pink for Love, gray for Letting Go) each with icon + name + entry count
- Split layout: 65% masonry search results + 35% sidebar widgets (Featured Writers, Curated Collections mosaic, Discover Tags cloud)
- "Voices You Might Recognize" — horizontal scroll of writer cards: text-bg banner → avatar circle overlapping → name + member since + Follow button

**Backend Endpoints:**
- `GET /api/search/?q=` — Full-text search across posts and users
- `GET /api/tags/` — List all tags
- `GET /api/tags/trending` — Trending tags for the pill strip
- `GET /api/tags/:slug/posts` — Posts by tag (for mood-based exploration)
- `GET /api/feed/trending` — Trending posts for "Best Match" section

---

### 2.8 Analytics Dashboard (Private) (`/analytics`)
**Stitch Reference:** None (no mockup exists). Design a clean stats page.

**Backend Endpoints:**
- `GET /api/posts/:id/analytics` — Per-post metrics (views, saves, reactions, reach)
- `GET /api/users/:id/analytics` — Aggregate account metrics
- `POST /api/events` — Log events (view, save, share) for tracking

**Implementation Notes:**
- Only accessible by the post owner, even for anonymous posts
- Simple stat cards showing: total views, total saves, total reactions, reach
- Per-post breakdown table/list
- Keep design minimal — this is a private utility page, not a public-facing experience

---

## 3. Tech Stack & Project Setup

| Layer | Choice | Rationale |
|---|---|---|
| Build tool | Vite | Fast HMR, already initialized |
| Framework | React 19 | Already installed |
| Routing | react-router-dom v7 | Already installed |
| Styling | Tailwind CSS v4 + `@tailwindcss/postcss` | Already configured |
| HTTP Client | Axios | Already installed, interceptor configured |
| Layout | react-masonry-css | Already installed |
| State | React Context (Auth) | Lightweight, sufficient for auth state |
| Icons | Google Material Symbols Outlined | Consistent with all stitch designs |
| Fonts | Newsreader + Work Sans (Google Fonts) | Already linked in index.html |

---

## 4. Folder Structure

```
frontend/src/
├── api/
│   └── axios.js              # Axios instance with JWT interceptor
├── context/
│   └── AuthContext.jsx        # Auth state (user, login, register, logout)
├── components/
│   ├── layout/
│   │   ├── Navbar.jsx         # Sticky top navigation bar
│   │   ├── MobileNav.jsx      # Fixed bottom tab bar (mobile only)
│   │   ├── FAB.jsx            # Floating Action Button (write)
│   │   └── RootLayout.jsx     # Outlet wrapper with nav + FAB
│   ├── cards/
│   │   ├── NoteCard.jsx       # Universal post card (handles all card variants)
│   │   ├── CollectionCard.jsx # Collection board card
│   │   └── WriterCard.jsx     # Writer suggestion / featured writer card
│   ├── feed/
│   │   ├── FilterPills.jsx    # Horizontal scrollable category filter
│   │   ├── MoodScroll.jsx     # Explore-by-mood horizontal cards
│   │   └── TrendingStrip.jsx  # Trending tags horizontal pill strip
│   ├── post/
│   │   ├── ReactionStrip.jsx  # Emoji reaction row
│   │   ├── WriterBand.jsx     # Author info + follow section
│   │   ├── AudioPlayer.jsx    # Music/ambiance player
│   │   ├── CommentSection.jsx # Comments thread + input
│   │   └── SaveToCollection.jsx # Collection save prompt
│   ├── editor/
│   │   ├── EditorSettings.jsx # Left panel: font, canvas, visibility, tags
│   │   ├── EditorCanvas.jsx   # Right panel: live preview card
│   │   └── FeedPreview.jsx    # Miniature feed preview strip
│   ├── profile/
│   │   ├── ProfileHeader.jsx  # Avatar, bio, stats, follow/message
│   │   ├── ProfileTabs.jsx    # Notes / Collections / Saved tab switcher
│   │   └── ProfileSidebar.jsx # About writer, similar writers
│   └── widgets/
│       ├── FeaturedWriters.jsx
│       ├── CuratedCollections.jsx
│       ├── DiscoverTags.jsx
│       └── SearchDropdown.jsx # Search suggestions overlay
├── pages/
│   ├── Auth/
│   │   ├── Login.jsx
│   │   └── Register.jsx
│   ├── Feed/
│   │   └── HomePage.jsx       # Discovery feed (masonry + filter pills)
│   ├── Explore/
│   │   └── ExplorePage.jsx    # Search + mood + trending + split layout
│   ├── Post/
│   │   └── SingleNoteView.jsx
│   ├── Editor/
│   │   └── CreateNotePage.jsx
│   ├── Profile/
│   │   └── UserProfile.jsx
│   ├── Library/
│   │   └── CollectionsBoard.jsx
│   └── Analytics/
│       └── AnalyticsDashboard.jsx
├── App.jsx                    # Route definitions
├── main.jsx                   # Entry point (BrowserRouter + AuthProvider)
└── index.css                  # Tailwind imports + global styles
```

---

## 5. Route Map

| Route | Page | Auth Required | Stitch Source |
|---|---|---|---|
| `/login` | Login | No | — |
| `/register` | Register | No | — |
| `/` | HomePage (Discovery Feed) | No | `home_discovery_feed` |
| `/explore` | ExplorePage (Search + Mood) | No | `explore_search_the_unsent_archives` |
| `/posts/:id` | SingleNoteView | No (public posts) | `single_note_view_the_unsent_archives` |
| `/write` | CreateNotePage | **Yes** | `note_editor_creator_refined` |
| `/write/:id` | Edit existing post | **Yes** | `note_editor_creator_refined` |
| `/profile/:id` | UserProfile (others) | No | `user_profile_clara_whitmore` |
| `/profile` | UserProfile (own) | **Yes** | `user_profile_clara_whitmore` |
| `/library` | CollectionsBoard | **Yes** | `my_collections` |
| `/library/:id` | Single collection view | Depends | `my_collections` |
| `/analytics` | AnalyticsDashboard | **Yes** | — |

---

## 6. Implementation Order

**Phase 1 — Foundation**
1. Configure `tailwind.config.js` with exact design tokens from DESIGN.md
2. Set up `index.css` global styles (masonry classes, scrollbar, parchment texture)
3. Build layout shell: `Navbar`, `MobileNav`, `FAB`, `RootLayout`
4. Implement `AuthContext` + `Login` + `Register` pages
5. Configure all routes in `App.jsx`

**Phase 2 — Core Content**
6. Build `NoteCard.jsx` (universal card handling all variants: text, image, audio, anonymous, poetry)
7. Build `HomePage.jsx` with `FilterPills` + masonry grid using `GET /api/feed/`
8. Build `SingleNoteView.jsx` with `ReactionStrip`, `WriterBand`, `CommentSection`
9. Build `CreateNotePage.jsx` with split-panel editor

**Phase 3 — Social & Discovery**
10. Build `UserProfile.jsx` with `ProfileHeader`, tabs, masonry grid of user posts
11. Build `CollectionsBoard.jsx` with collection card grid
12. Build `ExplorePage.jsx` with search, mood scroll, trending tags, sidebar widgets
13. Wire up follow/unfollow functionality across all writer cards

**Phase 4 — Polish**
14. Build `AnalyticsDashboard.jsx`
15. Add loading states, error boundaries, empty states
16. Mobile responsiveness pass for all pages
17. Animation polish (hover lifts, transitions, scroll behaviors)
