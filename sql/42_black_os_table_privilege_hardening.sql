-- Black OS · privilegios mínimos de tablas públicas
-- RLS controla SELECT/INSERT/UPDATE/DELETE. Los clientes web no necesitan
-- TRUNCATE, TRIGGER ni REFERENCES sobre tablas del esquema public.

revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

alter default privileges in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;
