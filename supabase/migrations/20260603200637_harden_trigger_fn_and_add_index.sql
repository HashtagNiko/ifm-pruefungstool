-- handle_new_trainer ist nur fuer den Trigger gedacht, nicht als RPC erreichbar.
revoke execute on function public.handle_new_trainer() from public, anon, authenticated;

-- Fehlenden FK-Index ergaenzen (Advisor: unindexed foreign key)
create index pruefung_frage_themengebiet_id_idx on public.pruefung_frage (themengebiet_id);
