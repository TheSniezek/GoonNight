import axios from 'axios';
import type { Post, E621Post, PostTag, AutocompleteItem } from './types';

const E621_API = 'http://localhost:3001/api/e621';

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
  auth?: { username: string; apiKey: string }, // 🔥 DODANE - auth do sprawdzania favorites
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
            username: auth?.username, // 🔥 DODANE
            apiKey: auth?.apiKey, // 🔥 DODANE
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
  const { data } = await axios.get<AutocompleteItem[]>('http://localhost:3001/api/e621/tags', {
    params: { q: query },
  });
  return data;
};
