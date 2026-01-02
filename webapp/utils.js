/**
 * Utility functions for Travel Inspiration app
 * These functions are extracted for unit testing purposes
 */

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string} str - The string to escape
 * @returns {string} - The escaped string
 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Extracts Wikipedia article title from a URL
 * @param {string} href - The URL to parse
 * @returns {string|null} - The article title or null if not a Wikipedia URL
 */
export function extractWikiArticleFromUrl(href) {
  try {
    const u = new URL(href, 'http://localhost');
    if (!/(^|\.)wikipedia\.org$/.test(u.hostname)) return null;
    const m = u.pathname.match(/\/wiki\/(.+)$/);
    if (!m) return null;
    // Remove fragment or query
    let title = m[1].split('#')[0].split('?')[0];
    return decodeURIComponent(title);
  } catch (e) {
    return null;
  }
}

/**
 * Formats inline markdown syntax (bold, italic, code) on already-escaped HTML
 * @param {string} s - The HTML-escaped string to format
 * @returns {string} - The formatted string with HTML tags
 */
export function formatInlinesEscaped(s) {
  let out = s;
  // code spans
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  // bold
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  // italic
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/_([^_]+)_/g, '<em>$1</em>');
  return out;
}

/**
 * Renders markdown text to HTML
 * @param {string} text - The markdown text to render
 * @returns {string} - The rendered HTML
 */
export function renderMarkdown(text) {
  if (!text) return '';
  const raw = String(text);

  // First, replace Markdown links with anchors, formatting only the link text.
  let withLinks = raw.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, disp, url) => {
    const dispEsc = escapeHtml(disp);
    const dispFmt = formatInlinesEscaped(dispEsc);
    const urlEsc = escapeHtml(url);
    return `<a href="${urlEsc}" target="_blank" rel="noopener noreferrer">${dispFmt}</a>`;
  });

  // Now split by anchor tags and format other text parts safely
  const segments = withLinks.split(/(<a\b[^>]*>[\s\S]*?<\/a>)/gi).filter(Boolean);
  const processed = segments.map(seg => {
    if (/^<a\b/i.test(seg)) return seg; // already formatted anchor
    const esc = escapeHtml(seg);
    return formatInlinesEscaped(esc);
  }).join('');

  // Paragraphs: split on double newlines from the original raw text
  const paras = processed.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  return paras.map(p => p.replace(/\n/g, '<br/>')).map(p => `<p>${p}</p>`).join('');
}

/**
 * Picks a category for a country avoiding recently used ones
 * @param {string} country - The country name
 * @param {Array<string>} usedCategories - Array of already used categories for this country
 * @param {Array<string>} availableCategories - Array of all available categories
 * @returns {string} - The selected category
 */
export function pickCategoryForCountry(country, usedCategories = [], availableCategories = []) {
  if (!availableCategories || availableCategories.length === 0) {
    throw new Error('availableCategories must not be empty');
  }

  const remaining = availableCategories.filter(c => !usedCategories.includes(c));
  const cat = remaining.length
    ? remaining[Math.floor(Math.random() * remaining.length)]
    : availableCategories[Math.floor(Math.random() * availableCategories.length)];
  return cat;
}

/**
 * Picks a random country from a list, avoiding the last used one if possible
 * @param {Array<string>} countries - Array of country names
 * @param {string|null} lastCountry - The last country that was used
 * @returns {string|null} - The selected country or null if the list is empty
 */
export function pickCountry(countries = [], lastCountry = null) {
  if (!countries || countries.length === 0) return null;

  // Avoid repeating last country if possible
  const candidates = countries.filter(c => c !== lastCountry);
  const pool = candidates.length ? candidates : countries;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Validates if a country list has the required number of countries (3-5)
 * @param {Array<string>} countries - Array of country names
 * @returns {boolean} - True if the list has 3-5 countries
 */
export function isValidCountrySelection(countries) {
  return Array.isArray(countries) && countries.length >= 3 && countries.length <= 5;
}
