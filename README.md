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

## preview.yaml

The C1 manifest declares service `frontend`, port `8080`, public subdomain `app`,
and HTTP health check `/`. It requires `backend` and injects
`API_URL=${services.backend.public_url}` at container start, so one built image
can serve different preview environments. Frontend health checks static serving;
the page reports backend connectivity separately.

CI runs install, lint, strict typechecking, tests, production build, and Docker
build on pull requests and pushes to `main`.

<!-- public preview E2E -->
