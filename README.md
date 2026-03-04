# Lokal — AI-Powered Music Player

[![GitHub](https://img.shields.io/badge/GitHub-rohitmodi970%2Flokal__music__player-181717?logo=github)](https://github.com/rohitmodi970/lokal_music_player)
[![Open Source](https://img.shields.io/badge/Open%20Source-%E2%9D%A4-red)](#contributing)

A modern React Native music player built with Expo. Lokal streams songs from JioSaavn, plays local device audio, and uses a three-tier LLM stack (Gemini → gpt-4o-mini → hardcoded fallback) to power smart recommendations, dynamic home feeds, and a conversational AI music assistant.

---

## Features

### Playback
- Stream songs, albums, and artists from **JioSaavn** via the Saavn API
- Play **local device audio files** (MP3, M4A, etc.) from your storage
- Full player controls: play/pause, skip, seek, shuffle, repeat (off/one/all)
- **Mini player** persistent bar across all screens
- Background playback with **lock screen / notification controls**
- **Sleep timer** with live countdown and auto-pause

### AI — Three-Tier LLM Fallback
All AI features use an automatic fallback chain so the app always responds:

```
Tier 1: Google Gemini (gemini-flash-latest)
  └─ Tier 2: api.ai.cc → gpt-4o-mini
       └─ Tier 3: Hardcoded keyword catalogue (instant, no network)
```

- **Dynamic home feed** — time-of-day-aware search query (morning energy / afternoon focus / night vibes). Returns a static query instantly; LLM result is cached and used on next open — no blocking wait.
- **AI Music Chat** — conversational assistant that recommends and explains music. Extracted song names are searchable and playable directly.
- **Smart queue suggestions** — suggests 3 similar songs after a track ends
- **AI playlist name generator** — generates creative names from your song list
- **Mood-to-query mapper** — converts a mood/vibe into a JioSaavn search query

### Library
- **Favorites** — like any song with a heart button, persisted across launches
- **Playlists** — create, rename, and delete custom playlists
- **History** — last 100 played songs, newest first
- **Queue management** — drag-to-reorder, remove tracks, view full queue

### Search
- Full-text song / artist / album search on JioSaavn
- Recent searches saved locally (max 10)
- Cached results to avoid repeat network calls

### Settings
- Light / Dark mode toggle
- Audio quality selector
- Sleep timer
- Clear cache
- Equalizer shortcut (opens system audio settings)
- Notification permissions
- Send feedback via email
- About / Privacy / Terms

### Animated Splash Screen
Six vibrant brand-coloured panels (`#F7C948 → #0A0564`) slide down on launch, the Lokal K logo springs in, then the screen fades out into the app.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo SDK 54 |
| Language | TypeScript |
| Navigation | `@react-navigation/native-stack` |
| State | Zustand |
| Styling | NativeWind (Tailwind CSS) |
| Animation | `react-native-reanimated` + RN `Animated` API |
| Audio | `expo-av` |
| Local files | `expo-media-library` |
| Storage | `@react-native-async-storage/async-storage` |
| Streaming | JioSaavn API (`saavn.sumit.co`) |
| LLM Tier 1 | Google Gemini (`gemini-flash-latest`) |
| LLM Tier 2 | api.ai.cc (`gpt-4o-mini`, OpenAI-compatible) |
| Notifications | `expo-notifications` |

---

## Project Structure

```
src/
├── api/
│   ├── aiService.ts          # All LLM calls — Gemini, api.ai.cc, hardcoded fallback
│   └── saavnApi.ts           # JioSaavn REST API + response caching
├── audio/
│   └── audioManager.ts       # expo-av wrapper, playback controls, notifications
├── components/
│   ├── MiniPlayer.tsx         # Persistent bottom player bar
│   ├── SongItem.tsx           # Song list row
│   └── SongOptionsModal.tsx   # Long-press song action sheet
├── constants/
│   └── colors.ts              # Theme colour palette
├── navigation/
│   └── AppNavigator.tsx       # Root stack navigator
├── screens/
│   ├── HomeScreen.tsx         # Suggested / Albums / Artists / Local tabs
│   ├── SearchScreen.tsx       # Full-text search
│   ├── PlayerScreen.tsx       # Full-screen now playing
│   ├── AiChatScreen.tsx       # Conversational AI music assistant
│   ├── PlaylistsScreen.tsx    # Library playlists
│   ├── PlaylistDetailScreen.tsx
│   ├── FavoritesScreen.tsx
│   ├── QueueScreen.tsx
│   ├── ArtistDetailScreen.tsx
│   └── SettingsScreen.tsx
├── store/
│   ├── usePlayerStore.ts      # Playback queue, current song, controls
│   ├── useLibraryStore.ts     # Favorites, history, playlists
│   └── useThemeStore.ts       # Light/dark mode, colour map
├── types/
│   └── index.ts               # Shared TypeScript interfaces
└── utils/
    ├── cache.ts               # AsyncStorage TTL cache (SHORT/MEDIUM/LONG/DAY)
    ├── helpers.ts             # Formatting, image URL extraction
    └── notificationManager.ts # Lock screen / notification channel setup

App.tsx                        # Real root component (not expo-router)
index.js                       # registerRootComponent entry point
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Android Studio (for Android emulator) or Xcode (for iOS simulator)

### Install & Run

```bash
# Install dependencies
npm install

# Start dev server
npx expo start

# Run on Android
npx expo run:android

# Run on iOS
npx expo run:ios
```

### Environment / API Keys

This project is open source. You'll need to supply your own API keys for AI features. Open `src/api/aiService.ts` and replace the placeholder keys:

```typescript
const GEMINI_API_KEY = 'YOUR_GEMINI_KEY';   // https://aistudio.google.com/
const AICC_API_KEY   = 'YOUR_AICC_KEY';     // https://api.ai.cc/console/token
```

> **Never commit your real API keys.** Add a `.env.local` file (already git-ignored) and load keys from there if you prefer.

The JioSaavn API is public and requires no key.

---

## Caching Strategy

| Cache key | TTL | What's cached |
|-----------|-----|--------------|
| `search_<query>_<page>_<limit>` | 15 min | JioSaavn search results |
| `song_<id>` | 1 hr | Individual song metadata |
| `suggestions_<id>` | 15 min | Song suggestions |
| `trending_<limit>` | 5 min | Trending songs |
| `artist_songs_<id>_<page>` | 15 min | Artist discography |
| `home_query_<period>` | 1 hr | LLM-generated time-of-day query |

All cache entries are stored under the `@lokal_cache_` AsyncStorage prefix.  
Clear all cache at any time via **Settings → Clear Cache**.

---

## Documentation

| File | Description |
|------|-------------|
| [doc/AI_FEATURES.md](doc/AI_FEATURES.md) | LLM architecture, all AI features, how to add new ones |
| [doc/STORAGE.md](doc/STORAGE.md) | AsyncStorage keys, Zustand stores, cache TTLs, data flow |

---

## Permissions (Android)

The app requests the following at runtime:

| Permission | Why |
|-----------|-----|
| `READ_MEDIA_AUDIO` | Play local music files |
| `READ_EXTERNAL_STORAGE` | Legacy audio access (Android < 13) |
| `POST_NOTIFICATIONS` | Lock screen / notification player controls |

---

## Contributing

This project is **open source** and contributions are welcome!

### Repository

```
https://github.com/rohitmodi970/lokal_music_player.git
```

### Reporting Issues

Found a bug or have a feature request?  
[Open an issue](https://github.com/rohitmodi970/lokal_music_player/issues/new) on GitHub — please include:
- A clear description of the problem or idea
- Steps to reproduce (for bugs)
- Device / OS / Expo SDK version

### Submitting Changes

1. **Fork** the repository
2. Create a new branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes and commit with a meaningful message
4. Push your branch and open a **Pull Request** against `main`

> **Do not push directly to `main` (master) branch.** All changes must go through a Pull Request so they can be reviewed before merging.

### Setting Up Your Own API Keys

When developing locally, use your own keys (see [Environment / API Keys](#environment--api-keys) above). Never commit real keys to the repository. Add them to a `.env.local` file or directly in `src/api/aiService.ts` (which is git-ignored patterns recommended).

---

## License

MIT License — see [LICENSE](LICENSE) for details.  
Feel free to use, modify, and distribute this project with attribution.
