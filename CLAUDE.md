@AGENTS.md

# Ticketeanu

Platformă de bilete și rezervări pentru petreceri, concerte și evenimente (România). Strategia aprobată: `docs/strategie-ticketeanu.md` (citește-o înainte de orice decizie de produs). Cercetarea de piață, cu surse: `reports/` și `research_notes/`. Referințele vizuale (biletul gradient, layoutul cu titluri condensate): `Look/`.

## Reguli de produs (din strategie)

- Totul self-service: niciun flux nu are voie să ceară un om de la Ticketeanu per eveniment.
- Prețul afișat cumpărătorului este prețul plătit; comisionul apare de la primul ecran.
- Banii intră deocamdată în contul firmei (model de mandatar); registrul `ledger_entries` ține soldul fiecărui organizator.
- Testul pentru funcții noi: o folosește organizatorul singur? aduce bani sau umple locuri? merge fără muncă manuală?

## Stack și comenzi

Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4, Drizzle ORM + libSQL (SQLite local în `data/ticketeanu.db`; Turso sau fișier pe server în producție), Leaflet + OpenStreetMap pentru hărți.

```bash
npm run dev          # http://localhost:3000
npm run dev:https    # https://<IP din rețea>:3001, pentru telefon (înclinarea biletului cere https); certificat local în certificates/, vezi scripts/dev-https.mjs
npm run db:push      # aplică schema (src/db/schema.ts) pe baza locală (fără TTY: npx drizzle-kit push --force)
npm run seed         # organizator demo (demo@ticketeanu.ro), 3 locuri, 5 evenimente; se poate rula de mai multe ori
npm run typecheck    # tsc --noEmit (rulează `npx next typegen` înainte, pentru PageProps)
npm run lint
```

Variabile: copiază `.env.example` în `.env.local`. Fără `RESEND_API_KEY`, e-mailurile rămân în outbox și se văd la `/dev/emails`; codul de login apare pe ecran în dev. `PAYMENT_PROVIDER=demo` = plată simulată la `/plata-demo/...`. `GEOCODE_CONTACT` (opțional) e e-mailul din User-Agent-ul către Nominatim.

## Look-ul (paginile publice)

Direcția completă: `docs/directie-vizuala.md` (citește-o înainte de orice schimbare vizuală).

- **Site-ul public e pentru cei care ies în oraș**, nu pentru organizatori. Prima pagină (`src/app/page.tsx`): hero cu imprimanta care tipărește biletul celui mai cerut eveniment, „Unde ieși” (file Diseară/Mâine/Weekend, `when-rail.tsx`), „Fierbe acum”, „Ce vibe ai?”, reduceri, trei pași, gașca, final, apoi o singură bandă către `/organizatori` (pagina organizatorilor: cum merge, funcții, calculatorul de comision).
- Antet și subsol comune: `src/components/site/site-header.tsx`, `site-footer.tsx`. „Slide-urile” din referință: `.slide` (violet → roz → portocaliu) și `.slide-deep`.
- Titluri mari: `<SplitWords>` + `data-split` (cuvintele urcă din mască; textul întreg rămâne în `sr-only`). Gradient pe text într-un titlu despărțit: `wordClassName="text-sunset"`, nu pe container.
- Scroll lin: Lenis (`smooth-scroll.tsx`), singurul motor, doar pe prima pagină și `/organizatori`; harta și rezervarea rămân pe scroll nativ.
- Build de verificare fără să oprești serverele de dev: `NEXT_DIST_DIR=.next-build npx next build`.

- O singură pânză de noapte (`.night`, `#120A1F`), gradientul **fix** al site-ului (`.sunset`: flacără → neon → violet → violet adânc; nu depinde de eveniment), granulație de film (`.grain`, `.grain-strong`), sticlă (`.glass`), titluri condensate (`.headline`), etichete mono (`.eyebrow`), text pe gradient (`.text-sunset`), lămâie (`bg-lime`) pentru reduceri. Culoarea organizatorului (`--accent`) apare doar pe butonul de rezervare, bara de jos și cipuri.
- Biletul (`src/components/ticket/ticket.tsx`, clasele `.tk-*` din `globals.css`): formă cu zimți, afișul **color, neatins** pe fundal, granulație grunjoasă abia simțită (`.tk-grain-rest`), iar o bandă diagonală mutată de înclinarea telefonului (`motion.ts`) sau de cursor aprinde doar firele de granulație, irizat (`.tk-grain-lit`). Biletul se înclină cel mult 6°. Pe telefon apare sub bilet butonul „Mișcă telefonul…” până sosesc date de înclinare (iPhone cere permisiune; totul merge doar pe https). Iese din aparat (`TicketMachine` + `.ticket-out`). `theme.ticketCover` pune afișul pe bilet.
- Mișcare: `src/components/motion/reveals.tsx` (GSAP + ScrollTrigger **doar ca declanșator**, `once`, fără `scrub`, fără `pin`; nimic nu mută scrollul). Marcaje: `data-hero-root` (secțiunea de intrare), `data-hero` (secvența de intrare), `data-split` (titlu cuvânt cu cuvânt), `data-reveal` (intră la scroll, o dată). Nu pune `data-reveal` pe elemente care se re-randează din filtre.
- Imprimanta de bilete: `TicketMachine` + `.ticket-print` (11 avansuri cu pauze în 3,2 s, carcasa vibrează, LED, linia capului de tipărire), toate în CSS, `--print` / `--print-delay`.
- Panoul organizatorului rămâne luminos și curat; nu-l trece pe gradient.

## Convenții

- Bani: întregi, în bani (1 leu = 100). Formatare doar la afișare (`formatLei`).
- Date: `integer({ mode: "timestamp_ms" })`; formatare în ora României (`src/lib/dates.ts`); `nowMs()` în componentele server (regula de puritate a ESLint); pe client, `useNow()` din `src/lib/use-now.ts` (fără setState în efecte).
- UI în română, cu diacritice; copy direct, la persoana a II-a singular.
- Modulele din `src/lib` cu `import "server-only"` nu pot fi importate din scripturi (`scripts/seed.ts` folosește doar `db`, `schema`, `ids`) și nici din componente client. Logica pură (`taxonomy.ts`, `discounts.ts`, `colors.ts`, `catalog-types.ts`) nu are `server-only`, ca să ruleze și pe client.
- Catalogul trece în componentele client ca `CatalogItem` (`src/lib/catalog-types.ts`, datele ca numere), prin `toCatalogItem`/`listCatalogItems` din `src/lib/catalog.ts`.
- Drizzle: într-un `select` pe o singură tabelă, coloanele nu sunt prefixate; subinterogările se scriu cu SQL explicit (`"events"."id"`, alias-uri).
- Componentele client se exportă individual (nu ca obiect) ca să poată fi importate din componente server.
- Efectele secundare (e-mail, procesator) rulează după commit, nu în interiorul tranzacției (`src/lib/orders.ts`).
- Leaflet doar pe client: se importă în `useEffect` (`import("leaflet")`); harta se creează o dată, pinurile se sincronizează în alt efect. Ref-urile nu se scriu în timpul randării (regula `react-hooks/refs`).
- Reducerile nu se cumulează: pe o comandă se aplică cea mai mare dintre reguli (`pickDiscount`) și codul promo. Reducerile pe categorii de oameni pun `discountNote` pe comandă; apare pe bilet și la scanare, ca omul de la ușă să ceară dovada.

## Structură

- `src/db/schema.ts` tot modelul (organizatori, locuri, evenimente cu categorie și vibe, tipuri de bilete cu preț tăiat, valuri de preț, comenzi, bilete, grupuri, plăți, registru, coduri promo, reduceri fără cod, PR, listă de așteptare, linkuri de scanare, e-mailuri).
- `src/lib/taxonomy.ts` categorii, vibe (hot/chill/mixt, ales de organizator) și „căldură” (`heatLevel`, calculată din locurile luate în ultimele 48 h și din gradul de ocupare).
- `src/lib/catalog.ts` catalogul public cu loc, reduceri și căldură; `geocode.ts` căutare de adrese (Nominatim, prin `/api/geocode`, doar pentru organizatori logați).
- `src/lib/orders.ts` crearea comenzii (listă), confirmare, anulare + rambursare, expirări; `availability.ts` locuri ocupate; `discounts.ts`; `waitlist.ts`; `checkin.ts`; `scheduler.ts` (cron: expirări, oferte, remindere).
- `src/app/evenimente` harta + filtre (categorie, vibe, reduceri, oraș, „lângă mine”); `/loc/[slug]` pagina locului; `/e/[slug]` pagina publică; `/g/[code]` gașca; `/comanda/[token]` biletele cumpărătorului; `/bilet/[code]`; `/scan/[token]` scanare; `/panou/...` organizator (tab-ul „Reduceri”: preț tăiat, reguli, coduri publice); `/o/[slug]` organizator public.

## Neterminat (vezi strategia, versiunile 2 și 3)

Procesator real de plăți (doar `demo`), viramente automate, facturi de comision, hârtii fiscale (impozit pe spectacole), hărți de săli și de mese, promovare plătită și comision de piață, mesaje către foști participanți, lista de dinaintea vânzării, reclame din platformă, asistent AI. Pagină de administrare a locurilor salvate (acum se creează din formularul evenimentului). Furnizor de dale cu cheie pentru producție (dalele OSM standard sunt pentru trafic mic).
