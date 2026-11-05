import { describe, expect, it } from 'vitest';
import { TV_SEARCH_CATEGORIES } from './SearchScreen';

describe('what Search offers on the television', () => {
  it('is movies, shows and music: books are not on the TV', () => {
    expect(TV_SEARCH_CATEGORIES.map((category) => category.key)).toEqual(['movies', 'shows', 'music']);
  });
});
