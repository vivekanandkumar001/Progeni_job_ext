# Progeni AutoApply Backend

The Express API supports the local candidate dashboard and Chrome extension.

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

## Deployment warning

The candidate API at `/api/v1/local` is enabled only in local development. Do not expose it or the JSON data file to the internet. Production code now supports Supabase Auth and MongoDB Atlas, but the live Vercel project is not ready until its credentials, network access, and allowed origins are configured.

## Vercel + MongoDB Atlas production setup

The Express app uses MongoDB Atlas for application data and Supabase Auth only to verify user access tokens. Production traffic remains disabled until both providers are configured.

1. Use a dedicated Atlas cluster before a public launch. The current M0 tier is intended for development and evaluation, not the expected hundreds of concurrent users.
2. Create a least-privilege MongoDB database user and allow the Vercel Function's outbound network access in Atlas. Vercel Hobby uses dynamic outbound IPs and does not include Static IPs. For this deployment, the selected Hobby-plan workaround is Atlas `0.0.0.0/0`; this allows connection attempts from any IP, so use a dedicated database user with only the required database permissions, a strong unique password, and never an Atlas project-owner credential. Replace this allowlist with static egress when available.
3. In Vercel project `backend`, configure these environment variables for Production (and Preview if used):
   - `MONGODB_URI` (the connection string is a secret; configure it in Vercel, not source control; percent-encode special characters in the database password)
   - `MONGODB_DB` (defaults to `progeni_autoapply`)
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `CORS_ALLOWED_ORIGINS` as a comma-separated list of exact origins, such as `https://job.progeni.live,chrome-extension://<published-extension-id>`.
4. Assign the `admin` role through Supabase `app_metadata` only. Users cannot grant themselves an admin role through editable user metadata.
5. Deploy and verify `GET /health` returns `{"status":"ok","message":"Auto Apply Backend Running"}`. In production, this endpoint pings MongoDB before reporting success.

The API verifies Supabase access tokens and scopes candidate data by authenticated user ID. The MongoDB client is cached across warm Vercel invocations; its small per-instance pool is chosen to limit connection growth when Functions scale out. Monitor Atlas connections, query latency, and Vercel function concurrency before changing pool settings. The local JSON endpoints are only mounted in local development. The current web dashboard still uses those local endpoints and does not yet have a Supabase sign-in flow, so do not point it at this production API until that frontend integration is complete.

No SQL migration is required. The API creates the indexes used by its queries the first time each warm Vercel instance connects to MongoDB.
