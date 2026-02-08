import type { Post } from '../api/types';
import type { BlacklistLine } from './useBlacklist';

export type SexSearch = {
  female: boolean;
  male: boolean;
  intersex: boolean;
  ambiguous: boolean;
};

/**
 * Sprawdza czy post pasuje do blacklist line
 * Blacklist line może zawierać wiele tagów oddzielonych spacją
 * Wszystkie tagi muszą pasować (AND logic)
 */
export function postMatchesBlacklistLine(post: Post, line: BlacklistLine): boolean {
  if (!line.enabled) return false; // Wyłączone linie nie filtrują

  const blacklistTags = line.tags.toLowerCase().split(/\s+/).filter(Boolean);
  const postTagNames = post.tags.map((t) => t.name.toLowerCase());

  // Wszystkie tagi z blacklist muszą być w poście (AND logic)
  return blacklistTags.every((blacklistTag) => {
    // Obsługa specjalnych tagów
    if (blacklistTag.startsWith('rating:')) {
      const rating = blacklistTag.replace('rating:', '');
      return post.rating === rating;
    }

    // Obsługa score
    if (blacklistTag.startsWith('score:')) {
      const scoreMatch = blacklistTag.match(/score:([<>]=?|=)(-?\d+)/);
      if (scoreMatch) {
        const operator = scoreMatch[1];
        const threshold = parseInt(scoreMatch[2], 10);
        const postScore = post.score.total;

        switch (operator) {
          case '<':
            return postScore < threshold;
          case '<=':
            return postScore <= threshold;
          case '>':
            return postScore > threshold;
          case '>=':
            return postScore >= threshold;
          case '=':
            return postScore === threshold;
          default:
            return false;
        }
      }
      return false;
    }

    // Obsługa favcount
    if (blacklistTag.startsWith('favcount:')) {
      const favMatch = blacklistTag.match(/favcount:([<>]=?|=)(-?\d+)/);
      if (favMatch) {
        const operator = favMatch[1];
        const threshold = parseInt(favMatch[2], 10);
        const postFavCount = post.fav_count;

        switch (operator) {
          case '<':
            return postFavCount < threshold;
          case '<=':
            return postFavCount <= threshold;
          case '>':
            return postFavCount > threshold;
          case '>=':
            return postFavCount >= threshold;
          case '=':
            return postFavCount === threshold;
          default:
            return false;
        }
      }
      return false;
    }

    // Zwykły tag
    return postTagNames.includes(blacklistTag);
  });
}

/**
 * Filtruje posty przez blacklist
 * Ukrywa posty które pasują do którejkolwiek WŁĄCZONEJ linii
 */
export function filterPostsByBlacklist(posts: Post[], blacklistLines: BlacklistLine[]): Post[] {
  const enabledLines = blacklistLines.filter((line) => line.enabled);

  if (enabledLines.length === 0) {
    return posts; // Brak włączonych linii = wszystkie posty widoczne
  }

  return posts.filter((post) => {
    // Post jest ukryty jeśli pasuje do KTÓREJKOLWIEK włączonej linii
    const isBlacklisted = enabledLines.some((line) => postMatchesBlacklistLine(post, line));

    return !isBlacklisted;
  });
}

/**
 * Filtruje posty przez sex search
 * Jeśli wszystkie są false = pokazuj wszystko
 * Jeśli przynajmniej jeden true = pokazuj TYLKO te z włączonymi tagami (OR logic)
 */
export function filterPostsBySexSearch(posts: Post[], sexSearch: SexSearch): Post[] {
  const { female, male, intersex, ambiguous } = sexSearch;

  // Jeśli wszystkie false = pokazuj wszystko
  if (!female && !male && !intersex && !ambiguous) {
    return posts;
  }

  // Mapa tagów na nazwy w e621
  const genderTags: string[] = [];
  if (female) genderTags.push('female');
  if (male) genderTags.push('male');
  if (intersex) genderTags.push('intersex');
  if (ambiguous) genderTags.push('ambiguous_gender');

  // Pokazuj posty które mają KTÓRYKOLWIEK z włączonych tagów (OR logic)
  return posts.filter((post) => {
    const postTagNames = post.tags.map((t) => t.name.toLowerCase());
    return genderTags.some((genderTag) => postTagNames.includes(genderTag));
  });
}
