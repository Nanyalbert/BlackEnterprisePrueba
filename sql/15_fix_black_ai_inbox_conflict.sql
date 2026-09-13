-- Corrige el índice usado por ON CONFLICT(provider,message_id)
-- PostgreSQL permite múltiples NULL en un índice UNIQUE, por lo que no necesitamos índice parcial.

drop index if exists public.black_ai_inbox_provider_message_uidx;

create unique index black_ai_inbox_provider_message_uidx
  on public.black_ai_inbox(provider, message_id);
