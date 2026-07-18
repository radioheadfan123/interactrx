# InteractRx

A medication interaction checker. You search for drugs (brand or generic, doesn't matter, RxNorm normalizes everything), build up a med list, and it screens every pair for interactions. Results come back with a severity level and an actual explanation in plain English instead of raw API output. It also flags controlled substances with their DEA schedule, narrow therapeutic index drugs, REMS programs, and shows the kind of counseling points a pharmacist would go over at pickup.

One thing worth knowing upfront. RxNav used to have a drug interaction API and it got shut down in January 2024, so the interaction screening here runs on a dataset I curated by hand. About 45 rules covering the interactions that actually matter clinically: anticoagulants with NSAIDs, serotonergic stacking, the CYP3A4 statin problems, opioid plus benzo (that one's an FDA boxed warning), QT prolongation stacking, grapefruit, St. John's Wort, enzyme inducers quietly defeating birth control, stuff like that. Rules expand across drug classes so one warfarin/NSAID rule catches ibuprofen, naproxen, ketorolac and friends. RxNorm itself is still alive and is used live for search and brand-to-generic resolution.

Is 45 rules exhaustive? No, and the app says so in the UI. Commercial databases have tens of thousands of pairs. This covers the famous ones and is honest about the gap.

## Running it locally

Backend first:

    cd server && npm install && npm start

That's port 3001. Then in another terminal:

    cd client && npm install && npm run dev

Vite serves on 5173 and proxies /api calls to the backend, so no config needed for local dev.

## Tests

    cd server && npm test
    cd client && npm test

34 on the backend (interaction rules, flags, dosage logic, plus API tests with the upstream calls mocked) and 7 component tests on the frontend that walk through real user flows, keyboard nav included. There's a GitHub Actions workflow that runs both suites and the frontend build on every push.

## Deploying

Backend goes on Railway or Render. Point it at the `server` directory, start command is `npm start`, PORT gets picked up automatically. Once the frontend is deployed, set CORS_ORIGIN to its URL.

Frontend goes on Vercel or Netlify. Root directory `client`, framework Vite, and set VITE_API_URL to wherever the backend landed (no trailing slash).

There's no database yet on purpose. Med lists live in localStorage which is honestly fine for v1. If accounts across devices become a thing, the path is Supabase auth plus a med_lists table, and the only code that changes is the localStorage read/write in App.jsx since the data shape is already just `[{rxcui, name}]`.

## API

    GET  /api/search?q=lipitor
    POST /api/interactions        body: { drugs: [{rxcui, name}] }
    GET  /api/dose?name=ibuprofen&daily=4800
    GET  /api/label?name=metformin
    GET  /api/health

Search hits RxNorm and filters to clean term types so you get "atorvastatin" and "Lipitor" in the dropdown, not seventeen dose-form variants. It also injects grapefruit, alcohol, and St. John's Wort as searchable entries since those interact with plenty of drugs but obviously aren't in a prescription database. The interactions endpoint resolves each drug to its ingredients before checking, which is why adding Xarelto and Advil still catches the rivaroxaban/ibuprofen bleed risk. The dose endpoint is a sanity check against typical adult maximums for about 40 common drugs, with caveats where a flat max is misleading (warfarin dosing is INR-driven, opioid ceilings depend on tolerance, etc). The label endpoint pulls from openFDA and parses the adverse reactions prose into a short list of common side effects instead of dumping a wall of text.

## Disclaimer

This is an educational tool, not medical advice, and the screening dataset is deliberately not exhaustive. A pharmacist looking at an actual med list will always beat this.
