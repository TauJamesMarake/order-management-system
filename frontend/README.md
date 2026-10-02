# Frontend

React and TypeScript client bundled with Parcel.

## Local development

Create `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `VITE_API_URL` is optional and defaults to `http://localhost:5000/api` during development.

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`.

## Production

Run `npm run build` and deploy the generated `dist/` directory. Configure the host to rewrite unknown paths to `/index.html` for client-side routing. Set the Supabase values and optional `VITE_API_URL` at build time; production defaults the API URL to `/api`.