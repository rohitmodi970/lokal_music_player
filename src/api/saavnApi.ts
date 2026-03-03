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
      `${BASE_URL}/api/artists/${artistId}/songs?page=${page}`,
    );
    const json = await res.json();
    if (json.success && json.data) {
      const songs = Array.isArray(json.data) ? json.data : json.data.results || [];
      await setCached(cacheKey, songs, TTL.MEDIUM);
      return songs;
    }
    return [];
  } catch (e) {
    console.error('getArtistSongs error:', e);
    return [];
  }
}
