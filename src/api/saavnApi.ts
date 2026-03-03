import { Song } from '../types';
import { getCached, setCached, TTL } from '../utils/cache';

const BASE_URL = 'https://saavn.sumit.co';

// ---------- Search API ----------

interface SearchSongsResponse {
  success: boolean;
  data: {
    results: Song[];
    total: number;
    start: number;
  };
}

export async function searchSongs(
  query: string,
  page: number = 1,
  limit: number = 20,
): Promise<{ songs: Song[]; total: number }> {
  const cacheKey = `search_${query}_${page}_${limit}`;
  const cached = await getCached<{ songs: Song[]; total: number }>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/api/search/songs?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`;
    const res = await fetch(url);
    const json: SearchSongsResponse = await res.json();
    if (json.success && json.data) {
      const result = { songs: json.data.results || [], total: json.data.total || 0 };
      await setCached(cacheKey, result, TTL.MEDIUM);
      return result;
    }
    return { songs: [], total: 0 };
  } catch (e) {
    console.error('searchSongs error:', e);
    return { songs: [], total: 0 };
  }
}

// ---------- Songs API ----------

interface GetSongResponse {
  success: boolean;
  data: Song[];
}

export async function getSongById(id: string): Promise<Song | null> {
  const cacheKey = `song_${id}`;
  const cached = await getCached<Song>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${BASE_URL}/api/songs/${id}`);
    const json: GetSongResponse = await res.json();
    if (json.success && json.data?.length) {
      await setCached(cacheKey, json.data[0], TTL.LONG);
      return json.data[0];
    }
    return null;
  } catch (e) {
    console.error('getSongById error:', e);
    return null;
  }
}

export async function getSongSuggestions(id: string): Promise<Song[]> {
  const cacheKey = `suggestions_${id}`;
  const cached = await getCached<Song[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`${BASE_URL}/api/songs/${id}/suggestions`);
    const json = await res.json();
    if (json.success && json.data) {
      const songs = Array.isArray(json.data) ? json.data : [];
      await setCached(cacheKey, songs, TTL.MEDIUM);
      return songs;
    }
    return [];
  } catch (e) {
    console.error('getSongSuggestions error:', e);
    return [];
  }
}

// ---------- Trending / Home ----------

export async function getTrendingSongs(limit: number = 30): Promise<Song[]> {
  const cacheKey = `trending_${limit}`;
  const cached = await getCached<Song[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE_URL}/api/search/songs?query=trending&limit=${limit}`;
    const res = await fetch(url);
    const json: SearchSongsResponse = await res.json();
    if (json.success && json.data) {
      const songs = json.data.results || [];
      await setCached(cacheKey, songs, TTL.SHORT);
      return songs;
    }
    return [];
  } catch (e) {
    console.error('getTrendingSongs error:', e);
    return [];
  }
}

// ---------- Artists API ----------

export async function getArtistSongs(
  artistId: string,
  page: number = 1,
): Promise<Song[]> {
  const cacheKey = `artist_songs_${artistId}_${page}`;
  const cached = await getCached<Song[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(
      `${BASE_URL}/api/artists/${artistId}/songs?page=${page}&limit=20`,
    );
    const json = await res.json();
    if (json.success && json.data) {
      // Handle multiple possible shapes from the API
      let songs: Song[] = [];
      if (Array.isArray(json.data)) {
        songs = json.data;
      } else if (Array.isArray(json.data.results)) {
        songs = json.data.results;
      } else if (Array.isArray(json.data.songs)) {
        songs = json.data.songs;
      } else if (json.data.topSongs && Array.isArray(json.data.topSongs)) {
        songs = json.data.topSongs;
      }
      if (songs.length > 0) {
        await setCached(cacheKey, songs, TTL.MEDIUM);
        return songs;
      }
    }
    return [];
  } catch (e) {
    console.error('getArtistSongs error:', e);
    return [];
  }
}

/** Fallback: search songs by artist name when ID-based fetch returns nothing */
export async function searchSongsByArtist(
  artistName: string,
  limit: number = 20,
): Promise<Song[]> {
  const cacheKey = `artist_search_${artistName}_${limit}`;
  const cached = await getCached<Song[]>(cacheKey);
  if (cached) return cached;
  try {
    const result = await searchSongs(artistName, 1, limit);
    const filtered = result.songs.filter((s) => {
      const artists = [
        ...(s.artists?.primary ?? []),
        ...(s.artists?.featured ?? []),
        ...(s.artists?.all ?? []),
      ];
      return artists.some((a) =>
        a.name.toLowerCase().includes(artistName.toLowerCase()),
      );
    });
    const songs = filtered.length > 0 ? filtered : result.songs;
    if (songs.length > 0) await setCached(cacheKey, songs, TTL.MEDIUM);
    return songs;
  } catch (e) {
    console.error('searchSongsByArtist error:', e);
    return [];
  }
}

// ---------- Albums API ----------

export async function getAlbumSongs(albumId: string): Promise<Song[]> {
  const cacheKey = `album_songs_${albumId}`;
  const cached = await getCached<Song[]>(cacheKey);
  if (cached) return cached;
  try {
    const res = await fetch(`${BASE_URL}/api/albums?id=${albumId}`);
    const json = await res.json();
    if (json.success && json.data?.songs) {
      const songs: Song[] = Array.isArray(json.data.songs) ? json.data.songs : [];
      if (songs.length > 0) await setCached(cacheKey, songs, TTL.LONG);
      return songs;
    }
    return [];
  } catch (e) {
    console.error('getAlbumSongs error:', e);
    return [];
  }
}
