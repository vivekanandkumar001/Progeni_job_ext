# Progeni AutoApply Backend

The Express API supports the local candidate dashboard and Chrome extension.

## Local development

Use Node.js 20.16+ or 22.3+:

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

The candidate API at `/api/v1/local` is enabled only in local development. Do not expose it or the JSON data file to the internet. This backend is not configured as a production service: public operation requires production authentication, durable access-controlled storage, deployment-specific CORS configuration, and a production API URL in the dashboard and extension.
