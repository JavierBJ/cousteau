const STORAGE_KEY = 'travel-inspo-state-v1';
const CATEGORIES = [
  'History & heritage',
  'Food & drink culture',
  'Nature & geography',
  'Arts & music',
  'Local customs & daily life',
  'Current culture & trends',
  'Practical travel insights'
];

let state = {
  selectedCountries: [],
  selectedCategories: CATEGORIES.slice(), // Default to all categories
  factHistory: [],
  lastFactDate: null,
  lastCountry: null,
  perCountryCategories: {}
};

const OLLAMA_MODEL = 'gemma3:latest';


function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) state = Object.assign(state, JSON.parse(raw));
  }catch(e){console.warn('Invalid state, resetting',e); localStorage.removeItem(STORAGE_KEY)}
}

function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function $(id){return document.getElementById(id)}

function showView(name){
  // Single-page UX: scroll to the section instead of swapping views
  const el = $('view-'+name);
  if(el && el.scrollIntoView) el.scrollIntoView({behavior:'smooth', block:'center'});
}

function toggleHistoryPanel(show){
  const panel = $('history-panel'); if(!panel) return;
  const shouldShow = typeof show === 'boolean' ? show : panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !shouldShow);
}

async function generateFact(){
  if(!state.selectedCountries || state.selectedCountries.length < 3){ alert('Add 3-5 countries in Settings.'); return; }
  const today = new Date().toISOString().slice(0,10);
  const country = pickCountry();
  const category = pickCategoryForCountry(country);
  renderLoading(true);
  try{
    const fact = await callOllamaForFact(country, category);
    const trimmedFact = (fact||'').trim();
    const finalFact = trimmedFact || fallbackGenerate(country, category);
    const entry = {country, fact: finalFact, date: today, category};
    // Keep only the latest entry per day: remove any existing for today
    state.factHistory = state.factHistory.filter(h=>h.date !== today);
    state.factHistory.unshift(entry);
    state.lastFactDate = today;
    state.lastCountry = country;
    markCategoryUsed(country, category);
    saveState();
    renderTodayCard(entry);
    renderHistory();
  }catch(e){
    alert('Error generating fact: '+e.message);
  }finally{ renderLoading(false); }
}

function renderLoading(isLoading){
  $('generate-btn').disabled = isLoading;
  $('generate-btn').textContent = isLoading ? 'Generating...' : 'Generate';
}

function renderTodayCard(entry){
  if(!entry){ $('card-country').textContent = '—'; $('card-fact').textContent = 'Select countries in Settings to start.'; $('card-category').textContent=''; return; }
  $('card-country').textContent = entry.country;
  $('card-fact').innerHTML = renderMarkdown(entry.fact);
  $('card-category').textContent = entry.category;
  // Render link preview cards for any Wikipedia links present in the rendered fact
  renderLinkPreviews();
}

// Simple in-memory cache for Wikipedia summaries
const WIKI_CACHE = {};

function extractWikiArticleFromUrl(href){
  try{
    const u = new URL(href, window.location.href);
    if(!/(^|\.)wikipedia\.org$/.test(u.hostname)) return null;
    const m = u.pathname.match(/\/wiki\/(.+)$/);
    if(!m) return null;
    // Remove fragment or query
    let title = m[1].split('#')[0].split('?')[0];
    return decodeURIComponent(title);
  }catch(e){ return null; }
}

async function fetchWikipediaSummary(title){
  if(!title) return null;
  if(WIKI_CACHE[title]) return WIKI_CACHE[title];
  try{
    const encoded = encodeURIComponent(title.replace(/ /g,'_'));
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
    const res = await fetch(url);
    if(!res.ok) return null;
    const data = await res.json();
    WIKI_CACHE[title] = data;
    return data;
  }catch(e){ console.warn('Wiki fetch failed',e); return null; }
}

function createPreviewElement(summary, href){
  const wrap = document.createElement('div'); wrap.className = 'link-preview fade-in';
  const img = document.createElement('img');
  if(summary && summary.thumbnail && summary.thumbnail.source) img.src = summary.thumbnail.source;
  else img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="84" height="60"><rect width="100%" height="100%" fill="%23f1f5f9"/></svg>';
  const meta = document.createElement('div'); meta.className = 'meta';
  const title = document.createElement('h4');
  const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel='noopener noreferrer'; a.textContent = (summary && summary.title) ? summary.title : href;
  a.style.color = '';
  title.appendChild(a);
  const desc = document.createElement('p'); desc.className='desc'; desc.textContent = (summary && summary.description) ? summary.description : '';
  const extract = document.createElement('p'); extract.className='extract'; extract.textContent = (summary && summary.extract) ? (summary.extract.length>220 ? summary.extract.slice(0,217)+'…' : summary.extract) : '';
  meta.appendChild(title); if(desc.textContent) meta.appendChild(desc); if(extract.textContent) meta.appendChild(extract);
  wrap.appendChild(img); wrap.appendChild(meta);
  return wrap;
}

async function renderLinkPreviews(){
  const container = $('link-previews'); if(!container) return;
  container.innerHTML = '';
  const factEl = $('card-fact'); if(!factEl) return;
  const anchors = Array.from(factEl.querySelectorAll('a'));
  // For every anchor that points to an en.wikipedia.org article, fetch and show a summary
  for(const a of anchors){
    const title = extractWikiArticleFromUrl(a.href);
    if(!title) continue;
    // build canonical wiki url
    const canonical = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g,'_'))}`;
    const summary = await fetchWikipediaSummary(title);
    if(summary){
      const el = createPreviewElement(summary, canonical);
      container.appendChild(el);
    }
  }
}

function renderHistory(){
  const container = $('history-list'); container.innerHTML = '';
  state.factHistory.forEach(h=>{
    const div=document.createElement('div'); div.className='history-item';
    div.innerHTML = `<div class="history-meta">${h.date} • ${h.country} • ${h.category}</div><div>${renderMarkdown(h.fact)}</div>`;
    container.appendChild(div);
  });
}

// Minimal, safe markdown-like renderer for bold/italic/code/links and paragraphs.
function escapeHtml(str){
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function renderMarkdown(text){
  if(!text) return '';
  const raw = String(text);

  function formatInlinesEscaped(s){
    // s is expected to be HTML-escaped already
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

  // First, replace Markdown links with anchors, formatting only the link text.
  let withLinks = raw.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, disp, url)=>{
    const dispEsc = escapeHtml(disp);
    const dispFmt = formatInlinesEscaped(dispEsc);
    const urlEsc = escapeHtml(url);
    return `<a href="${urlEsc}" target="_blank" rel="noopener noreferrer">${dispFmt}</a>`;
  });

  // Now split by anchor tags and format other text parts safely
  const segments = withLinks.split(/(<a\b[^>]*>[\s\S]*?<\/a>)/gi).filter(Boolean);
  const processed = segments.map(seg=>{
    if(/^<a\b/i.test(seg)) return seg; // already formatted anchor
    const esc = escapeHtml(seg);
    return formatInlinesEscaped(esc);
  }).join('');

  // Paragraphs: split on double newlines from the original raw text, but preserve our processed HTML by mapping segments back to paragraphs.
  const paras = processed.split(/\n\s*\n/).map(p=> p.trim()).filter(Boolean);
  return paras.map(p=> p.replace(/\n/g,'<br/>')).map(p=> `<p>${p}</p>`).join('');
}

function pickCountry(){
  // Avoid repeating last country if possible
  const candidates = state.selectedCountries.filter(c=>c!==state.lastCountry);
  const pool = candidates.length ? candidates : state.selectedCountries;
  return pool[Math.floor(Math.random()*pool.length)];
}

function pickCategoryForCountry(country){
  const used = state.perCountryCategories[country] || [];
  // Use only selected categories instead of all CATEGORIES
  const availableCategories = state.selectedCategories && state.selectedCategories.length > 0
    ? state.selectedCategories
    : CATEGORIES;
  const remaining = availableCategories.filter(c=>!used.includes(c));
  const cat = remaining.length ? remaining[Math.floor(Math.random()*remaining.length)] : availableCategories[Math.floor(Math.random()*availableCategories.length)];
  return cat;
}

function markCategoryUsed(country, category){
  state.perCountryCategories[country] = state.perCountryCategories[country] || [];
  if(!state.perCountryCategories[country].includes(category)){
    state.perCountryCategories[country].push(category);
  }
  // Reset rotation after cycling through all selected categories
  const availableCategories = state.selectedCategories && state.selectedCategories.length > 0
    ? state.selectedCategories
    : CATEGORIES;
  if(state.perCountryCategories[country].length >= availableCategories.length){
    state.perCountryCategories[country] = []; // reset rotation after full cycle
  }
}

async function loadCountryList(){
  // Load master country list for suggestions and tag input
  try{
    const res = await fetch('countries.json');
    if(!res.ok) return console.warn('Could not load countries.json');
    window.COUNTRIES_LIST = await res.json();
  }catch(e){ console.warn('Failed loading countries list',e); window.COUNTRIES_LIST = []; }
}

// Tag-style input helpers
function addTag(country){
  if(!country) return;
  if(!state.selectedCountries) state.selectedCountries = [];
  if(state.selectedCountries.includes(country)) return;
  if(state.selectedCountries.length >= 5){ alert('Maximum 5 countries allowed.'); return; }
  state.selectedCountries.push(country);
  renderTags();
}

function removeTag(country){
  state.selectedCountries = (state.selectedCountries || []).filter(c=>c!==country);
  renderTags();
}

function renderTags(){
  const list = $('tags-list'); if(!list) return;
  list.innerHTML = '';
  (state.selectedCountries || []).forEach(c=>{
    const li = document.createElement('li'); li.className='tag-chip';
    const span = document.createElement('span'); span.textContent = c;
    const btn = document.createElement('button'); btn.type='button'; btn.textContent='✕';
    btn.addEventListener('click',()=>{ removeTag(c); });
    li.appendChild(span); li.appendChild(btn); list.appendChild(li);
  });
  const input = $('countries-input');
  if(input){
    input.placeholder = state.selectedCountries && state.selectedCountries.length ? '' : 'Type to add countries...';
    input.disabled = (state.selectedCountries || []).length >= 5;
  }
}

function showSuggestions(items){
  const box = $('suggestions'); if(!box) return;
  if(!items || !items.length){ box.classList.add('hidden'); box.innerHTML = '<div class="muted">No matches</div>'; return; }
  box.classList.remove('hidden');
  box.innerHTML = items.map(it=>`<div class="item">${it}</div>`).join('');
  // attach click handlers
  Array.from(box.querySelectorAll('.item')).forEach(el=> el.addEventListener('click', ()=>{ addTag(el.textContent); box.classList.add('hidden'); $('countries-input').value = ''; }));
}

function filterSuggestions(q){
  const all = window.COUNTRIES_LIST || [];
  if(!q || !q.trim()){ // show top suggestions
    const top = all.slice(0,8).filter(c=>!(state.selectedCountries||[]).includes(c));
    showSuggestions(top);
    return;
  }
  const ql = q.trim().toLowerCase();
  const matches = all.filter(c=> c.toLowerCase().includes(ql) && !(state.selectedCountries||[]).includes(c)).slice(0,8);
  showSuggestions(matches);
}

function setupTagInput(){
  const input = $('countries-input');
  const box = $('suggestions');
  if(!input || !box) return;
  input.addEventListener('input', e=>{ filterSuggestions(e.target.value); });
  input.addEventListener('keydown', e=>{
    if(e.key==='Enter'){ e.preventDefault(); const val = input.value.trim(); if(!val) return; // if exact match in list, use it
      const match = (window.COUNTRIES_LIST||[]).find(c=> c.toLowerCase()===val.toLowerCase());
      if(match) addTag(match); else addTag(val);
      input.value = ''; box.classList.add('hidden');
    } else if(e.key==='ArrowDown' || e.key==='ArrowUp'){
      const items = box.querySelectorAll('.item'); if(!items.length) return;
      const current = box.querySelector('.item.focus');
      let idx = Array.from(items).indexOf(current);
      if(e.key==='ArrowDown') idx = Math.min(items.length-1, idx+1); else idx = Math.max(0, idx-1);
      if(current) current.classList.remove('focus');
      const next = items[idx] || items[0]; next.classList.add('focus'); next.scrollIntoView({block:'nearest'});
    } else if(e.key==='Escape'){ box.classList.add('hidden'); }
  });
  // click outside to close
  document.addEventListener('click', ev=>{
    const root = document.getElementById('countries-tag-input');
    if(root && !root.contains(ev.target)){ box.classList.add('hidden'); }
  });
}

// Category selection helpers
function toggleCategory(category){
  if(!state.selectedCategories) state.selectedCategories = CATEGORIES.slice();
  const idx = state.selectedCategories.indexOf(category);
  if(idx > -1){
    // Don't allow deselecting if it's the last one
    if(state.selectedCategories.length <= 1){
      alert('At least one topic must be selected.');
      return;
    }
    state.selectedCategories.splice(idx, 1);
  } else {
    state.selectedCategories.push(category);
  }
  renderCategories();
}

function renderCategories(){
  const container = $('categories-list');
  if(!container) return;
  container.innerHTML = '';
  if(!state.selectedCategories || state.selectedCategories.length === 0){
    state.selectedCategories = CATEGORIES.slice(); // Default to all
  }
  CATEGORIES.forEach(cat=>{
    const isSelected = state.selectedCategories.includes(cat);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = cat;
    btn.className = isSelected
      ? 'px-3 py-2 rounded-lg text-sm font-medium bg-sky-600 text-white border border-sky-600 hover:bg-sky-700 transition'
      : 'px-3 py-2 rounded-lg text-sm font-medium bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition';
    btn.addEventListener('click', ()=>{ toggleCategory(cat); });
    container.appendChild(btn);
  });
}

async function callOllamaForFact(country, category){
  const prompt = buildPrompt(country, category);
  try{
    const body = { model: OLLAMA_MODEL, prompt, max_tokens: 180 };
    const res = await fetch('http://localhost:11434/api/generate', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    if(!res.ok) throw new Error('LLM not available ('+res.status+')');
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    // Ollama often returns streaming NDJSON (`application/x-ndjson`). Handle that.
    if(contentType.includes('ndjson') || contentType.includes('stream') || contentType.includes('application/x-ndjson')){
      const txt = await res.text();
      let acc = '';
      txt.split(/\r?\n/).forEach(line=>{
        if(!line.trim()) return;
        try{
          const obj = JSON.parse(line);
          if(typeof obj.response === 'string') acc += obj.response;
          else if(obj.output){
            if(Array.isArray(obj.output)) acc += obj.output.join('');
            else acc += String(obj.output);
          }
        }catch(e){ /* ignore malformed lines */ }
      });
      return acc.trim() || null;
    }

    const json = await res.json();
    // Ollama responses vary; try to extract text
    if(json && json.output) return (json.output[0] || '').trim();
    if(json && json.text) return json.text.trim();
    if(json && json.response) return String(json.response).trim();
    return null;
  }catch(e){
    console.warn('Ollama call failed',e);
    return null;
  }
}

function buildPrompt(country, category){
  return `You are a travel curator and factual researcher. For ${country} in the category: ${category}, produce a concise (2-4 sentence) micro-fact that is both informative and evocative. Ground the description in verifiable information when possible (real places, well-known dishes, observable customs, geographic or historical facts, or practical travel details). Prioritize factual accuracy and avoid vague generalities. When you mention notable entities (places, landmarks, dishes, historical figures, institutions), add at most two Markdown inline links pointing to their English Wikipedia pages using the format [Name](https://en.wikipedia.org/wiki/Article_Title). Only include links you are confident actually exist — do not invent or fabricate Wikipedia pages; if unsure, mention the entity without a link. Use URL-encoded article titles where necessary. Do not include other source lists, headers, or follow-up instructions. Keep the tone evocative but primarily factual.`;
}

function fallbackGenerate(country, category){
  // Simple deterministic fallback so the app can be demoed without Ollama
  const snippets = {
    'History & heritage': `A street in ${country} where the facades hold centuries of stories, with rituals that still mark the daily rhythm.`,
    'Food & drink culture': `In ${country}, there is a dish cooked in homes for generations; its aroma blends spices and memories of family celebrations.`,
    'Nature & geography': `On the outskirts of a small town in ${country} lies a landscape that changes color as if time unravels: hills, rivers, and a silence that invites you to stay.`,
    'Arts & music': `The streets of ${country} hold music born in plazas: traditional instruments converse with modern rhythms, creating vibrations you feel in your chest.`,
    'Local customs & daily life': `In ${country}, a daily gesture—like sharing tea at sunset—reveals a hospitality that turns strangers into honored guests.`,
    'Current culture & trends': `In ${country} there is a creative wave: young collectives reinterpret traditions in galleries and cafés, offering new perspectives to curious visitors.`,
    'Practical travel insights': `To get around in ${country}, learning a local phrase and using regional transport turns long journeys into memorable encounters with people and landscapes.`
  };
  return snippets[category] || `A memorable detail about ${country} that sparks curiosity.`;
}

function setupUI(){
  const navToday = $('nav-today'); if(navToday) navToday.addEventListener('click',()=>showView('today'));
  const navSettings = $('nav-settings'); if(navSettings) navSettings.addEventListener('click',()=>showView('settings'));
  const navHistory = $('nav-history'); if(navHistory) navHistory.addEventListener('click',()=>{ toggleHistoryPanel(); });
  const closeHistory = $('close-history'); if(closeHistory) closeHistory.addEventListener('click',()=> toggleHistoryPanel(false));
  $('generate-btn').addEventListener('click',generateFact);
  $('countries-form').addEventListener('submit',e=>{
    e.preventDefault();
    const raw = (state.selectedCountries || []).slice();
    if(raw.length<3 || raw.length>5){ alert('Select between 3 and 5 countries.'); return; }
    // Validate at least one category is selected
    if(!state.selectedCategories || state.selectedCategories.length === 0){
      alert('At least one topic must be selected.');
      return;
    }
    // reset per-country categories for new countries
    raw.forEach(c=> state.perCountryCategories[c]=state.perCountryCategories[c]||[]);
    saveState();
    alert('Saved. You can generate a fact from Today.');
    showView('today');
  });
  $('clear-storage').addEventListener('click',()=>{ if(confirm('Delete local data?')){ localStorage.removeItem(STORAGE_KEY); location.reload(); }});
}

// Removed rate-limit UI: users can generate unlimited facts.

async function init(){
  loadState();
  setupUI();
  await loadCountryList();
  setupTagInput();
  // pre-populate any saved countries into tags
  if(state.selectedCountries && state.selectedCountries.length > 5){
    state.selectedCountries = state.selectedCountries.slice(0,5);
    saveState();
  }
  // Ensure selectedCategories is initialized
  if(!state.selectedCategories || state.selectedCategories.length === 0){
    state.selectedCategories = CATEGORIES.slice();
  }
  // Render saved tags without re-adding them to the array (avoids duplicates)
  renderTags();
  renderCategories();
  renderHistory();
  renderTodayCard(state.factHistory[0]);
  // Assume model is available (managed by deployment); enable generate button.
  const gen = $('generate-btn'); if(gen) gen.disabled = false;
}

init();
