# 1. Force stop everything
supabase stop

# 2. Prune Docker volumes (This clears "ghost" data that causes 502s)
docker system prune -f

# 3. Start fresh
supabase start
