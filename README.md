# preview-example-frontend

Small MIT-licensed Vite + React + TypeScript example for preview-hub. It lists
synthetic notes from `GET /api/notes`, creates one with `POST /api/notes` and a
JSON `{ "text": "..." }` body, then reloads the list. The list response is an array
of `{ "id": 1, "text": "..." }` objects. API failures appear on the page.

## Local development

Use Node 22 and npm. Install `jq` to run the container-entrypoint tests
(`brew install jq` on macOS or `apt-get install jq` on Debian/Ubuntu).

```sh
npm ci
npm run dev
```

Open the Vite URL (normally http://localhost:5173). Start the example backend on
http://localhost:8000 and allow the frontend origin in its CORS configuration.
Only use synthetic data.

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

## Runtime configuration and container

`index.html` loads `/config.js` before the app. The app reads
`window.__APP_CONFIG__.apiUrl`; missing or empty local configuration falls back to
`http://localhost:8000`. For a different local backend, edit `public/config.js`.
There is no build-time API URL or Vite environment variable.

```sh
docker build -t preview-example-frontend .
docker run --rm -p 8080:8080 -e API_URL=http://localhost:8000 preview-example-frontend
```

The multi-stage image builds with Node 22 and serves with nginx as the non-root
`nginx` user on port 8080. At each start, the entrypoint requires `API_URL`, uses
`jq` to serialize it safely into `config.js`, and execs nginx. Use a URL reachable
from the browser, not a Docker-only service hostname. Configuration is served
with `Cache-Control: no-store`; SPA routes fall back to `index.html`.

## QA scenarios

`qa/scenarios.yaml` contains the `ai-qa/v1` browser scenarios for checking seed
notes and adding a note. ai-qa consumes this file from the frontend commit pinned
by the environment, so checks use the scenarios belonging to that deployed version.
The add-note scenario is tagged `smoke` and creates a synthetic note containing
the current time to distinguish it from earlier runs.

Backend evidence: `cafitac/preview-example-backend` at commit
`544fd35e612f9751547e650f50ab0a5f1d5b1567`: `app/main.py`'s `list_notes` uses
`select(Note).order_by(Note.created_at.desc(), Note.id.desc())`; `app/seed.py`
seeds "Welcome to preview-hub!" and "Try adding a note.". The frontend preserves
API order, so add-note expects the new note first.

The format's schema is vendored at `qa/scenario-file.schema.json`; source commit
and SHA-256 are recorded in `qa/VENDORED.md`. `tests/scenarios.test.mjs` checks
this fixture with strict YAML parsing and JSON Schema validation using `yaml` and
`ajv`, plus unique scenario ids and the vendored schema's SHA-256.
These scenarios are written for the example backend and must be updated if its
ordering or seeds change.

## preview.yaml

The C1 manifest declares service `frontend`, port `8080`, public subdomain `app`,
and HTTP health check `/`. It requires `backend` and injects
`API_URL=${services.backend.public_url}` at container start, so one built image
can serve different preview environments. Frontend health checks static serving;
the page reports backend connectivity separately.

CI runs install, lint, strict typechecking, tests, production build, and Docker
build on pull requests and pushes to `main`.
