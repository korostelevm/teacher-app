# Supabase Setup (Optional)

If using Supabase with pgvector for vector storage:

## Local Development

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Start local Supabase
supabase start

# Create migration for vector extension
supabase migration new enable_pgvector
```

## Migration Example

See Supabase docs for pgvector setup:
https://supabase.com/docs/guides/ai/vector-columns

## Connection

Use environment variables from `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`