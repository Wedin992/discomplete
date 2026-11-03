# Discomplete – instruktioner för Claude

Läs `docs/DOCUMENTATION.md` först. Där beskrivs hela appen: funktioner, trösklar, datamodell, integrationer, beslut och ändringslogg.

## Kommunikation
- Appens gränssnitt är på engelska. Svara Kevin på svenska.
- Kevin kör SQL-migreringar själv i Supabase → SQL Editor. Ge honom SQL-koden i chatten.
- Be aldrig om och visa aldrig hemliga nycklar (DeepL, Last.fm secret, Supabase service role, Spotify, Resend). Kevin lägger in dem i Vercel.
- Privata anteckningar får aldrig skickas till DeepL.

## Regel: dokumentera varje ändring (obligatoriskt)
Varje gång något läggs till, ändras eller tas bort i appen, i samma arbetspass och före eller i samma commit:
1. Uppdatera `docs/DOCUMENTATION.md`:
   - rätt avsnitt
   - datamodell, miljövariabler, beslut och uppskjutet vid behov
   - en rad i ändringsloggen
   - "Senast uppdaterad", "Guideversion" och "Senaste migrering" överst
2. Ladda upp filen till Claude-projektet "Discomplete" som `claude/discomplete-dokumentation.md`, med Projects `project_write` och `local_path: docs/DOCUMENTATION.md`. Om Projects-verktyget saknas i sessionen: säg det till Kevin.
3. Lägg till en ny version överst i `REVISIONS` i `src/app/settings/guide/content.ts` (svenska) och uppdatera berörda sektioner i guiden.
4. Ny migrering: numrera nästa fil i `supabase/migrations/` och lägg till den i README:s setup-lista och i tabellen i dokumentationens kapitel 5.
5. Committa och pusha allt tillsammans.

## Arbetssätt
- Typkontroll: `./node_modules/.bin/tsc --noEmit -p .`
- Commit:
  - `git -c user.name="Kevin Wedin" -c user.email="kevin.wedin@ci.se" commit …`
  - pusha sedan med `git push -q origin main` (Vercel deployar automatiskt)
- Koden ska klara sig snällt om en migrering inte är körd än.
