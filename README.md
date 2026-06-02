# ClasseHub MVP

MVP de consulta d'informació important per classe: important aquesta setmana, esdeveniments, tasques, votacions i organitzacions.

## Desenvolupament

```bash
npm install
cp .env.example .env
npm run dev
```

## Rutes

- `/classe/orenetes`
- `/classe/senglars`

## Supabase

1. Crea un projecte Supabase.
2. Executa `supabase-schema.sql` al SQL Editor.
3. Posa `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY` al `.env`.
