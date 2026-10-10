# Sift

Sift is a personal notes app. It imports your Google Keep notes (from a Google Takeout export) and shows them as a dated stream. It links notes by topic and by text similarity on an interactive map, and syncs their to-dos both ways with your Weekly Focus planner. Private notes stay in a PIN-locked vault. Collage mode and manual highlights let you find what your notes say about something you are writing. It is a PWA built with Vite, React and Supabase, and it also runs local-only, with no sign-in and data kept in the browser.

**Live:** https://celeritas7.github.io/Sift/

## Run it

```bash
npm install
cp .env.example .env   # add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or leave empty for local-only mode
npm run dev
```

After pulling, run any new files in [`supabase/migrations/`](supabase/migrations/) in the Supabase SQL editor.

## Docs

- [Setup](docs/SETUP.md): Supabase, Google sign-in, environment, project structure
- [Spec](docs/SPEC.md): product and design handoff
- [Collage mode](docs/COLLAGE.md): Collage spec
- [Prototypes](docs/prototype/): HTML design references (not shipped)
