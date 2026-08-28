# Migración de infraestructura de finanzas-hacku — Plan de Implementación (Runbook)

**Spec:** 001-migracion-vercel-jeremy-a-producto/spec.md
**Created:** 2026-08-25
**Status:** Draft

> Este "plan" es un **runbook de operaciones**, no un plan de código. El código de la app no cambia.
> El orden importa: cada fase depende de la anterior para no perder acceso ni causar downtime.

---

## 1. Technical Context

| Aspect | Decision |
|--------|----------|
| Plataforma de deploy | Vercel (equipo `hacku-finanzas` → equipo corporativo `producto@hacku.co`) |
| Proyecto | `finanzas-hacku` (`prj_pz0dm69AcMsQFZ7wvfAddwBrbtJw`), Node 24.x |
| Origen (Vercel) | `team_mYwxPYUBZ1PvHFBcDBiIpVSo` — cuenta personal de Jeremy, plan Hobby |
| Repo Git | GitHub `johacku/finanzas-hacku` (público) → org corporativa de hackÜ |
| Notificaciones | Slack App "hackU Finance Notifications" (token revocado) |
| Integraciones | Alegra (webhook + API), Supabase, Google Sheets, Crons (`CRON_SECRET`) |
| Herramientas | Vercel Dashboard + `vercel` CLI + Vercel REST API; GitHub UI/CLI; Slack admin |
| Acceso disponible | Correo `jeremy@hacku.co` ✅; GitHub `johacku` ⏳ (por solicitar); login Vercel de Jeremy ❓ |

## 2. Constitution Compliance

> No existe `specs/constitution.md`. N/A.

## 3. Architecture Decisions

### ADR-1: Transferencia oficial vs. recrear el proyecto de Vercel
- **Context:** El proyecto está en la cuenta personal de Jeremy; solo tenemos su correo.
- **Options considered:**
  - A: **Transferencia oficial** — Vercel soporta transferir un proyecto entre equipos (`POST /projects/:id/transfer-request` → `PUT /projects/transfer-request/:code`). Requiere autenticarse como owner del equipo origen (Jeremy) para iniciar. Preserva proyecto, config y (según Vercel) stores/integraciones. — *Limpio, pero depende de acceder como Jeremy.*
  - B: **Recrear desde el repo** — Crear proyecto nuevo en el equipo de `producto@hacku.co`, conectar el repo, recrear variables de entorno a mano, reapuntar dominio/webhook. — *No depende del login de Jeremy en Vercel, pero exige recrear secretos y arriesga el subdominio.*
- **Decision:** Intentar **A primero**; si no se consigue acceso al login de Vercel de Jeremy en un plazo corto, ejecutar **B**. Preparar el inventario de variables de entorno de una vez, porque B lo necesita y A se beneficia de tenerlo como respaldo.
- **Rationale:** A preserva el subdominio y evita reapuntar Alegra; B es el fallback que no queda bloqueado por el 2FA de Jeremy.

### ADR-2: Transferencia de repo GitHub vs. mirror
- **Context:** El repo está en `johacku` (personal). Acceso pendiente.
- **Options considered:**
  - A: **GitHub Transfer** (Settings → Transfer ownership) a la org — preserva issues, PRs, stars, historia y redirecciones automáticas. Requiere acceso admin a `johacku`.
  - B: **Mirror push** — `git clone --mirror` + crear repo vacío en la org + `git push --mirror`. Preserva ramas/tags/commits pero **no** issues/PRs. Solo requiere permiso de lectura del repo (o que sea público, que lo es).
- **Decision:** A si obtenemos acceso a `johacku`; B como fallback (viable hoy porque el repo es público).
- **Rationale:** A es superior (mantiene metadatos y redirecciones); B garantiza que el código se rescata sin depender de Jeremy.

### ADR-3: Identidad que instala la Slack App
- **Context:** El token se revocó porque lo instaló una persona (Jeremy) que dejó el workspace.
- **Decision:** Reinstalar la app con una **cuenta de servicio corporativa** (o al menos `producto@hacku.co`), no una cuenta personal.
- **Rationale:** Evita que una futura baja de personal vuelva a revocar el token (root cause del incidente actual).

### ADR-4: Preservar `CRON_SECRET` y valores de integración vs. rotarlos
- **Context:** Copiar los secretos tal cual minimiza reconfiguración externa; rotarlos es más seguro dado que Jeremy pudo conocerlos.
- **Decision:** **Preservar** en el primer corte para lograr continuidad; **rotar** en una segunda pasada controlada (FR-012), reconfigurando el consumidor externo de cada secreto rotado.
- **Rationale:** Separar "continuidad" de "hardening" reduce el riesgo de romper todo a la vez. Slack es la excepción: se rota sí o sí (ya está revocado).

## 4. Componentes a migrar (inventario, no archivos de código)

```
Vercel:
  - Proyecto finanzas-hacku (prj_pz0dm69AcMsQFZ7wvfAddwBrbtJw)
  - Variables de entorno (producción/preview/dev)
  - Dominio finanzas-hacku.vercel.app + aliases
  - Crons definidos en vercel.json (repo)
  - Deployment Protection / settings

GitHub:
  - Repo johacku/finanzas-hacku → ORG_HACKU/finanzas-hacku
  - Integración GitHub App de Vercel (reconectar)

Slack:
  - App "hackU Finance Notifications" (reinstalar + nuevo token)

Externos que apuntan a la app:
  - Alegra: URL del webhook /api/alegra-webhook
  - (revisar) callbacks de Google Sheets / Apps Script
```

## 5. Implementation Phases

### Phase 0: Inventario, accesos y preparación (BLOQUEA TODO)
- Confirmar/crear cuenta corporativa en Vercel (`producto@hacku.co`) y en GitHub (org).
- Solicitar y confirmar acceso admin a GitHub `johacku` (define ruta A vs B del repo).
- **Exportar el inventario completo de variables de entorno** del proyecto actual (`vercel env pull` o dashboard) y guardarlo en un vault seguro. Este inventario es el seguro de vida de toda la migración.
- Inventariar: dominios/aliases, crons (`vercel.json`), URL actual del webhook en Alegra, dueños reales de Alegra/Supabase/Google.
- Resolver los `[NEEDS CLARIFICATION]` de la spec.

### Phase 1: Rescate del código (GitHub)
- Ruta A (con acceso a `johacku`): Transfer ownership del repo a la org.
- Ruta B (fallback): `git clone --mirror` + repo nuevo en la org + `git push --mirror`.
- Verificar que la org tiene el repo con toda la historia y ramas.

### Phase 2: Propiedad de Vercel
- Ruta A (con login de Jeremy o soporte Vercel): iniciar transfer-request del proyecto al equipo corporativo; aceptar desde `producto@hacku.co`.
- Ruta B (fallback): crear proyecto nuevo en el equipo corporativo desde el repo migrado; recrear variables de entorno desde el inventario de Phase 0.
- Verificar dominio y que un deploy de producción quede READY.

### Phase 3: Reconexión del pipeline y las integraciones
- Reconectar la integración Git de Vercel al repo de la org.
- Reinstalar la Slack App con identidad corporativa → nuevo `SLACK_BOT_TOKEN` → actualizar en Vercel → redeploy.
- Verificar/actualizar la URL del webhook en Alegra si el dominio cambió.
- Confirmar que los crons quedan agendados y protegidos por `CRON_SECRET`.

### Phase 4: Verificación end-to-end
- Smoke tests: solicitud de factura → notificación Slack OK; `/api/alegra-webhook` 200; query Supabase OK; cron dispara.
- Push de prueba a `main` → deploy de prod exitoso.

### Phase 5: Revocación de Jeremy y hardening
- Quitar a Jeremy de Vercel, GitHub, Slack; revocar sus tokens.
- Rotar secretos sensibles según matriz (FR-012), reconfigurando cada consumidor externo.
- Documentar el nuevo mapa de propiedad y accesos de respaldo.

## 6. Complexity Check

| Component | Complexity | Justification |
|-----------|-----------|---------------|
| Transferencia Vercel (ruta A) | Medium | Depende de acceso al owner (Jeremy); puede requerir soporte de Vercel |
| Recreación Vercel (ruta B) | Medium | Recrear N variables de entorno sin error; riesgo de cambio de subdominio |
| Transferencia GitHub | Simple | Operación estándar; fallback mirror trivial por ser repo público |
| Reinstalación Slack | Simple | Reinstall + copiar token + redeploy |
| Reapuntar Alegra | Simple | Solo si cambia el dominio; un cambio de URL |
| Rotación de secretos | Medium | Cada rotación exige reconfigurar el consumidor externo; hacerlo uno por uno con verificación |

> Anti-complejidad: no se automatiza nada con scripts nuevos salvo el `vercel env pull/push`. Todo es operación puntual y verificada a mano.

## 7. Migration & Rollback

- **Deploy steps:** ver fases 0→5, en orden. No avanzar de fase sin verificar la anterior.
- **Rollback plan:**
  - Mientras no se elimine a Jeremy ni se rote un secreto, el sistema original sigue intacto → rollback = simplemente no continuar; el proyecto de Jeremy sigue sirviendo.
  - No ejecutar Phase 5 (revocación) hasta que Phase 4 (verificación E2E) pase al 100%.
  - Conservar el inventario de variables de entorno y el mirror del repo como respaldo permanente.
- **Data migration:** ninguna de base de datos en esta migración (salvo que Supabase resulte estar a nombre de Jeremy → nueva spec).

## 8. Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| No obtener acceso al login de Vercel de Jeremy | H | M | Preparar ruta B (recrear); escalar a soporte Vercel usando control del correo |
| No obtener acceso a GitHub `johacku` | H | M | Ruta B mirror (repo es público hoy) |
| Cambio de subdominio rompe el webhook de Alegra | H | M | Detectar cambio de dominio y reapuntar Alegra en Phase 3 antes de cerrar |
| Copiar mal una variable de entorno rompe una integración en silencio | M | M | Smoke test por integración en Phase 4 |
| Supabase/Alegra también a nombre de Jeremy | H | ? | Verificar dueños en Phase 0; si aplica, abrir spec adicional |
| Rotar un secreto sin reconfigurar el consumidor externo | M | M | Rotación uno-por-uno con verificación (Phase 5) |
| Pérdida de eventos de Alegra durante el corte | M | L | Ventana de baja actividad; webhook idempotente por diseño |
