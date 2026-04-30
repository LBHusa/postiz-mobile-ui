# Phase 7: Hardening + Deployment

**Repos:** Beide.
**Coding-Team:** qa (lead) + backend + frontend + researcher
**Goal:** Mindest-Tests grün, ESLint-Fix, Container-Switch auf Server 77.

---

## Files-to-create / modify

### Frontend (postiz-husatech)
- ESLint-Workflow fixen (`.github/workflows/eslint.yml` sucht falsches `.eslintrc.json`)
- Frontend-Tests run gegen mock auth (Playwright auth.json setup)
- Build-Verifikation: `pnpm -w run build` läuft durch (Postiz original Behavior)

### Server-Agent (husatech-social-agent)
- Dockerfile (multistage Python build)
- docker-compose.yml für lokales Test
- README Deployment-Section
- Cron-Job für APScheduler im Container

### Server 77 Deployment
- SSH-Setup: nginx-Config für `agents.wawihub.de` (Server-Agent als Subpath oder Subdomain)
- Container-Replace auf socialmedia.wawihub.de:
  - Backup current Postiz container
  - Build new Husatech-Postiz container von feat/proposals merged main
  - Switch nginx-pointer
  - Verify with curl + manual mobile-test

---

## Acceptance-Kriterium

1. `pytest` in husatech-social-agent: alle Tests grün
2. `pnpm -w run build` in postiz-husatech: erfolgreich  
3. ESLint läuft sauber im Postiz-Fork
4. Server 77: `socialmedia.wawihub.de/m/kalender` erreichbar mit neuem Husatech-Build
5. Server-Agent erreichbar an konfigurierter URL
6. Lukas-Manual-Tests-Liste fertig (USER-TEST-PLAN.md)
7. Telegram-Notification beim Cron-Run + bei Re-Gen-Erfolg/Fehler
8. Backup-Container Postiz-Original verfügbar für Rollback

---

## Out-of-Scope V1

- Mobile-Login-Page (Phase 2 deferred)
- Inline-Selection-Comments
- HTTPS-Cert-Management (assumes nginx + certbot already in place auf socialmedia.wawihub.de)
- iOS-Native-App (PWA reicht V1)

---

## Commit-Strategie

**husatech-social-agent:**
1. `chore(docker): add multistage Dockerfile + docker-compose.yml`
2. `docs: add deployment section to README`

**postiz-husatech:**
1. `chore(ci): fix ESLint workflow path`
2. `test(mobile): add Playwright auth-setup-helper`

**Server 77 (manual):**
- nginx-config + container-replace ist DevOps-Action by Lukas — wir liefern Doku in `DEPLOYMENT.md`
