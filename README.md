# travel inspo

Vibe-coded LLM app for travel inspiration.

Spin up with:

```bash
docker compose up -d
```

Runs on `http://localhost:8080`

## Unit Testing

This project includes unit tests using [Vitest](https://vitest.dev/), a modern and fast JavaScript testing framework.

### Setup Testing Environment

Install dependencies:

```bash
npm install
```

### Running Tests

Run all tests once:

```bash
npm test
```

Run tests in watch mode (auto-rerun on file changes):

```bash
npm run test:watch
```

Run tests with coverage report:

```bash
npm run test:coverage
```

### Test Files

- `webapp/utils.js` - Utility functions extracted for testing
- `webapp/utils.test.js` - Unit tests with examples

### What's Being Tested

The test suite includes examples for:
- **HTML escaping** - Preventing XSS vulnerabilities
- **Wikipedia URL parsing** - Extracting article titles
- **Markdown rendering** - Converting markdown to HTML
- **Category selection logic** - Avoiding repetition
- **Country picking logic** - Random selection with constraints
- **Input validation** - Ensuring valid country selections

Each test demonstrates different testing patterns:
- Pure function testing
- Edge case handling
- Error handling
- Randomness testing with multiple iterations
- Input validation

### Continuous Integration

Tests run automatically on every pull request via GitHub Actions. The workflow:
- Runs all tests with `npm test`
- Generates coverage reports with `npm run test:coverage`
- Uploads coverage artifacts for review

See `.github/workflows/test.yml` for the complete CI configuration.
