/**
 * Unit tests for Travel Inspiration utility functions
 * Run with: npm test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  escapeHtml,
  extractWikiArticleFromUrl,
  formatInlinesEscaped,
  renderMarkdown,
  pickCategoryForCountry,
  pickCountry,
  isValidCountrySelection
} from './utils.js';

describe('escapeHtml', () => {
  it('should escape HTML special characters', () => {
    const input = '<script>alert("XSS")</script>';
    const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;';
    expect(escapeHtml(input)).toBe(expected);
  });

  it('should escape ampersands', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });

  it('should escape quotes', () => {
    expect(escapeHtml(`She said "hello"`)).toBe('She said &quot;hello&quot;');
    expect(escapeHtml(`It's nice`)).toBe('It&#39;s nice');
  });

  it('should handle empty strings', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('should handle strings with no special characters', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});

describe('extractWikiArticleFromUrl', () => {
  it('should extract article title from standard Wikipedia URL', () => {
    const url = 'https://en.wikipedia.org/wiki/Eiffel_Tower';
    expect(extractWikiArticleFromUrl(url)).toBe('Eiffel_Tower');
  });

  it('should extract article title with spaces (URL encoded)', () => {
    const url = 'https://en.wikipedia.org/wiki/Costa_Rica';
    expect(extractWikiArticleFromUrl(url)).toBe('Costa_Rica');
  });

  it('should extract article title and remove fragments', () => {
    const url = 'https://en.wikipedia.org/wiki/Japan#History';
    expect(extractWikiArticleFromUrl(url)).toBe('Japan');
  });

  it('should extract article title and remove query parameters', () => {
    const url = 'https://en.wikipedia.org/wiki/France?action=edit';
    expect(extractWikiArticleFromUrl(url)).toBe('France');
  });

  it('should return null for non-Wikipedia URLs', () => {
    expect(extractWikiArticleFromUrl('https://google.com')).toBe(null);
    expect(extractWikiArticleFromUrl('https://example.com/wiki/Test')).toBe(null);
  });

  it('should return null for Wikipedia URLs without /wiki/ path', () => {
    expect(extractWikiArticleFromUrl('https://en.wikipedia.org/')).toBe(null);
    expect(extractWikiArticleFromUrl('https://en.wikipedia.org/about')).toBe(null);
  });

  it('should handle invalid URLs gracefully', () => {
    expect(extractWikiArticleFromUrl('not-a-url')).toBe(null);
    expect(extractWikiArticleFromUrl('')).toBe(null);
  });

  it('should work with different Wikipedia subdomains', () => {
    const url = 'https://es.wikipedia.org/wiki/España';
    expect(extractWikiArticleFromUrl(url)).toBe('España');
  });
});

describe('formatInlinesEscaped', () => {
  it('should format bold text with **', () => {
    const input = 'This is **bold** text';
    const expected = 'This is <strong>bold</strong> text';
    expect(formatInlinesEscaped(input)).toBe(expected);
  });

  it('should format bold text with __', () => {
    const input = 'This is __bold__ text';
    const expected = 'This is <strong>bold</strong> text';
    expect(formatInlinesEscaped(input)).toBe(expected);
  });

  it('should format italic text with *', () => {
    const input = 'This is *italic* text';
    const expected = 'This is <em>italic</em> text';
    expect(formatInlinesEscaped(input)).toBe(expected);
  });

  it('should format italic text with _', () => {
    const input = 'This is _italic_ text';
    const expected = 'This is <em>italic</em> text';
    expect(formatInlinesEscaped(input)).toBe(expected);
  });

  it('should format code with backticks', () => {
    const input = 'Use `console.log()` to debug';
    const expected = 'Use <code>console.log()</code> to debug';
    expect(formatInlinesEscaped(input)).toBe(expected);
  });

  it('should format multiple inline styles', () => {
    const input = '**Bold** and *italic* and `code`';
    const expected = '<strong>Bold</strong> and <em>italic</em> and <code>code</code>';
    expect(formatInlinesEscaped(input)).toBe(expected);
  });

  it('should handle plain text without formatting', () => {
    const input = 'Plain text';
    expect(formatInlinesEscaped(input)).toBe('Plain text');
  });
});

describe('renderMarkdown', () => {
  it('should render a simple paragraph', () => {
    const input = 'This is a paragraph.';
    const expected = '<p>This is a paragraph.</p>';
    expect(renderMarkdown(input)).toBe(expected);
  });

  it('should render bold text', () => {
    const input = 'This is **bold** text.';
    const expected = '<p>This is <strong>bold</strong> text.</p>';
    expect(renderMarkdown(input)).toBe(expected);
  });

  it('should render links', () => {
    const input = 'Visit [Wikipedia](https://wikipedia.org) for info.';
    const result = renderMarkdown(input);
    expect(result).toContain('<a href="https://wikipedia.org"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain('Wikipedia</a>');
  });

  it('should render links with bold text inside', () => {
    const input = 'Visit [**Wikipedia**](https://wikipedia.org) now.';
    const result = renderMarkdown(input);
    expect(result).toContain('<strong>Wikipedia</strong>');
  });

  it('should escape HTML in regular text', () => {
    const input = '<script>alert("XSS")</script>';
    const result = renderMarkdown(input);
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>');
  });

  it('should handle multiple paragraphs', () => {
    const input = 'Paragraph one.\n\nParagraph two.';
    const result = renderMarkdown(input);
    expect(result).toBe('<p>Paragraph one.</p><p>Paragraph two.</p>');
  });

  it('should convert single newlines to <br/>', () => {
    const input = 'Line one.\nLine two.';
    const result = renderMarkdown(input);
    expect(result).toBe('<p>Line one.<br/>Line two.</p>');
  });

  it('should handle empty input', () => {
    expect(renderMarkdown('')).toBe('');
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown(undefined)).toBe('');
  });

  it('should handle complex markdown with all features', () => {
    const input = 'The **Eiffel Tower** is in [Paris](https://en.wikipedia.org/wiki/Paris).\n\nIt is *very* tall.';
    const result = renderMarkdown(input);
    expect(result).toContain('<strong>Eiffel Tower</strong>');
    expect(result).toContain('<a href="https://en.wikipedia.org/wiki/Paris"');
    expect(result).toContain('<em>very</em>');
    expect(result).toMatch(/<p>.*<\/p><p>.*<\/p>/);
  });
});

describe('pickCategoryForCountry', () => {
  const categories = ['History', 'Food', 'Nature', 'Arts', 'Customs'];

  it('should return a category from available categories', () => {
    const result = pickCategoryForCountry('France', [], categories);
    expect(categories).toContain(result);
  });

  it('should avoid recently used categories when possible', () => {
    const usedCategories = ['History', 'Food', 'Nature'];
    const availableCategories = ['History', 'Food', 'Nature', 'Arts', 'Customs'];

    // Run multiple times to ensure we only get unused categories
    for (let i = 0; i < 10; i++) {
      const result = pickCategoryForCountry('France', usedCategories, availableCategories);
      // Should only return Arts or Customs (unused categories)
      expect(['Arts', 'Customs']).toContain(result);
    }
  });

  it('should pick from all categories when all have been used', () => {
    const allUsed = ['History', 'Food', 'Nature', 'Arts', 'Customs'];
    const result = pickCategoryForCountry('France', allUsed, categories);
    expect(categories).toContain(result);
  });

  it('should throw error if availableCategories is empty', () => {
    expect(() => {
      pickCategoryForCountry('France', [], []);
    }).toThrow('availableCategories must not be empty');
  });

  it('should handle empty used categories', () => {
    const result = pickCategoryForCountry('France', [], categories);
    expect(categories).toContain(result);
  });
});

describe('pickCountry', () => {
  const countries = ['France', 'Japan', 'Brazil', 'Egypt'];

  it('should return a country from the list', () => {
    const result = pickCountry(countries);
    expect(countries).toContain(result);
  });

  it('should avoid the last country when possible', () => {
    const lastCountry = 'France';
    const otherCountries = ['Japan', 'Brazil', 'Egypt'];

    // Run multiple times to ensure we avoid the last country
    for (let i = 0; i < 10; i++) {
      const result = pickCountry(countries, lastCountry);
      // With 4 countries and avoiding 1, we should get one of the other 3
      expect(otherCountries).toContain(result);
    }
  });

  it('should return the last country if it is the only option', () => {
    const singleCountry = ['France'];
    const result = pickCountry(singleCountry, 'France');
    expect(result).toBe('France');
  });

  it('should return null for empty country list', () => {
    expect(pickCountry([])).toBe(null);
    expect(pickCountry(null)).toBe(null);
    expect(pickCountry(undefined)).toBe(null);
  });

  it('should handle null lastCountry', () => {
    const result = pickCountry(countries, null);
    expect(countries).toContain(result);
  });
});

describe('isValidCountrySelection', () => {
  it('should return true for 3 countries', () => {
    expect(isValidCountrySelection(['France', 'Japan', 'Brazil'])).toBe(true);
  });

  it('should return true for 4 countries', () => {
    expect(isValidCountrySelection(['France', 'Japan', 'Brazil', 'Egypt'])).toBe(true);
  });

  it('should return true for 5 countries', () => {
    expect(isValidCountrySelection(['France', 'Japan', 'Brazil', 'Egypt', 'Peru'])).toBe(true);
  });

  it('should return false for 2 countries', () => {
    expect(isValidCountrySelection(['France', 'Japan'])).toBe(false);
  });

  it('should return false for 6 countries', () => {
    expect(isValidCountrySelection(['A', 'B', 'C', 'D', 'E', 'F'])).toBe(false);
  });

  it('should return false for empty array', () => {
    expect(isValidCountrySelection([])).toBe(false);
  });

  it('should return false for non-arrays', () => {
    expect(isValidCountrySelection(null)).toBe(false);
    expect(isValidCountrySelection(undefined)).toBe(false);
    expect(isValidCountrySelection('not an array')).toBe(false);
    expect(isValidCountrySelection(123)).toBe(false);
  });
});
