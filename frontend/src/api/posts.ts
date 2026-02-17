import axios from 'axios';
import type { Post, E621Post, PostTag, AutocompleteItem, PopularScale } from './types';

const IS_PROD = import.meta.env.PROD;
const BASE_URL = IS_PROD ? '' : 'http://localhost:3001';
const E621_API = IS_PROD ? `${BASE_URL}/api/e621` : `${BASE_URL}/api/e621`;

export const getPreviewVideoUrl = (post: E621Post): string | undefined => {
  // najpierw spróbuj 480p
  const altSamples = post.sample?.alternates?.samples;
  if (altSamples?.['480p']?.url) return altSamples['480p'].url;

  // potem 720p
  if (altSamples?.['720p']?.url) return altSamples['720p'].url;

  // fallback na pełną rozdzielczość
  return post.file.url;
};

export const mapE621Post = (post: E621Post): Post => {
  const tags: PostTag[] = [
    ...(post.tags.artist?.map((name) => ({ name, type: 'artist' as const })) || []),
    ...(post.tags.copyright?.map((name) => ({ name, type: 'copyright' as const })) || []),
    ...(post.tags.character?.map((name) => ({ name, type: 'character' as const })) || []),
    ...(post.tags.species?.map((name) => ({ name, type: 'species' as const })) || []),
    ...(post.tags.general?.map((name) => ({ name, type: 'general' as const })) || []),
    ...(post.tags.meta?.map((name) => ({ name, type: 'meta' as const })) || []),
  ];

  const sampleVideoUrl = getPreviewVideoUrl(post);

  return {
    id: post.id,
    created_at: post.created_at,

    file: {
      url: post.file.url,
      ext: post.file.ext,
      size: post.file.size,
      width: post.sample?.width ?? post.preview?.width ?? 0,
      height: post.sample?.height ?? post.preview?.height ?? 0,
    },

    preview: {
      url: post.preview?.url,
      alt: post.preview?.alt,
      width: post.preview?.width ?? 0,
      height: post.preview?.height ?? 0,
    },

    sample: {
      has: post.sample?.has ?? false,
      url: sampleVideoUrl,
      alt: post.sample?.alt,
      width: post.sample?.width ?? 0,
      height: post.sample?.height ?? 0,
    },

    tags,
    is_favorited: post.is_favorited,
    rating: post.rating,
    score: post.score,
    fav_count: post.fav_count,
    sources: post.sources || [],
    uploader_id: post.uploader_id,
    approver_id: post.approver_id,
    flags: post.flags,
    parent_id: post.relationships?.parent_id ?? null,
    children: post.relationships?.children ?? [],
    pool_ids: post.pools ?? [],
  };
};

export const fetchPosts = async (
  tags: string,
  page = 1,
  auth?: { username: string; apiKey: string },
): Promise<Post[]> => {
  const { data } = await axios.get<{ posts: E621Post[] }>(E621_API, {
    params: { tags, page, username: auth?.username, apiKey: auth?.apiKey },
  });
  return data.posts.map(mapE621Post);
};

export const fetchPostsForMultipleTags = async (
  observedTags: string[],
  baseQuery: string, // np. "date:week"
  auth?: { username: string; apiKey: string },
): Promise<Post[]> => {
  const results: Post[] = [];
  const seen = new Set<number>();

  // Dzielimy tagi na paczki po 30 sztuk
  const chunkSize = 30;
  const chunks = [];
  for (let i = 0; i < observedTags.length; i += chunkSize) {
    chunks.push(observedTags.slice(i, i + chunkSize));
  }

  // Przetwarzamy każdą paczkę
  await Promise.all(
    chunks.map(async (chunk) => {
      // Tworzymy query: "~tag1 ~tag2 ... ~tag30 date:week"
      const tagsString = chunk.map((t) => `~${t}`).join(' ');
      const query = `${tagsString} ${baseQuery}`.trim();

      try {
        const { data } = await axios.get<{ posts: E621Post[] }>(E621_API, {
          params: {
            tags: query,
            page: 1,
            limit: 320,
            username: auth?.username,
            apiKey: auth?.apiKey,
          },
        });

        data.posts.forEach((post) => {
          if (!seen.has(post.id)) {
            seen.add(post.id);
            results.push(mapE621Post(post));
          }
        });
      } catch (e) {
        console.error('Błąd fetchowania paczki tagów', e);
      }
    }),
  );

  return results.sort((a, b) => (a.id < b.id ? 1 : -1)); // Sortujemy po ID (od najnowszych)
};

export const fetchTagSuggestions = async (query: string) => {
  const endpoint = IS_PROD ? `${BASE_URL}/api/tags` : `${BASE_URL}/api/e621/tags`;
  const { data } = await axios.get<AutocompleteItem[]>(endpoint, {
    params: { q: query },
  });
  return data;
};

export const fetchPopularPosts = async (
  date: string, // format: YYYY-MM-DD
  scale: PopularScale,
  auth?: { username: string; apiKey: string },
): Promise<Post[]> => {
  const endpoint = IS_PROD ? `${BASE_URL}/api/popular` : `${BASE_URL}/api/e621/popular`;
  const { data } = await axios.get<{ posts: E621Post[] }>(endpoint, {
    params: {
      date,
      scale,
      username: auth?.username,
      apiKey: auth?.apiKey,
    },
  });
  return data.posts.map(mapE621Post);
};

// Pobierz nazwy użytkowników po ID (uploader/approver)
export const fetchUserNames = async (ids: number[]): Promise<Record<number, string>> => {
  const filtered = ids.filter(Boolean);
  if (!filtered.length) return {};
  const { data } = await axios.get<{ users: Record<string, string> }>(
    `${BASE_URL}/api/e621/users`,
    { params: { ids: filtered.join(',') } },
  );
  // Konwertuj klucze z string na number
  const result: Record<number, string> = {};
  for (const [k, v] of Object.entries(data.users || {})) {
    result[Number(k)] = v;
  }
  return result;
};

// Pobierz meta posta (pools, relationships) - wywoływane lazy gdy otwieramy info popup
export const fetchPostMeta = async (
  postId: number,
): Promise<{
  parent_id: number | null;
  children: number[];
  has_children: boolean;
  pools: { id: number; name: string | null }[];
}> => {
  const { data } = await axios.get(`${BASE_URL}/api/e621/post-meta/${postId}`);
  return data;
};
