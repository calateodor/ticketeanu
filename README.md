# Ticketeanu

Casa de bilete fără oameni: organizatorii își fac singuri pagina evenimentului, iar lumea rezervă de pe telefon, singură sau cu gașca.

## Pornire locală

```bash
npm install
copy .env.example .env.local
npm run db:push
npm run seed
npm run dev
```

Apoi: http://localhost:3000. Intră cu `demo@ticketeanu.ro`: în dezvoltare, codul de login apare direct pe ecran. E-mailurile trimise se văd la `/dev/emails`. Plata este simulată (`PAYMENT_PROVIDER=demo`).

Strategia și regulile de produs: `docs/strategie-ticketeanu.md`. Notele pentru Claude Code: `CLAUDE.md`.
