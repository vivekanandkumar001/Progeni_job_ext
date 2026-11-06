# Progeni AutoApply Backend

The Express API serves the local candidate workspace in development and the authenticated MongoDB-backed workspace in production.

## Local development

Use Node.js 20.19 or newer:

```powershell
npm ci
npm run dev
```

In local development, the API binds to `127.0.0.1:5000`. Candidate data is stored in `%LOCALAPPDATA%\ProgeniAutoApply\candidate-data.json`. No Supabase account is required for the local candidate MVP.

Build and run:

```powershell
npm run build
npm start
```

## API modes

- Local development exposes `/api/v1/local`, uses a local JWT session, and stores data in `%LOCALAPPDATA%\ProgeniAutoApply\candidate-data.json`. It binds to `127.0.0.1`; never expose this route or data file publicly.
- Production exposes `/api/v1/workspace`, verifies Supabase access tokens, requires the candidate role on candidate endpoints, and stores each candidate's workspace in MongoDB keyed by the verified Supabase user ID. All profile, resume evidence, job, match, consent, and tracker operations are user-scoped.
- `/health` pings MongoDB in production before reporting healthy.

## Vercel + MongoDB Atlas production setup

The Express app uses MongoDB Atlas for workspace data and Supabase Auth to verify user access tokens. Configure the environment variables before routing production traffic to it.

1. Use a dedicated Atlas cluster with backups and monitoring before a public launch. The M0 tier is intended for development and evaluation, not hundreds of concurrent users.
2. Create a least-privilege MongoDB database user and allow the Vercel Function's outbound network access in Atlas. Vercel Hobby uses dynamic outbound IPs and does not include Static IPs. For this deployment, the selected Hobby-plan workaround is Atlas `0.0.0.0/0`; this allows connection attempts from any IP, so use a dedicated database user with only the required database permissions, a strong unique password, and never an Atlas project-owner credential. Replace this allowlist with static egress when available.
3. Import the repository into Vercel as one project using the repository root as the project root. The root `vercel.json` declares the `backend`, `web-dashboard`, `admin-panel`, and `chrome-extension` services. Vercel Services is currently Beta.
4. Configure these environment variables for Production (and Preview if used):
   - `MONGODB_URI` (the connection string is a secret; configure it in Vercel, not source control; percent-encode special characters in the database password)
   - `MONGODB_DB` (defaults to `progeni_autoapply`)
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `CORS_ALLOWED_ORIGINS` as a comma-separated list of exact origins, for example `https://job.progeni.live,chrome-extension://<published-extension-id>`. Replace the placeholder with the stable ID issued for the Chrome Web Store listing; do not use a wildcard.
   - `NODE_PATH=backend/node_modules` when the Vercel project uses the repository root and its multi-service configuration; it lets the generated backend function resolve dependencies installed under the `backend` service root. Do not set this when deploying this backend branch as the project root.
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for the dashboard; the extension build uses those public values as its Supabase client configuration.
5. Assign the `admin` role through Supabase `app_metadata` only. Users cannot grant themselves an admin role through editable user metadata.
6. Route `/api/v1/*` and `/health` to the backend service and the remaining public routes to `web-dashboard`. Keep the admin panel and extension build service internal. No service binding is used because browser clients call the public API route; there is no server-to-server service call.
7. Attach `job.progeni.live` to the Vercel project, then verify `GET https://job.progeni.live/health` returns `{"status":"ok","message":"Auto Apply Backend Running"}`.

The API verifies Supabase access tokens and scopes candidate data by authenticated user ID. The MongoDB client is cached across warm Vercel invocations; its small per-instance pool is chosen to limit connection growth when Functions scale out. Each cloud workspace has bounded history to avoid MongoDB's document-size limit. Monitor Atlas connections, query latency, and Vercel function concurrency before changing pool settings. The local JSON endpoints are mounted only in local development.

No SQL migration is required. The API creates the indexes used by its production data services the first time each warm Vercel instance connects to MongoDB.
