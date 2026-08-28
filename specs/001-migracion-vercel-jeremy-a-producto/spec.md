# Migración de infraestructura de finanzas-hacku fuera de las cuentas personales de Jeremy — Especificación

**ID:** 001-migracion-vercel-jeremy-a-producto
**Created:** 2026-08-25
**Status:** Clarification

> **Clarificaciones resueltas (2026-08-25):**
> - Org de GitHub destino = **`hacku-education`** (display "hackÜ", https://github.com/hacku-education). Verificada como org válida; 0 repos públicos hoy. El repo `finanzas-hacku` migra a `hacku-education/finanzas-hacku`.
>
> **Pendientes de confirmar (no bloquean Phase 0 salvo la de Alegra/Supabase):**
> - ¿`producto@hacku.co` ya tiene cuenta en Vercel? ¿Es admin de la org `hacku-education`?
> - Plan de Vercel destino: Hobby vs Pro.
> - 🚨 ¿Alegra y/o Supabase también están a nombre de Jeremy? (define si el alcance se amplía a una spec 002).
> - Identidad que reinstala la Slack App (cuenta de servicio vs `producto@hacku.co`).

---

## 1. Problem Statement

Jeremy (`jeremy@hacku.co`, GitHub `johacku`) ya no trabaja en hackÜ, pero **toda la infraestructura de producción del sistema financiero `finanzas-hacku` está anclada a sus cuentas personales**:

- **Vercel:** el proyecto `finanzas-hacku` (`prj_pz0dm69AcMsQFZ7wvfAddwBrbtJw`) vive en el equipo `hacku-finanzas` (`team_mYwxPYUBZ1PvHFBcDBiIpVSo`), que es la **cuenta personal de Jeremy en plan Hobby**. Todos los deployments tienen `creator: jeremy@hacku.co`.
- **GitHub:** el repositorio está en `johacku/finanzas-hacku` — cuenta **personal** de Jeremy. La integración Git de Vercel despliega desde ahí en cada push a `main`.
- **Slack:** la Slack App "hackU Finance Notifications" fue instalada por Jeremy. Su salida ya **revocó el `SLACK_BOT_TOKEN`** (error `token_revoked` observado en runtime hoy 2026-08-25), rompiendo las notificaciones de solicitud de factura.
- **Integraciones/secretos:** las variables de entorno de producción (Slack, Alegra, Supabase, Google Sheets, `CRON_SECRET`, etc.) viven en el proyecto de Vercel de Jeremy.

Esto es un riesgo operacional y de continuidad de negocio grave: el sistema procesa facturación electrónica (Alegra/DIAN), comisiones, y un webhook de Alegra en vivo (`/api/alegra-webhook`, activo hoy). Si la cuenta personal de Jeremy se suspende, se recupera por un tercero, o pierde acceso, **hackÜ pierde el control de un sistema financiero en producción**.

Actualmente **solo tenemos el correo `jeremy@hacku.co`**; el acceso a su GitHub `johacku` está pendiente de solicitar. No hay garantía de acceso a su login de Vercel ni a su 2FA.

**Objetivo:** mover el 100% de la propiedad y el control operativo de este sistema a cuentas corporativas de hackÜ (`producto@hacku.co` y una organización de GitHub de la empresa), sin downtime del webhook de Alegra ni de los crons, y sin dejar **nada** en cuentas personales de Jeremy.

## 2. User Scenarios & Stories

### US1: Recuperar propiedad del proyecto de Vercel — Priority: P1

**As a** responsable de producto de hackÜ, **I want** que el proyecto de Vercel `finanzas-hacku` sea propiedad de una cuenta/equipo corporativo (`producto@hacku.co`), **so that** hackÜ controle los deployments, dominios y secretos aunque Jeremy desaparezca.

**Acceptance Criteria:**
- **Given** el proyecto vive hoy en el equipo personal de Jeremy, **When** completo la transferencia, **Then** el proyecto aparece en un equipo cuyo owner es `producto@hacku.co` y Jeremy ya no es miembro.
- **Given** la transferencia se completó, **When** reviso los deployments/config, **Then** el dominio `finanzas-hacku.vercel.app` (o su reemplazo) sirve la app en producción sin interrupción perceptible.
- **Given** el proyecto migrado, **When** reviso las variables de entorno, **Then** todas las variables de producción existen y son válidas en el nuevo proyecto.

### US2: Restaurar y re-anclar las notificaciones de Slack — Priority: P1

**As a** equipo de finanzas, **I want** que las notificaciones "Nueva Solicitud de Factura" vuelvan a llegar a Slack, **so that** no se pierdan solicitudes por un token revocado atado a Jeremy.

**Acceptance Criteria:**
- **Given** el `SLACK_BOT_TOKEN` fue revocado al salir Jeremy, **When** reinstalo la Slack App bajo una identidad corporativa y actualizo el token en Vercel, **Then** una solicitud de factura de prueba publica correctamente en el canal de Slack.
- **Given** la app reinstalada, **When** reviso quién la instaló, **Then** el instalador es una cuenta de servicio/corporativa de hackÜ, no una persona que pueda darse de baja.

### US3: Migrar el repositorio de GitHub fuera de la cuenta personal — Priority: P1

**As a** hackÜ, **I want** que el código de `finanzas-hacku` viva en una organización de GitHub de la empresa, **so that** el control del código y el pipeline de despliegue no dependan de la cuenta personal `johacku`.

**Acceptance Criteria:**
- **Given** el repo está en `johacku/finanzas-hacku`, **When** lo transfiero a la org corporativa, **Then** el repo responde en `ORG_HACKU/finanzas-hacku` y `johacku` deja de ser owner.
- **Given** el repo migrado, **When** hago un push a `main`, **Then** Vercel (ya bajo `producto@hacku.co`) dispara un deployment de producción exitoso desde el nuevo remoto.
- **Given** la integración Git reconectada, **When** reviso la config de Vercel, **Then** apunta al repo de la org, no a `johacku`.

### US4: Preservar continuidad del webhook de Alegra y los crons — Priority: P1

**As a** operación financiera, **I want** que `/api/alegra-webhook` y los crons (`recurring-commissions`, etc.) sigan funcionando durante y después de la migración, **so that** no se pierdan facturas ni se dupliquen/omitan comisiones.

**Acceptance Criteria:**
- **Given** Alegra apunta hoy al webhook en el dominio actual, **When** verifico tras la migración, **Then** el webhook responde 200 desde el proyecto/dominio nuevo y Alegra sigue apuntando a una URL válida.
- **Given** los crons definidos en `vercel.json`, **When** el proyecto migra, **Then** los crons quedan agendados y protegidos por `CRON_SECRET` en el nuevo proyecto.
- **Given** `CRON_SECRET` y demás secretos, **When** migran, **Then** su valor se preserva (no se regenera salvo que sea necesario por seguridad) para no romper integraciones externas.

### US5: Revocar todo acceso residual de Jeremy — Priority: P1

**As a** hackÜ, **I want** eliminar cualquier acceso, token, o membresía de Jeremy sobre este sistema, **so that** un ex-empleado no conserve control sobre infraestructura financiera.

**Acceptance Criteria:**
- **Given** la migración completa, **When** audito Vercel, GitHub, Slack, Supabase, Alegra y Google, **Then** Jeremy (`jeremy@hacku.co` / `johacku`) no aparece como owner, miembro, ni tiene tokens activos en ninguno.
- **Given** secretos que pudieron ser conocidos por Jeremy, **When** evalúo riesgo, **Then** los secretos sensibles marcados para rotación han sido rotados.

## 3. Functional Requirements

| ID | Requirement | Priority | Story |
|----|------------|----------|-------|
| FR-001 | Crear/identificar un equipo de Vercel corporativo cuyo owner sea `producto@hacku.co` | P1 | US1 |
| FR-002 | Transferir el proyecto `finanzas-hacku` desde el equipo personal de Jeremy al equipo corporativo, preservando dominio y config | P1 | US1 |
| FR-003 | Exportar/replicar todas las variables de entorno de producción al proyecto migrado, verificando que sean válidas | P1 | US1, US4 |
| FR-004 | Reinstalar la Slack App bajo una identidad de servicio corporativa y generar un nuevo `SLACK_BOT_TOKEN` | P1 | US2 |
| FR-005 | Actualizar `SLACK_BOT_TOKEN` en Vercel (producción) y redeployar | P1 | US2 |
| FR-006 | Verificar notificación de Slack end-to-end con una solicitud de prueba | P1 | US2 |
| FR-007 | Transferir el repo `johacku/finanzas-hacku` a la organización de GitHub corporativa | P1 | US3 |
| FR-008 | Reconectar la integración Git de Vercel al repo de la org y validar un deploy de `main` | P1 | US3 |
| FR-009 | Verificar continuidad de `/api/alegra-webhook` (responde 200 desde el nuevo dominio) y reapuntar Alegra si la URL cambia | P1 | US4 |
| FR-010 | Verificar que los crons de `vercel.json` quedan agendados y protegidos en el proyecto migrado | P1 | US4 |
| FR-011 | Eliminar a Jeremy como miembro/owner de Vercel, GitHub, Slack y toda integración; revocar sus tokens | P1 | US5 |
| FR-012 | Rotar secretos sensibles conocidos por Jeremy (según matriz de rotación) | P2 | US5 |
| FR-013 | Documentar el nuevo mapa de propiedad (quién controla qué) y accesos de respaldo | P2 | US5 |

## 4. Key Entities

| Entity | Description | Key Attributes |
|--------|------------|----------------|
| Proyecto Vercel | La app desplegada `finanzas-hacku` | `prj_pz0dm69AcMsQFZ7wvfAddwBrbtJw`, dominio `finanzas-hacku.vercel.app`, node 24.x |
| Equipo Vercel (origen) | Cuenta personal de Jeremy | `team_mYwxPYUBZ1PvHFBcDBiIpVSo` (`hacku-finanzas`, plan Hobby) |
| Equipo Vercel (destino) | Equipo corporativo hackÜ | owner `producto@hacku.co` — [NEEDS CLARIFICATION: ¿existe ya o se crea? ¿plan Hobby o Pro?] |
| Repo GitHub (origen) | `johacku/finanzas-hacku` | cuenta personal de Jeremy, público |
| Org GitHub (destino) | Organización corporativa de hackÜ | **`hacku-education`** (https://github.com/hacku-education) — RESUELTO |
| Slack App | "hackU Finance Notifications" | instalada por Jeremy; token revocado; canal de finanzas |
| Variables de entorno | Secretos de producción | `SLACK_BOT_TOKEN`, Alegra, Supabase, Google Sheets, `CRON_SECRET`, otros |
| Webhook Alegra | `/api/alegra-webhook` | activo en producción; Alegra apunta a la URL del dominio |
| Crons | Jobs agendados en `vercel.json` | `recurring-commissions` (diario 07:00 UTC) y otros |

## 5. Success Criteria

| ID | Criteria | How to Measure |
|----|----------|----------------|
| SC-001 | Cero infraestructura en cuentas personales de Jeremy | Auditoría manual: Vercel, GitHub, Slack, Supabase, Alegra, Google no listan a Jeremy como owner/miembro |
| SC-002 | Notificaciones de Slack operativas | Solicitud de factura de prueba publica en el canal sin error |
| SC-003 | Pipeline de despliegue corporativo funcional | Push a `main` en el repo de la org dispara deploy de prod exitoso en el proyecto de `producto@hacku.co` |
| SC-004 | Continuidad del webhook de Alegra | `/api/alegra-webhook` responde 200 desde el dominio nuevo; sin gap en recepción de facturas |
| SC-005 | Crons operativos | Ejecución de cron registrada tras migración; comisiones recurrentes se generan idempotentemente |
| SC-006 | Sin downtime perceptible del sistema en producción | El dominio de producción sirve la app durante toda la ventana de migración |

## 6. Edge Cases & Error Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| No se consigue acceso al login de Vercel de Jeremy | Escalar a soporte de Vercel para recuperación de cuenta usando control del correo `jeremy@hacku.co`; NO recrear a ciegas sin antes intentar transferencia oficial |
| No se consigue acceso a GitHub `johacku` | Plan B: recrear repo en la org desde un clon local + reconectar Vercel al nuevo repo; el histórico de commits se preserva vía `git push --mirror` |
| Transferencia de proyecto Vercel falla por límites de plan | Verificar plan del equipo destino; si Hobby no permite ciertos features (dominios, crons, protección), evaluar upgrade a Pro antes de transferir |
| El dominio `finanzas-hacku.vercel.app` cambia al migrar | Si cambia el subdominio, actualizar la URL del webhook en Alegra y cualquier callback externo ANTES de dar por cerrada la migración |
| Alegra sigue enviando webhooks durante la ventana de corte | Coordinar ventana de baja actividad; el webhook es idempotente por diseño, pero confirmar que no haya pérdida de eventos durante el swap de dominio |
| Secreto se rompe al copiarse mal entre proyectos | Verificar cada integración con un smoke test (Slack ping, Alegra fetch, Supabase query) antes de cerrar |
| Jeremy conserva 2FA que bloquea la baja de una cuenta | Documentar y escalar a soporte del proveedor correspondiente; marcar como riesgo abierto hasta resolver |

## 7. Assumptions & Constraints

- El sistema está en **producción activa** (webhook de Alegra recibió eventos hoy 2026-08-25). La migración debe minimizar downtime.
- El repo es **público** hoy; tras migrar a la org conviene evaluar hacerlo privado.
- El código de la app **no cambia** en esta migración — es un cambio de propiedad/infraestructura, no de features.
- [NEEDS CLARIFICATION: ¿`producto@hacku.co` ya tiene cuenta en Vercel y en GitHub, o hay que crearlas?]
- [NEEDS CLARIFICATION: ¿nombre exacto de la organización de GitHub corporativa destino?]
- [NEEDS CLARIFICATION: ¿existe una cuenta de servicio de Slack corporativa para instalar la app, o se usará `producto@hacku.co`?]
- [NEEDS CLARIFICATION: ¿quién es dueño de la cuenta de Alegra y de Supabase? ¿también estaban a nombre de Jeremy?]
- [NEEDS CLARIFICATION: ¿el plan destino de Vercel será Hobby o Pro? Afecta límites de crons, dominios y protección de deployments.]

## 8. Out of Scope

- Refactor o cambios funcionales del código de la app.
- Corrección de los otros errores de runtime observados (`total_moneda_local`, `[Sheets] ... not valid JSON`) — se atienden en un esfuerzo aparte, salvo que bloqueen la verificación de la migración.
- Cambio de proveedor (seguimos en Vercel + GitHub + Slack + Alegra + Supabase).
- Migración de datos de Supabase (se aborda solo si la cuenta de Supabase también está a nombre de Jeremy — ver clarificación).

## 9. Dependencies

- Acceso administrativo a `producto@hacku.co` (Vercel + GitHub + Slack).
- Acceso al correo `jeremy@hacku.co` (ya disponible) para recuperación/confirmaciones.
- Acceso a GitHub `johacku` (pendiente de solicitar a Jeremy) — determina si la transferencia es limpia o vía plan B.
- Credenciales de administrador de la Slack App / workspace de hackÜ.
- Acceso a la configuración de webhooks de Alegra.
- Acceso al panel de Supabase del proyecto.

## 10. Security & Performance

- **Autorización:** solo `producto@hacku.co` (y quien la empresa designe) debe quedar como owner tras la migración.
- **Privacidad de datos:** el sistema maneja facturación electrónica (datos fiscales/DIAN) y comisiones. Ningún secreto debe exponerse en logs, commits ni mensajes.
- **Rotación de secretos:** todo secreto que Jeremy pudo conocer se evalúa para rotación (Slack ya obliga; Alegra/Supabase/`CRON_SECRET` según matriz).
- **Continuidad:** objetivo de downtime del webhook de Alegra y del dominio de producción ≈ 0; ventana de corte coordinada en baja actividad.
