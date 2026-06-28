-- Fix: Kurs anlegen schlug mit "new row violates row-level security policy for
-- table kurs" fehl. Ursache: Der Client nutzt .insert().select() (= INSERT ...
-- RETURNING). Beim RETURNING prüft Postgres die SELECT-Policy auf der neuen Zeile.
-- Die Policy war nur `darf_kurs_lesen(id)` – diese SECURITY-DEFINER-Funktion fragt
-- die kurs-Tabelle ERNEUT ab, sieht die gerade eingefügte Zeile beim RETURNING aber
-- noch nicht -> Policy = false -> Fehler. (Im normalen SELECT danach ist sie sichtbar.)
--
-- kurs ist die einzige betroffene Tabelle, weil nur sie im SELECT-Check ihre EIGENE
-- Tabelle abfragt; alle anderen prüfen über den bereits existierenden Eltern-Kurs.
--
-- Fix: direkter Besitzer-Check auf der Zeile selbst (funktioniert beim RETURNING),
-- die Sharing-Logik bleibt als zweiter Zweig erhalten.
drop policy if exists kurs_select on public.kurs;
create policy kurs_select on public.kurs
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.darf_kurs_lesen(id));
