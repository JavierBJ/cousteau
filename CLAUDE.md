# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Travel Inspiration is a proof-of-concept web application that generates daily travel facts about user-selected countries. The app integrates with Ollama (local LLM) to produce engaging, factual micro-stories across various cultural categories, with fallback content when the LLM is unavailable.

## Development Commands

### Running the Application

Start all services via Docker Compose:
```bash
docker compose up -d
```

Access the web app at `http://localhost:8080`

### Service Management

Stop services:
```bash
docker compose down
```

View logs:
```bash
docker compose logs -f webapp
docker compose logs -f ollama
```

### Testing Ollama API

The Ollama service exposes its API on port 11434. Test connectivity:
```bash
curl http://localhost:11434/api/generate -d '{"model":"gemma3:latest","prompt":"test"}'
```

## Architecture

### Container Setup

The application runs two Docker services:
1. **ollama**: Local LLM service (ollama/ollama:latest) on port 11434
2. **webapp**: Static nginx server serving the frontend on port 8080

The webapp container mounts `./webapp` as read-only to `/usr/share/nginx/html`.

### Frontend Architecture (Single-Page Vanilla JS)

**Core State Management** (`app.js:12-18`):
- Uses localStorage for persistence (`STORAGE_KEY: 'travel-inspo-state-v1'`)
- Tracks: selected countries (3-5), fact history, category rotation per country
- State object: `selectedCountries`, `factHistory`, `lastFactDate`, `lastCountry`, `perCountryCategories`

**Category Rotation System** (`app.js:215-230`):
- Seven hardcoded categories: History & heritage, Food & drink culture, Nature & geography, Arts & music, Local customs & daily life, Current culture & trends, Practical travel insights
- Each country cycles through all categories before resetting
- Prevents repetition via `perCountryCategories` state tracking

**Fact Generation Flow** (`app.js:46-69`):
1. Validates 3-5 countries are selected
2. Picks random country (avoids last-used if possible)
3. Selects unused category for that country
4. Calls Ollama API with structured prompt (`buildPrompt()`)
5. Falls back to deterministic snippets if LLM fails
6. Stores one fact per day (replaces any existing for same date)
7. Renders to card with markdown formatting and Wikipedia link previews

**LLM Integration** (`app.js:320-358`):
- Model: `gemma3:latest` (configurable via `OLLAMA_MODEL`)
- Endpoint: `http://localhost:11434/api/generate`
- Handles streaming NDJSON responses from Ollama
- Max tokens: 180
- Gracefully degrades to `fallbackGenerate()` on error

**Wikipedia Link Preview System** (`app.js:85-148`):
- Parses rendered markdown for Wikipedia links
- Extracts article titles from en.wikipedia.org URLs
- Fetches summaries via Wikipedia REST API (`/api/rest_v1/page/summary/`)
- In-memory cache (`WIKI_CACHE`) to avoid redundant requests
- Renders preview cards with thumbnail, title, description, and extract

**Markdown Renderer** (`app.js:159-206`):
- Custom safe markdown parser (no external library)
- Supports: bold (**text**), italic (*text*), code (`text`), inline links [text](url)
- HTML-escapes all content before processing
- Converts double newlines to paragraph breaks
- Single newlines become `<br/>` tags

**Country Selection UI** (`app.js:241-318`):
- Tag-based input with autocomplete suggestions
- Loads country list from `countries.json` (152 countries)
- Maximum 5 countries, minimum 3 for fact generation
- Keyboard navigation: Enter to add, Arrow keys to navigate suggestions, Escape to close
- Exact or fuzzy matching against country list

### File Structure

```
/
├── docker-compose.yml       # Service orchestration (ollama + nginx webapp)
├── README.md                # Basic setup instructions (Spanish)
└── webapp/                  # Static frontend files served by nginx
    ├── index.html           # Single-page layout with Today/Settings views
    ├── app.js               # All application logic (~418 lines)
    ├── styles.css           # Custom styling with Tailwind CDN
    └── countries.json       # Master list of 152 countries for autocomplete
```

## Key Implementation Details

### Prompt Engineering

The LLM prompt (`buildPrompt()` at `app.js:360-362`) instructs the model to:
- Generate 2-4 sentence micro-facts grounded in verifiable information
- Include up to 2 Wikipedia markdown links for notable entities
- Prioritize factual accuracy over creative embellishment
- Use URL-encoded article titles and only link to confident Wikipedia pages

### Data Persistence

- All state saved to localStorage on every mutation
- No backend database or API required
- History persists indefinitely (no automatic cleanup)
- Clear storage button resets entire app state

### UI Views

The app uses a single-page layout with smooth scrolling between sections:
- **Today**: Main fact card, generate button, Wikipedia link previews
- **Settings**: Country tag input with autocomplete, save/reset buttons
- **History Panel**: Slide-in sidebar (toggle via nav button) showing all past facts

Navigation doesn't change URL or swap DOM sections; uses `scrollIntoView()` for UX.

## Working with This Codebase

### Modifying the LLM Model

Change the model in `app.js:20`:
```javascript
const OLLAMA_MODEL = 'gemma3:latest';  // Update to your preferred model
```

Ensure the model is pulled in Ollama before use:
```bash
docker exec ollama ollama pull <model-name>
```

### Adding Categories

Categories are hardcoded in `app.js:2-10`. To add a new category:
1. Append to the `CATEGORIES` array
2. Add corresponding fallback snippet to `fallbackGenerate()` (app.js:364-376)
3. No other changes needed—rotation logic handles dynamic arrays

### Customizing the Prompt

Modify `buildPrompt()` (app.js:360-362) to adjust tone, length, or factual requirements. The prompt significantly impacts output quality and link inclusion.

### Styling

The app uses:
- Tailwind CSS via CDN (utility classes in HTML)
- Custom CSS in `styles.css` for glass-morphism effects, animations, and tag input styling
- Inter font family loaded from Google Fonts

### Fallback Behavior

When Ollama is unavailable, the app uses deterministic fallback snippets (`fallbackGenerate()`). These are generic but allow the UI to be demoed without LLM setup. They do not include Wikipedia links.

## Deployment Considerations

- The app expects Ollama to be accessible at `http://localhost:11434` (hardcoded)
- For production, update the fetch URL in `callOllamaForFact()` to point to your Ollama instance
- No API keys or authentication required (fully local/containerized setup)
- Static files can be deployed to any web server; nginx is used here for convenience
