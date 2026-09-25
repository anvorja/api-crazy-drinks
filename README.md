# api-drinks

API de bebidas y cocteles construida con NestJS. Su catálogo de 443 bebidas viene de
[TheCocktailDB](https://www.thecocktaildb.com) y está congelado en una migración, así que la API no
depende de su servicio (ver *Datos de TheCocktailDB*).
No es solo un buscador de recetas:
- te dice qué puedes preparar con lo que tienes en la cocina, y qué comprar para preparar más;
- qué tomar según tu estado de ánimo;
- cuál es el "ADN de sabor" de cada bebida y cuáles son sus gemelas;
- guarda tu despensa y tus favoritos, y aprende de ellos **tu ADN de sabor** para recomendarte bebidas nuevas;
- te deja descubrir bebidas con **swipe**, compartir tu ADN en una tarjeta y medir tu **compatibilidad** con amigos;
- tiene un reto diario, **Cocktle**, para adivinar el coctel del día;
- y a los bares les arma una **carta inteligente** con costo, precio sugerido y margen por coctel.

Corre en el puerto definido por `PORT` (**8090** en `.env.example`).

## Documentación de la API: OpenAPI

La referencia de la API es **OpenAPI 3**, generada desde el código con `@nestjs/swagger`:

| Qué                   | Dónde                                     |
| --------------------- | ----------------------------------------- |
| Swagger UI (probar)   | http://localhost:8090/docs                |
| Documento OpenAPI     | http://localhost:8090/docs/openapi.json   |

**Todas las rutas van bajo `/v1`** (por ejemplo `GET /v1/drinks`), salvo `/health`, `/health/ready` y
`/`, que no llevan versión porque las usan las sondas de infraestructura. En este README las rutas
se escriben sin el prefijo para abreviar.

Cada endpoint trae su resumen, descripción, parámetros, body, respuestas (incluidos los errores),
esquemas con nombre (`Drink`, `Session`, `VenueMenu`, `ErrorResponse`…) y el esquema de seguridad
que acepta. `OPENAPI_ENABLED=false` la apaga, por ejemplo en producción.

**Cómo se mantiene al día:**
- Los DTOs son esquemas zod en `infrastructure/http/dto`. Los mismos esquemas validan las
  peticiones y se convierten a OpenAPI con `shared/infrastructure/http/openapi.ts`. No hay una
  segunda definición que pueda quedar desactualizada.
- `test/openapi.e2e-spec.ts` falla si un endpoint no tiene resumen, tag o respuestas, o si queda
  un `$ref` roto.

## Puesta en marcha

Requiere Node 24+, pnpm y PostgreSQL.

```bash
pnpm install
cp .env.example .env     # completa DB_PASSWORD, JWT_SECRET y, si quieres, la cuenta ADMIN_*
pnpm db:migrate          # crea las tablas y siembra los planes
pnpm dev                 # modo watch
pnpm build && pnpm start:prod
```

### Configuración

Toda la configuración sale de variables de entorno; no hay valores escritos en el código.
`src/shared/infrastructure/config/env.ts` las valida con zod al arrancar. Si falta alguna o es
inválida, la app no arranca y lista cada problema. `.env.example` documenta todas las variables.
El `.env` real está en `.gitignore`.

| Grupo           | Variables |
| --------------- | --------- |
| Servidor        | `NODE_ENV`, `PORT`, `TRUST_PROXY` (detrás de un proxy, para ver la IP real), `OPENAPI_ENABLED`, `CACHE_MAX_AGE_SECONDS` |
| Catálogo        | `CATALOG_SOURCE` (`snapshot` o `cocktaildb`), `CATALOG_CACHE_CHECK_SECONDS`; solo con `cocktaildb`: `COCKTAILDB_BASE_URL`, `COCKTAILDB_API_KEY`, `COCKTAILDB_IMAGES_BASE_URL`, `COCKTAILDB_TIMEOUT_MS`, `COCKTAILDB_RETRIES`, `COCKTAILDB_CRAWL_CONCURRENCY`, `CATALOG_TTL_MS` |
| Cloudinary      | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`: solo para el script de imágenes, no para la API |
| PostgreSQL      | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_POOL_MAX`, `MIGRATE_ON_START` |
| Autenticación   | `JWT_SECRET` (mín. 32 caracteres), `JWT_ACCESS_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS` |
| Observabilidad  | `LOG_FORMAT` (`json` o `pretty`), `LOG_LEVEL`, `METRICS_ENABLED`, `METRICS_TOKEN`, `SENTRY_DSN` |
| Protección HTTP | `RATE_LIMIT_ENABLED`, `RATE_LIMIT_STORE` (`memory` o `postgres`), `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_MAX`, `RATE_LIMIT_HEAVY_MAX`, `BODY_LIMIT_KB` |
| Frontend (web)  | `CORS_ORIGINS`, `REFRESH_COOKIE_SAMESITE`, `REFRESH_COOKIE_SECURE`, `REFRESH_COOKIE_DOMAIN` (ver *Conectar un frontend*) |
| Límite de login | `LOGIN_MAX_FAILURES_PER_ACCOUNT`, `LOGIN_MAX_FAILURES_PER_IP`, `LOGIN_LOCKOUT_WINDOW_SECONDS` |
| Recuperar contraseña | `PASSWORD_RESET_URL` (página del frontend), `PASSWORD_RESET_TTL_MINUTES`, `PASSWORD_RESET_MAX_PER_ACCOUNT`, `PASSWORD_RESET_MAX_PER_IP`, `PASSWORD_RESET_WINDOW_SECONDS` |
| Pagos           | `PAYMENTS_PROVIDER` (`none` o `wompi`), `SUBSCRIPTION_PERIOD_DAYS`, `PAYMENTS_REDIRECT_URL`, `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`, `WOMPI_API_URL`, `WOMPI_CHECKOUT_URL`, `WOMPI_TIMEOUT_MS` |
| Correo          | `MAIL_TRANSPORT` (`log` o `smtp`), `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` |
| Admin inicial   | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, `ADMIN_BIRTH_DATE` (las cuatro o ninguna) |

### Base de datos

Las migraciones están versionadas en `drizzle/` y se generan desde los esquemas de
`src/*/infrastructure/persistence/drizzle/*.schema.ts`.

```bash
pnpm db:generate --name <cambio>   # tras modificar un esquema
pnpm db:migrate                    # aplica las pendientes (drizzle-kit)
pnpm db:migrate:prod               # igual, sin drizzle-kit (tras pnpm build; lo usa la imagen Docker)
pnpm db:studio                     # explorador visual
```

| Contexto   | Tablas |
| ---------- | ------ |
| `drinks`   | `drinks` (sembrada por `0011_seed_drinks_catalog.sql`; imágenes en Cloudinary por `0012_images_cloudinary.sql`), `catalog_syncs`, `user_pantries`, `favorites`, `drink_reactions`, `taste_shares`, `cocktle_games` |
| `identity` | `users` (cuentas demo en `0013_seed_demo_users.sql`), `refresh_tokens`, `login_failures`, `api_keys`, `api_usage`, `password_resets` |
| `billing`  | `plans` (sembrada por `0004_seed_plans.sql`), `subscriptions`, `payments` |
| `venues`   | `venues`, `venue_inventory` |

### Cuentas demo

La migración `drizzle/0013_seed_demo_users.sql` crea cuentas de prueba con datos sintéticos, para la
evaluación académica. Viajan con las migraciones: cualquier base nueva (local, Railway…) las tiene
tras `pnpm db:migrate` o con `MIGRATE_ON_START=true`, sin poblar nada a mano.

Contraseña de todas: **`ApiDrinks2026`**, salvo la de Andrés Borja (`##AndresB1`).

| Correo | Rol | Edad | Qué trae |
| ------ | --- | ---- | -------- |
| `admin.demo@api-drinks.local` | `admin` | adulto | Todo: roles, suscripciones, cualquier bar |
| `premium@api-drinks.local` | `premium` | adulto | Laura: 6 favoritos, 9 swipes, despensa, ADN compartido en `/v1/taste/laura-demo-adn` y 5 partidas de Cocktle. Su ADN ("El ácido rebelde con alma frutal") y sus recomendaciones salen de inmediato |
| `bar@api-drinks.local` | `venue_owner` | adulto | Carlos: bar "La Barra Demo" (Cali, COP) con 18 insumos, plan **Pro** activo por un año desde la migración y su pago aprobado. La carta muestra costos, precios y márgenes |
| `bartender@api-drinks.local` | `bartender` | adulto | Sin datos |
| `basico@api-drinks.local` | `user` | adulto | Recién registrado: sin ADN todavía |
| `menor@api-drinks.local` | `user` | 16 años | No ve bebidas con alcohol (`403 AGE_RESTRICTED`) |
| `andres.vorja.vorja@gmail.com` | `user` | adulto | Sin datos |

- **Tokens:** los JWT no se guardan: se obtienen con `POST /v1/auth/login`. En la base solo quedan
  los usuarios con su contraseña cifrada con scrypt.
- **Sin pisar nada:** si un correo ya existe, esa cuenta se omite, y sus datos también.
- **Cuidado:** las contraseñas están en el repositorio, que es público. Sirven para una demo, no
  para una instalación con usuarios reales. Si la API queda pública, cambia la contraseña de
  cualquier cuenta que te importe con `PUT /v1/me/password`.

## Flujo de trabajo: Gitflow

| Rama        | Sale de   | Entra a (vía PR)            | Método en GitHub | Para |
| ----------- | --------- | --------------------------- | ---------------- | ---- |
| `main`      | —         | —                           | —                | Lo que está en producción. Cada merge es una versión. |
| `develop`   | `main`    | —                           | —                | Integración de lo próximo a publicar. |
| `feature/*` | `develop` | `develop`                   | **Squash**       | Una funcionalidad o cambio: `feature/carta-bares`. |
| `release/*` | `develop` | `main` y luego `develop`    | **Merge** a `main`; **Squash** a `develop` | Preparar una versión: `release/4.1.0`. Solo ajustes finales. |
| `hotfix/*`  | `main`    | `main` y luego `develop`    | **Merge** a `main`; **Squash** a `develop` | Corrección urgente en producción: `hotfix/login-429`. |

- **Nadie hace push directo** a `main` ni a `develop`: todo entra por pull request.
- **En `develop` se usa squash:** cada feature queda como un único commit con el título del PR.
- **En `main` se usa merge commit:** cada release o hotfix queda visible como una unidad en la historia.
- **Tags:** tras mergear un `release/*` o un `hotfix/*` a `main`, se etiqueta la versión
  (`git tag -a v4.1.0`) sobre el merge commit.
- **Versiones:** siguen [versionado semántico](https://semver.org/lang/es/). Se sube la mayor si
  hay cambios incompatibles, la menor si hay funcionalidades nuevas y el parche si solo hay
  arreglos. Cada release se documenta en `CHANGELOG.md`.

```bash
# feature
git switch develop && git pull
git switch -c feature/mi-cambio
# ...commits...
git push -u origin feature/mi-cambio          # abrir PR hacia develop → Squash and merge

# release
git switch -c release/4.1.0 develop           # PR hacia main (Merge) y luego hacia develop (Squash)

# hotfix
git switch -c hotfix/descripcion main         # PR hacia main (Merge) y luego hacia develop (Squash)
```

### Releases y hotfixes: por qué `release → main` y no `develop → main`

La clave es **qué contiene `develop` en el momento de publicar**. `develop` nunca se detiene:
mientras se prepara un release, se siguen mergeando features. La rama `release/*` existe para
**congelar** una foto de `develop`. Desde que se crea, lo nuevo entra a `develop` pero no al release.

```
develop:  A ── B ── C ─────── D ── E        ← D y E llegan después (a medias, sin probar)
                     \
release/4.1.0:        C ── fix              ← congelado en C; solo arreglos de estabilización
                             \
main:                         ● Release 4.1.0   (C + fix, exactamente lo probado)
```

- **`release → main` (correcto):** a producción llega exactamente lo congelado y probado (C más sus
  arreglos). D y E se quedan en `develop` para el próximo release.
- **`release → develop → main` (incorrecto):** el release se mezclaría con D y E, y el PR
  `develop → main` llevaría a producción funcionalidades que nadie revisó para esta versión.
- **Después, `release → develop`:** los arreglos hechos en la rama de release (el "fix" del
  diagrama, el cambio de versión, el CHANGELOG) vuelven a `develop`. Si no, el próximo release
  saldría sin ellos y el bug reaparecería.
- **El orden entre los dos PR** no importa técnicamente, porque ambos salen de la misma rama. Va
  `main` primero porque publicar es el objetivo: un conflicto en el PR a `develop` no debe retrasar
  el release.
- **`hotfix/*`** sigue la misma lógica: sale de `main`, entra a `main` (producción) y vuelve a
  `develop` para que el arreglo no se pierda en la próxima versión.

**Pasos para publicar un release:**

1. `git switch -c release/X.Y.Z develop`. Sube la versión (`package.json` y `APP_VERSION`), escribe
   la sección en `CHANGELOG.md` y corre `pnpm openapi:generate`, porque la versión va en el
   contrato. Haz el commit y el push.
2. **Abre los dos PR antes de mergear ninguno:** `release/X.Y.Z → main` con el título
   `Release X.Y.Z`, y `release/X.Y.Z → develop` con el título `chore: release X.Y.Z`. El borrado
   automático de ramas podría eliminar la rama al mergear el primero; si pasa, el PR mergeado
   tiene el botón *Restore branch*.
3. Mergea el PR a `main` con **Merge commit** y luego el de `develop` con **Squash**.
4. Etiqueta el merge commit de `main` y súbelo:
   ```bash
   git fetch && git tag -a vX.Y.Z origin/main -m "api-drinks X.Y.Z" && git push origin vX.Y.Z
   ```
   Subir el tag **publica la versión**: el workflow *Imagen de la versión* toma la imagen que el
   CI construyó y probó para ese commit y le agrega `X.Y.Z`, `X.Y`, `X` y `latest`. Si hay deploy
   hook, además avisa a Render (ver *CI/CD*).
5. Opcional: en GitHub, *Releases → Draft a new release*, elige el tag y pega la sección del
   CHANGELOG.

### Actualizar una rama: rebase

**Rebasar** es mover tus commits para que partan de otro punto. Git vuelve a aplicar sus cambios
encima del punto nuevo y crea commits nuevos, con el mismo contenido pero otro hash.

**En el flujo normal no hace falta.** Si cada rama sale de un `develop` actualizado y entra antes
de empezar la siguiente, nunca arrastra commits viejos:

```
1. git switch develop && git pull          ← partir siempre del develop actual
2. git switch -c feature/lo-que-sea
3. commits → PR → Squash and merge
4. para la siguiente feature: volver al paso 1
```

Solo hay que actualizar la rama en estos dos casos.

#### 1. `develop` avanzó y tu PR tiene conflictos

Alguien mergeó algo que toca las mismas líneas que tú. Resuélvelo en tu rama con una de estas opciones:

| Opción | Comandos | Cuándo |
| ------ | -------- | ------ |
| Rebase | `git fetch` · `git rebase origin/develop` · resolver · `git push --force-with-lease` | Historia limpia. Solo en **tu propia** rama de feature. |
| Merge | `git fetch` · `git merge origin/develop` · resolver · `git push` | Sin reescribir historia; si la rama la comparten varias personas. |

Con squash en `develop` da igual cuál uses: la feature entra como un único commit.

#### 2. Ramas encadenadas: una feature que sale de otra que aún no entra

A veces una feature depende de otra todavía sin mergear, así que sale de ella. El problema: el
**squash no copia los commits de la primera rama, crea uno nuevo** con otro hash. La segunda rama
sigue trayendo los commits originales, y git los ve como una historia distinta:

```
Antes del squash                   Después del squash de la rama A
develop:  X                        develop:  X ── A'        ← A comprimida en un commit nuevo
           \                                  \
rama A:     A1                     rama B:     A1 ── B1     ← todavía trae A1: conflicto
              \
rama B:        B1
```

Si B toca líneas que A agregó, su PR muestra conflictos, aunque el orden de los merges haya sido
el correcto. La solución es rebasar B para quedarse solo con sus commits encima del `develop` nuevo:

```bash
git fetch
# "toma los commits de B que no están en A y ponlos sobre develop"
git rebase --onto origin/develop <último-commit-de-A> feature/B
git push --force-with-lease
```

```
develop:  X ── A'
                 \
rama B:           B1'     ← solo lo de B, sin conflicto
```

- **Hay que repetirlo** después de cada squash de la cadena, con la siguiente rama.
- **Antes de rebasar**, comprueba que `develop` ya tiene todo lo de A:
  `git diff <último-commit-de-A> origin/develop` debe salir vacío.
- **Alternativa más simple:** esperar a que A entre y crear B desde `develop`.

**Reglas de seguridad:**
- Solo se rebasan ramas `feature/*` propias. Nunca `main` ni `develop`; de todas formas los
  rulesets bloquean el force push en ellas.
- Usa `--force-with-lease`, no `--force`: el push se rechaza si alguien subió algo a la rama que
  tú no tienes, así no pisas su trabajo.

### Configuración del repositorio en GitHub

Hay dos capas. Hace falta entender cuál aplica a qué:

| Capa | Dónde | Alcance |
| ---- | ----- | ------- |
| Métodos de merge permitidos | *Settings → General → Pull Requests* | **Todo el repositorio**, sin importar la rama por defecto |
| Método permitido en cada rama | Rulesets (siguiente sección) | **Una rama** |

Un PR solo puede usar un método que **ambas** capas permitan. Por eso el repositorio habilita merge
y squash, y los rulesets restringen cada rama a uno. Si se deshabilita *Allow merge commits*, los
PR hacia `main` se quedan sin ningún método disponible.

| Ajuste | Valor | Por qué |
| ------ | ----- | ------- |
| *Default branch* | `develop` | En Gitflow el trabajo diario apunta a `develop`, así que los PR nuevos van ahí por defecto. |
| *Allow merge commits* | ✔ · mensaje: **Pull request title** | Lo necesita `main` para recibir releases y hotfixes. |
| *Allow squash merging* | ✔ · mensaje: **Pull request title** | Lo necesita `develop` para recibir features. |
| *Allow rebase merging* | ✗ | No se usa. |
| *Automatically delete head branches* | ✔ | Borra la rama `feature/*`, `release/*` o `hotfix/*` al mergear su PR (se puede restaurar desde el PR). |

**Convención: el título del PR es el mensaje del commit.**
- **En `develop`:** cada feature queda como un solo commit con el título del PR, por ejemplo
  `feat: despensa guardada por usuario (#12)`.
- **En `main`:** cada merge marca una versión, así que `git log --first-parent main` se lee como
  una lista de versiones, por ejemplo `Release 3.1.0 (#15)` o `Hotfix: bloqueo de login con 429 (#16)`.

Por eso los PR se titulan con cuidado. El título se puede corregir en el diálogo de merge antes de confirmar.

### Rulesets de GitHub

`main` y `develop` están protegidas con rulesets. Sus definiciones están versionadas en
`.github/rulesets/` y se pueden importar en *Settings → Rules → Rulesets → Import a ruleset*.

| Regla | `main` | `develop` |
| ----- | ------ | --------- |
| Require a pull request before merging | ✔ | ✔ |
| Allowed merge methods | merge | squash |
| Require status checks to pass | los 3 checks de CI, solo de GitHub Actions | los 3 checks de CI, solo de GitHub Actions |
| Block force pushes | ✔ | ✔ |
| Restrict deletions (no se puede borrar la rama) | ✔ | ✔ |

Los checks exigidos son los nombres de los jobs de `.github/workflows/ci-cd.yml`. **Si se renombra
un job, hay que actualizar también los rulesets**, o los PR quedarán esperando un check que nunca llega.

- `Calidad y build`
- `Pruebas e2e e integración`
- `Imagen Docker`

## CI/CD (GitHub Actions)

`.github/workflows/ci-cd.yml` se ejecuta en cada PR y en cada push a `main` y `develop`.

| Job (status check) | Qué hace |
| ------------------ | -------- |
| **Calidad y build** | Todo lo que no necesita infraestructura, rápido: formato (`prettier --check`), tipos (`tsc --noEmit`), lint (`oxlint`), pruebas unitarias, `nest build` y que el contrato OpenAPI y el cliente tipado estén regenerados (`openapi:check`) |
| **Pruebas e2e e integración** | Pruebas e2e con fakes en memoria (incluida la verificación de OpenAPI) y, sobre un PostgreSQL efímero, migraciones y pruebas de integración |
| **Imagen Docker** | Construye la imagen y hace una prueba de humo: arranca el contenedor y verifica que `/health` responda. En push a `main`/`develop` la **publica** en GitHub Container Registry (CD). |

Los tres corren en paralelo.

- **Configuración:** el CI no tiene configuración propia. Parte de `.env.example`
  (`.github/actions/ci-env`) y genera en cada ejecución los secretos que faltan (contraseña del
  Postgres efímero, `JWT_SECRET`). No hay secretos escritos en el repositorio y no hace falta
  configurar *secrets* en GitHub: la publicación usa el `GITHUB_TOKEN` automático.
- **Tags de la imagen** `ghcr.io/<owner>/<repo>`:

  | Tag | Cuándo se actualiza | Para |
  | --- | ------------------- | ---- |
  | `latest` | Al publicar una versión (tag `vX.Y.Z`) | **Producción** (Render apunta aquí) |
  | `4.0.0`, `4.0`, `4` | Al publicar esa versión | Fijar una versión o hacer rollback |
  | `main` | Cada push a `main` | — |
  | `develop` | Cada push a `develop` | Staging |
  | `sha-<commit>` | Cada push | Una imagen exacta |

- **Imagen de la versión** (`.github/workflows/release-image.yml`):
  - **Qué hace:** al subir un tag `vX.Y.Z` **no reconstruye** la imagen. Toma la que el CI
    construyó y probó para ese commit (`sha-<commit>`) y le agrega `X.Y.Z`, `X.Y`, `X` y `latest`.
    Por eso **`latest` y la versión son la misma imagen, con el mismo *digest***.
  - **Qué valida:** que el tag tenga formato `vX.Y.Z`, que coincida con la versión de
    `package.json` y que el commit esté en `main`. Si algo no cuadra, falla antes de publicar.
  - **Lanzarlo a mano:** también se ejecuta desde *Actions → Imagen de la versión → Run workflow*,
    indicando el tag. Sirve para versiones etiquetadas antes de que existiera este workflow, o para
    reintentar.
  - **Render:** si el repo tiene el secreto `RENDER_DEPLOY_HOOK_URL` (*Settings → Secrets and
    variables → Actions*), al terminar le pide a Render que despliegue. Render debe tener configurada
    la imagen `ghcr.io/<owner>/<repo>:latest`. No hay que tocar nada al sacar una versión nueva.
- **Despliegue:** el CD termina en la imagen publicada. Desplegarla en un servidor o una nube es el
  siguiente paso cuando se defina dónde va a vivir la API.

## Despliegue

### Con Docker Compose (un servidor, o local)

```bash
cp .env.example .env              # completa DB_PASSWORD, JWT_SECRET…
docker compose up -d --build      # PostgreSQL + API (aplica las migraciones al arrancar)
docker compose --profile mail up -d   # además Mailpit para ver los correos: http://localhost:8025
```

`docker-compose.yml` no guarda ningún secreto: todo sale de `.env`.

### En una plataforma (Render, Railway, Fly.io, ECS, Cloud Run, Kubernetes…)

- **Imagen:** la de GitHub Container Registry que publica el CD, `ghcr.io/<owner>/<repo>`, con tag
  `develop` para staging y `latest` para producción.
- **Base de datos:** un **PostgreSQL gestionado**, con backups automáticos y restauración a un
  punto en el tiempo.
- **Configuración:** todas las variables como **secretos de la plataforma**; nunca un `.env` dentro
  de la imagen.
- **Migraciones:** `MIGRATE_ON_START=true` las aplica al arrancar. Con varias réplicas es seguro,
  porque un *advisory lock* de Postgres hace que migre una y las demás esperen. La otra opción es
  un paso previo al despliegue: `node dist/shared/infrastructure/database/migrate.js`.
- **Sondas:** *liveness* en `GET /health` y *readiness* en `GET /health/ready`.
- **Varias instancias:** con `RATE_LIMIT_STORE=postgres`, el límite de peticiones se comparte entre
  réplicas. La caché del catálogo de cada réplica detecta los cambios de las demás cada
  `CATALOG_CACHE_CHECK_SECONDS`.

**Ambientes:**

| Ambiente | Rama e imagen | Base de datos | Llaves |
| -------- | ------------- | ------------- | ------ |
| staging | `develop` | propia | Wompi **sandbox**; correo a Mailpit o a un proveedor de pruebas |
| producción | `main` (`latest`) | propia, con backups | Wompi **producción**, SMTP real |

### Checklist de producción

| Variable | Valor |
| -------- | ----- |
| `NODE_ENV` | `production` |
| `LOG_FORMAT` | `json` |
| `TRUST_PROXY` | `true` si hay un balanceador o proxy delante (casi siempre) |
| `CORS_ORIGINS` | la URL exacta del frontend |
| `REFRESH_COOKIE_SECURE` | `true`; y `SAMESITE` según *Conectar un frontend* |
| `RATE_LIMIT_STORE` | `postgres` |
| `METRICS_TOKEN` | un token largo y aleatorio |
| `OPENAPI_ENABLED` | `false`, si no quieres la documentación pública |
| `JWT_SECRET` | aleatorio: `openssl rand -base64 48` |
| `MAIL_TRANSPORT` | `smtp` con un proveedor real |
| `PAYMENTS_PROVIDER` | `wompi` con las llaves de **producción** y `WOMPI_API_URL=https://production.wompi.co/v1` |
| `CATALOG_SOURCE` | `snapshot` (con `cocktaildb` haría falta la clave Premium; ver *Datos de TheCocktailDB*) |
| `SENTRY_DSN` | recomendado |

### Backups

Si usas PostgreSQL gestionado, **usa sus backups automáticos**. Si no, hay scripts de backup lógico:

```bash
scripts/backup-db.sh                       # pg_dump -Fc a backups/, borra los de más de BACKUP_RETENTION_DAYS (7)
BACKUP_DIR=/srv/backups scripts/backup-db.sh
scripts/restore-db.sh backups/<archivo>.dump   # DESTRUCTIVO: pide escribir el nombre de la base
```

- **Configuración:** leen `DB_*` del entorno o de `.env`; el entorno tiene prioridad.
- **Programación:** prográmalos con cron o un timer y copia los backups **fuera del servidor**.
- **Prueba de vez en cuando que restauran,** por ejemplo en una base temporal.

## Datos de TheCocktailDB

Las recetas e imágenes vienen de [TheCocktailDB](https://www.thecocktaildb.com/). api-drinks es un
proyecto **académico**, así que el catálogo se tomó una sola vez con la clave de pruebas `1`
(permitida para uso educativo) y quedó **congelado** en la migración
`drizzle/0011_seed_drinks_catalog.sql`:

- **Qué contiene:** las 443 bebidas con sus ingredientes, medidas, instrucciones en inglés y español,
  categorías, vasos y etiquetas, tomadas el 2026-09-25. `pnpm db:migrate` crea las tablas y las
  siembra; no hace falta nada más para poblar la base.
- **Sin dependencia en tiempo de ejecución:** con `CATALOG_SOURCE=snapshot` (el valor por defecto de
  `.env.example`) la API nunca llama a TheCocktailDB. La búsqueda, el detalle, el aleatorio, el
  coctel del día y todo el análisis salen de Postgres, y `/health/ready` no revisa TheCocktailDB.
  `POST /v1/admin/catalog/sync` responde `409 CATALOG_SOURCE_DISABLED`.
- **Imágenes en Cloudinary:** las 443 fotos de bebidas y las 299 de ingredientes se copiaron a
  Cloudinary (carpeta `cocktailDB/`, subcarpetas `drinks/` e `ingredients/`) con
  `scripts/upload-images-cloudinary.mjs`. La migración `drizzle/0012_images_cloudinary.sql`
  apunta el catálogo a ellas. Así nada se carga desde el sitio de TheCocktailDB.
  - Se guarda el original (700 px) y la API arma `small`, `medium` y `large` (200, 350 y 500 px)
    con transformaciones en la URL (`c_fill,w_200,h_200,f_auto,q_auto`). Cloudinary elige WebP o
    AVIF según el navegador: la miniatura pesa unos 4 KB en lugar de 10.
  - Los ingredientes se muestran a 100 px, igual que antes.
  - El script usa las variables `CLOUDINARY_*` del `.env` y no hay que volver a ejecutarlo. Si se
    ejecuta de nuevo, conserva lo ya subido y regenera la misma migración.
- **Sincronizar de nuevo (opcional):** el adaptador `cocktaildb/` sigue ahí, detrás del puerto
  `DrinkSource`. Con `CATALOG_SOURCE=cocktaildb` y las variables `COCKTAILDB_*`, el catálogo vuelve
  a sincronizarse. Publicarlo así exigiría la **clave Premium** (pago único de unos USD 10 según su
  [página de la API](https://www.thecocktaildb.com/api.php)).

Lo que se mantiene en los dos modos:

- **Atribución obligatoria:** hay que citarlos como fuente y enlazar a su sitio. La API lo expone en
  `attribution` (en `GET /`) y en la descripción de OpenAPI. **El frontend debe mostrar** "Datos e
  imágenes: TheCocktailDB" con el enlace.
- **"You cannot resell our API":** por eso los datos de las bebidas son **gratis y abiertos**: no
  piden cuenta ni API key, y ningún plan cobra por ellos. Lo que se cobra con Wompi son funciones
  propias de api-drinks: bares, inventario, carta con costos y márgenes, y las API keys, que solo
  dan acceso a los endpoints de bares (`/v1/venues`), nunca al catálogo (ver *Planes*).

Términos completos: <https://www.thecocktaildb.com/terms_of_use.php>

## Docker

```bash
docker build -t api-drinks .
# Migraciones (sin drizzle-kit dentro de la imagen)
docker run --rm --env-file .env api-drinks node dist/shared/infrastructure/database/migrate.js
# API
docker run -d -p 8090:8090 --env-file .env api-drinks
```

- **Imagen:** multi-etapa sobre `node:24-alpine`, corre como usuario `node` y solo lleva las
  dependencias de producción.
- **Healthcheck:** el `HEALTHCHECK` de Docker usa `/health`.
- **Sin secretos en la imagen:** toda la configuración entra por variables de entorno al
  ejecutarla, y `.env` está en `.dockerignore`.
- **Base de datos en tu máquina:** si Postgres corre en el host (`DB_HOST=localhost`), agrega
  `--network host`.

## Protección HTTP

- **Límite por IP:** es una ventana fija de `RATE_LIMIT_WINDOW_SECONDS`, con dos baldes.
  - General: `RATE_LIMIT_MAX` peticiones por ventana.
  - Costoso: `RATE_LIMIT_HEAVY_MAX`, para las tarjetas PNG/SVG y el autocompletado.
  - Al pasarse, la API responde `429 RATE_LIMITED` con `Retry-After`. Cada respuesta lleva
    `RateLimit-Limit`, `RateLimit-Remaining` y `RateLimit-Reset`.
- **Qué se cuenta:** el límite corre en un middleware **antes** de la autenticación y de la base de
  datos. No aplica a `/health`, `/docs`, los webhooks (ya van firmados) ni las peticiones `OPTIONS`
  de CORS.
- **Almacenamiento:** con `RATE_LIMIT_STORE=postgres`, el contador es un upsert atómico en
  `rate_limit_hits`, compartido por todas las instancias. `memory` sirve para una sola instancia o
  pruebas.
- **Si el almacenamiento falla:** el límite **deja pasar** la petición y lo registra en el log. Así
  una caída del contador nunca tumba la API.
- **Detrás de un proxy:** pon `TRUST_PROXY=true` para limitar por la IP real del cliente y no por
  la del proxy.
- **Cabeceras de seguridad:** van con `helmet`. `Cross-Origin-Resource-Policy: cross-origin` permite
  que el frontend cargue las tarjetas. No hay CSP porque la API solo responde JSON, y Swagger UI la
  necesita desactivada.
- **Tamaño del body:** JSON de hasta `BODY_LIMIT_KB`. Más grande responde `413 PAYLOAD_TOO_LARGE`.
- **API keys:** además de este límite por IP, conservan su cuota diaria por plan, en los headers
  `X-RateLimit-*`.

## Observabilidad

- **Id de petición:** cada petición recibe un `X-Request-Id`. Si lo trae el cliente o el balanceador
  y es válido, se conserva; si no, se genera. Vuelve en el header de respuesta y en el `requestId` de
  todo error, así que un usuario puede reportar un problema con ese id.
- **Logs:** con `LOG_FORMAT=json` hay una línea JSON por petición, lista para cualquier colector
  (Loki, CloudWatch, Datadog…):
  ```json
  {"level":"log","context":"HTTP","message":{"msg":"request","requestId":"…","method":"GET","path":"/v1/drinks/11007","route":"/v1/drinks/:id","status":403,"durationMs":7,"userId":null}}
  ```
  `/health` y `/metrics` no se registran, para no llenar el log.
- **Errores inesperados (500):** se registran con su `requestId` y, si hay `SENTRY_DSN`, se envían a
  **Sentry**. Al cliente nunca le llega el detalle interno.
- **Métricas Prometheus** en `GET /metrics`:
  - `http_requests_total` y `http_request_duration_seconds`, por método, **patrón de ruta** y estado;
  - las métricas del proceso de Node.
  - Con `METRICS_TOKEN`, exige `Authorization: Bearer <token>`. **En producción ponlo siempre.**

## Arquitectura

Es hexagonal, organizada por contexto: `drinks`, `identity`, `billing`, `venues`, `health` y `shared`.

```
src/<contexto>/
  domain/          TypeScript puro: entidades, reglas, políticas y puertos de repositorio.
                   No importa Nest, zod, Drizzle ni nada de Node.
  application/     Casos de uso. Solo dependen del dominio y de puertos (interfaces).
    ports/         Lo que el contexto necesita de afuera (p. ej. VenuePlanLimitsPort).
  infrastructure/  Adaptadores:
    http/          controllers, DTOs (esquemas zod de request y response) y guards
    persistence/   Drizzle (Postgres) e in-memory
    cocktaildb/    cliente de TheCocktailDB (DrinkSource, opcional: CATALOG_SOURCE=cocktaildb)
    security/      scrypt, JWT (jose), tokens opacos
    *.module.ts    cableado de Nest: construye los casos de uso con factories
```

- Los DTOs (lo que en Java serían DTOs) viven solo en `infrastructure/http/dto`. El dominio nunca los ve.
- Los contextos se hablan por puertos. Por ejemplo, `venues` e `identity` definen cada uno su puerto
  de límites del plan, y un adaptador en su `*.module.ts` lo implementa sobre `GetPlanLimits` de
  `billing`.
- Todos los errores salen por un único filtro, `shared/infrastructure/http/api-exception.filter.ts`
  (ver *Errores*). Los errores de dominio se traducen así:

  | Error | HTTP |
  | ----- | ---- |
  | `ValidationError` | 400 |
  | `UnauthorizedError` | 401 |
  | `PlanLimitError` | 402 |
  | `ForbiddenError` | 403 |
  | `NotFoundError` | 404 |
  | `ConflictError` | 409 |
  | `RateLimitedError` | 429, con `Retry-After` |
  | `UnavailableError` | 503 |

## Conectar un frontend

La API y el frontend viven en dominios distintos. Esto es lo que el frontend necesita saber.

### Errores

Todos los errores tienen la misma forma:

```json
{ "statusCode": 403, "code": "AGE_RESTRICTED", "message": "This drink contains alcohol…", "error": "ForbiddenError" }
```

- **`code` es el contrato.** Es estable, así que el frontend decide qué hacer y qué texto mostrar
  (en español) según `code`. `message` es solo una pista en inglés y puede cambiar.
- **`details`** aparece solo con `VALIDATION_FAILED` y trae una entrada `{ path, message }` por cada
  campo inválido, para marcarlos en el formulario.
- **Lista completa de códigos:** está en `ERROR_CODES` (`src/shared/domain/errors.ts`) y en el
  esquema `ErrorResponse` de OpenAPI. Algunos: `AUTH_REQUIRED`, `INVALID_CREDENTIALS`,
  `INVALID_ACCESS_TOKEN`, `AGE_RESTRICTED`, `ROLE_REQUIRED`, `PLAN_LIMIT`, `LOGIN_LOCKED`,
  `EMAIL_TAKEN`, `WEAK_PASSWORD`, `DRINK_NOT_FOUND`, `NO_TASTE_YET`, `GAME_OVER`, `ROUTE_NOT_FOUND`.
- **Errores inesperados:** responden `500 INTERNAL_ERROR` con un mensaje genérico. El detalle queda
  en el log del servidor y nunca se expone.

### Sesión en el navegador

- **Access token:** es un JWT corto que el frontend guarda **en memoria**, no en `localStorage`, y
  envía como `Authorization: Bearer …`.
- **Refresh token:** va en una **cookie `httpOnly`**. JavaScript no puede leerla, así que un XSS no
  puede robarla. La cookie está restringida a la ruta `/v1/auth`, así que no viaja en ninguna otra
  petición.
- **Recargar la página:** el frontend llama a `POST /v1/auth/refresh` con `credentials: 'include'`
  y sin body. Recibe un access token nuevo y la cookie rota.
- **Defensa contra CSRF:** si el refresh llega por cookie, la API exige que el header `Origin` esté
  en `CORS_ORIGINS`. Si no, responde `401 ORIGIN_NOT_ALLOWED`.
- **Clientes sin navegador** (apps nativas, scripts): envían `refreshTokenIn: "body"` en el login y
  reciben el refresh token en el JSON, como antes.

```js
// login
await fetch(`${API}/v1/auth/login`, {
  method: 'POST', credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
// al cargar la app o cuando el access token vence
const session = await fetch(`${API}/v1/auth/refresh`, { method: 'POST', credentials: 'include' });
```

### CORS y la cookie según dónde viva el frontend

| Escenario | Ejemplo | Configuración |
| --------- | ------- | ------------- |
| Desarrollo local | `http://localhost:5173` → `http://localhost:8090` | `SAMESITE=lax`, `SECURE=false` |
| **Subdominios del mismo dominio** (recomendado) | `app.midominio.com` → `api.midominio.com` | `SAMESITE=lax`, `SECURE=true`, `DOMAIN` vacío o `.midominio.com` |
| Dominios totalmente distintos | `midrinks.vercel.app` → `api.otrodominio.com` | `SAMESITE=none`, `SECURE=true` (la API exige HTTPS) |

En los tres casos, `CORS_ORIGINS` lleva la URL exacta del frontend, sin barra final.

> **Importante:** si el frontend y la API están en *dominios registrables distintos* (último caso),
> la cookie es "de terceros" para el navegador. **Safari la bloquea siempre y otros navegadores
> tienden a hacerlo**: la sesión no sobreviviría a recargar la página. Por eso lo recomendado es
> servir ambos bajo el mismo dominio, en subdominios distintos. Así la cookie es de primera parte
> y funciona en todos los navegadores, incluso con `SameSite=Lax`.

### Cliente tipado

El contrato de la API está versionado en el repo:

| Archivo | Qué es |
| ------- | ------ |
| `openapi/openapi.json` | El documento OpenAPI, el mismo que sirve `/docs/openapi.json` |
| `openapi/api.d.ts` | Tipos TypeScript de todas las rutas, bodies, respuestas y errores, generados con `openapi-typescript` |

```bash
pnpm openapi:generate   # regenera ambos (no levanta el servidor ni toca la base de datos)
pnpm openapi:check      # regenera y falla si difieren de lo commiteado
```

- **Al cambiar un endpoint** hay que correr `pnpm openapi:generate` y commitear el resultado. El job
  *Calidad y build* del CI corre `openapi:check`, así que **un cambio de contrato que no se
  regeneró no pasa**, y el cambio queda visible en el diff del PR.
- **Qué comprueba `pnpm typecheck`:** `test/api-contract.typecheck.ts` usa los tipos como lo haría
  el frontend, así que el typecheck falla si dejan de servir.

**En el frontend**, copia `openapi/api.d.ts` (o genéralo desde la URL con
`npx openapi-typescript https://api.midominio.com/docs/openapi.json -o src/api.d.ts --default-non-nullable false`)
y úsalo con [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/):

```ts
import createClient from 'openapi-fetch';
import type { paths } from './api';

const api = createClient<paths>({ baseUrl: import.meta.env.VITE_API_URL, credentials: 'include' });

const { data, error } = await api.GET('/v1/drinks/{id}', { params: { path: { id: '11007' } } });
if (error?.code === 'AGE_RESTRICTED') mostrarAvisoDeEdad();   // `code` también está tipado
data?.ingredients.map((i) => i.nameEs ?? i.name);              // autocompletado de todo
```

## Reglas de negocio

El detalle de cada endpoint está en OpenAPI. Aquí van las reglas que atraviesan varios endpoints.

### Verificación de edad

Las bebidas con alcohol solo se muestran a **usuarios autenticados mayores de 18 años**, según la
fecha de nacimiento que declaran al registrarse.
- Los anónimos y los menores solo ven bebidas sin alcohol.
- Si piden una bebida con alcohol por id (o el mood `party`), reciben `403`.

Es una regla de dominio (`canSeeAlcohol` en `identity/domain/principal.ts`), no del frontend.

### Autenticación

| Credencial | Header | Para |
| ---------- | ------ | ---- |
| Access token (JWT, corto) | `Authorization: Bearer …` | Apps propias; todo lo de la cuenta |
| API key (`dk_…`) | `X-API-Key: …` | Integraciones de terceros: lectura de bebidas, lab y la carta de un bar |

- **Refresh tokens:** en navegador viajan en una cookie `httpOnly` (ver *Sesión en el navegador*).
  Rotan en cada uso. Si alguien reutiliza uno ya rotado, se revoca toda la
  familia de sesiones que viene de ese login.
- **Contraseñas:** se guardan con scrypt.
- **Secretos:** de los refresh tokens y las API keys solo se guarda el hash.
- **Límite de login:** tras `LOGIN_MAX_FAILURES_PER_ACCOUNT` fallos por cuenta, o
  `LOGIN_MAX_FAILURES_PER_IP` por IP, dentro de la ventana, el login responde `429` con
  `Retry-After`. Un login exitoso limpia los fallos de la cuenta.
- **Lo que una API key no puede hacer:** gestionar la cuenta (`/me/*`, `/auth/*`, `/admin/*`) ni
  escribir en un bar. Si llega con una API key, responde `403`.

### Cuenta

| Endpoint | Para |
| -------- | ---- |
| `POST /auth/password/forgot` | `{ email }`. Responde **siempre 202**, exista o no la cuenta, para no revelar cuáles existen. Si existe, envía un correo con un enlace a `PASSWORD_RESET_URL?token=…`. |
| `POST /auth/password/reset` | `{ token, newPassword }`. El enlace sirve una vez y vence en `PASSWORD_RESET_TTL_MINUTES`. Cierra todas las sesiones y avisa por correo. |
| `PATCH /me/profile` | Cambiar el nombre. La fecha de nacimiento no se puede cambiar, porque decide el acceso al alcohol. |
| `PUT /me/password` | `{ currentPassword, newPassword }`. Cierra todas las sesiones, incluida la actual, y avisa por correo. |
| `DELETE /me` | `{ password }`. **Borra la cuenta y todo lo suyo** en cascada (sesiones, favoritos, swipes, ADN compartido, partidas, bares, API keys, suscripción), en cumplimiento de la Ley 1581. Un admin debe quitarse el rol antes. |

- **Recuperar contraseña:** hay un solo enlace vigente, porque pedir otro invalida el anterior. Se
  limita a `PASSWORD_RESET_MAX_PER_ACCOUNT` solicitudes por email y `PASSWORD_RESET_MAX_PER_IP` por
  IP en la ventana. En la base de datos solo se guarda el hash del token.
- **Correo:** va detrás de un puerto (`Mailer`). En desarrollo, `MAIL_TRANSPORT=log` escribe los
  correos en el log. En producción, `smtp` los envía con cualquier proveedor SMTP (SES, SendGrid,
  Mailgun…). Para probar SMTP en local:
  ```bash
  docker run -d --rm --name mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit
  # .env: MAIL_TRANSPORT=smtp, SMTP_HOST=localhost, SMTP_PORT=1025 → bandeja en http://localhost:8025
  ```

### Roles

| Rol           | Puede |
| ------------- | ----- |
| `user`        | Todo lo público; con 18+, ver bebidas con alcohol; despensa, favoritos y API keys |
| `premium`     | Lo de `user` + recomendaciones personalizadas según su ADN de sabor |
| `bartender`   | Reservado para las siguientes funcionalidades |
| `venue_owner` | Registrar bares y usar la carta inteligente (debe ser mayor de edad) |
| `admin`       | Gestionar roles y suscripciones, resincronizar el catálogo (con `CATALOG_SOURCE=cocktaildb`) y ver cualquier bar. Sin límites de plan. |

### Planes (freemium)

Los planes son datos de la tabla `plans`, no código. Se consultan en `GET /plans`.
Los valores iniciales son:

| Plan     | COP/mes | Bares | Ítems de inventario | Precios en la carta | API keys | Peticiones/día |
| -------- | ------- | ----- | ------------------- | ------------------- | -------- | -------------- |
| free     | 0       | 1     | 30                  | no                  | 1        | 100            |
| pro      | 89.000  | 3     | 300                 | sí                  | 3        | 10.000         |
| business | 249.000 | ∞     | ∞                   | sí                  | 10       | 100.000        |

- Quien no tiene una suscripción vigente está en `free`.
- **Se cobra solo lo propio.** Los planes limitan funciones de api-drinks, nunca el acceso a las
  bebidas: el catálogo es gratis y no pide cuenta ni key, y las API keys solo sirven para los
  endpoints de bares (ver *Datos de TheCocktailDB*).
- Pasar un límite responde `402`.
- La cuota diaria es **por usuario**, sumando todas sus keys. Cada respuesta lleva
  `X-RateLimit-Limit`, `X-RateLimit-Remaining` y `X-RateLimit-Reset`.
- Las suscripciones se pagan con **Wompi** (ver *Pagos*). Un admin también puede asignarlas a mano
  con `PUT /admin/users/:id/subscription`, por ejemplo tras confirmar una transferencia.
- Una suscripción cancelada sigue vigente hasta el fin del periodo.

### Pagos (Wompi)

[Wompi](https://docs.wompi.co) es de Bancolombia, cobra en COP y tiene un sandbox gratuito con
tarjetas de prueba. Va detrás del puerto `PaymentGateway`, así que otra pasarela (Mercado Pago,
PayU…) sería otro adaptador.

| Endpoint | Para |
| -------- | ---- |
| `POST /me/subscription/checkout` | `{ planId }`. Crea un pago pendiente y devuelve la URL del **Web Checkout** de Wompi, firmada con `SHA256(referencia + monto + moneda + secreto de integridad)`. |
| `POST /webhooks/wompi` | Eventos de Wompi. Verifica el checksum SHA-256 con `WOMPI_EVENTS_SECRET` (comparación en tiempo constante). Con `transaction.updated` liquida el pago. |
| `POST /me/payments/verify` | `{ transactionId }`. Wompi vuelve a `PAYMENTS_REDIRECT_URL?id=…` y el frontend llama esto: la API consulta la transacción y liquida el pago sin esperar al webhook. |
| `GET /me/payments` | Historial de pagos. |

- **Pago aprobado:** activa el plan por `SUBSCRIPTION_PERIOD_DAYS`. Si se paga el mismo plan mientras
  sigue vigente, **se suma al final** del periodo; si es otro plan, el periodo empieza hoy.
- **Idempotente:** el webhook y la verificación pueden llegar los dos, e incluso Wompi reintenta
  eventos. Un pago solo se liquida una vez.
- **Monto o moneda distintos al precio:** el pago queda en `error` y no activa nada.
- **Sin pagos configurados:** con `PAYMENTS_PROVIDER=none` la API funciona igual y los endpoints de
  pago responden `503 PAYMENTS_UNAVAILABLE`.

**Probar con el sandbox:**
1. Crea una cuenta en [comercios.wompi.co](https://comercios.wompi.co). En *Desarrolladores* están
   las llaves de pruebas: `pub_test_…`, el secreto de integridad `test_integrity_…` y el de eventos
   `test_events_…`.
2. En `.env`: `PAYMENTS_PROVIDER=wompi`, las tres llaves y `WOMPI_API_URL=https://sandbox.wompi.co/v1`.
3. Para recibir el webhook en local, expón la API, por ejemplo con
   `cloudflared tunnel --url http://localhost:8090`, y registra `https://…/v1/webhooks/wompi` como
   URL de eventos en Wompi. Sin túnel, `POST /me/payments/verify` confirma el pago igual.
4. Paga con las tarjetas de prueba de la
   [documentación de sandbox](https://docs.wompi.co/docs/colombia/datos-de-prueba-en-sandbox/).

### Explorar el catálogo

Pensado para que un frontend arme su pantalla principal:

| Endpoint | Para |
| -------- | ---- |
| `GET /drinks` | Grilla con **scroll infinito**. Combina filtros: `q`, `category`, `glass`, `alcoholic`, `iba` e `ingredients` (debe tenerlos todos; entiende español: `ron,limón`). Se pagina por cursor: se envía el `nextCursor` recibido como `cursor`. |
| `GET /drinks/facets` | Opciones para los filtros (categorías, vasos e ingredientes más usados), con cuántas bebidas tiene cada una. |
| `GET /drinks/suggest?q=` | **Autocompletado** de bebidas e ingredientes mientras se escribe, tolerante a errores ("margarta" → Margarita). Usa similitud de trigramas sobre el catálogo en memoria. |

- **Cada bebida trae:**
  - `images.small|medium|large` para listas rápidas;
  - `categoryEs`, `glassEs` e `ingredients[].nameEs` en español (null si aún no hay traducción);
  - `ingredients[].image` con la foto del ingrediente.
- **Caché:** las lecturas deterministas del catálogo responden `Cache-Control: private, max-age=CACHE_MAX_AGE_SECONDS`
  con `Vary: Authorization, X-API-Key`, porque la respuesta depende de quién pregunta (regla de edad).
  Express agrega `ETag`, así que revalidar cuesta un `304`. Los endpoints con azar (`random`, moods) no se cachean.
- **Tras actualizar:** las bebidas guardadas antes de esta versión no tienen fotos de ingredientes.
  Un `POST /admin/catalog/sync` las completa.

### Swipe (descubrir)

Descubrir bebidas deslizando tarjetas, estilo Tinder. Requiere una sesión.

| Endpoint | Para |
| -------- | ---- |
| `GET /discover/deck?count=10` | Tarjetas que el usuario aún no ha visto. |
| `PUT /discover/{drinkId}` | Reaccionar: `like`, `dislike` o `superlike`. El superlike además la guarda en favoritos. Volver a reaccionar reemplaza la reacción anterior. |
| `DELETE /discover/{drinkId}` | Deshacer: la bebida puede volver a salir en el mazo. |
| `GET /discover/stats` | Conteo de likes, dislikes y superlikes. |

- **Cómo se arma el mazo:** cuando ya hay gusto, ~70 % sale elegido al azar entre las 30 bebidas más
  afines y ~30 % es exploración, para que el perfil siga aprendiendo y no se encierre en una burbuja.
- **Respuesta inmediata:** cada reacción devuelve el ADN de sabor actualizado, así el frontend puede
  mostrarlo cambiar en vivo.

### Tu ADN de sabor

- **`GET /me/taste`** (cualquier usuario autenticado): aprende de tus favoritos, likes y superlikes;
  cada dislike resta medio punto de su ADN. Con eso
  devuelve tu perfil de 0 a 100, tus rasgos dominantes, tu personalidad, la intensidad que sueles
  elegir y los ingredientes que más repites.
  - La confianza sube con la cantidad de señales (favoritos y swipes): `low` con 1–2, `medium` con 3–7 y `high` con 8 o más.
  - Sin favoritos responde `taste: null` con una pista de cómo empezar.
- **`GET /me/taste/recommendations`** (rol `premium` o `admin`): bebidas que aún no has visto (ni en
  favoritos ni en swipes), ordenadas por afinidad (0–100) y cada una con sus razones.
  - La afinidad combina un 70 % de similitud entre sabores (coseno entre tu perfil y el ADN de la
    bebida) y un 30 % de ingredientes que ya están en tus favoritos.
  - Ejemplos de razones: *"Coincide con tu lado dulce, cítrico e intenso"*,
    *"Comparte ingredientes con tus favoritos: light rum, lime juice"*.
- **Edad:** respeta la verificación de edad. A un menor nunca se le recomienda alcohol.

### ADN compartible y compatibilidad

| Endpoint | Acceso | Para |
| -------- | ------ | ---- |
| `PUT /me/taste/share` | Sesión | Activa un enlace público con un slug aleatorio y el **nombre que el usuario elija** (nunca su email ni su id). Llamarlo de nuevo lo renombra y conserva el enlace. |
| `GET` / `DELETE /me/taste/share` | Sesión | Ver o desactivar el enlace. Desactivarlo lo invalida. |
| `GET /taste/{slug}` | Público | Perfil compartido, siempre actualizado. |
| `GET /taste/{slug}/card.png` · `.svg` | Público | **Tarjeta para compartir** de 1200×630: radar de los 9 sabores, personalidad e ingredientes favoritos. El PNG es para `og:image`, la vista previa en WhatsApp, X o Instagram. |
| `GET /me/taste/compatibility/{slug}` | Sesión | Compatibilidad con un amigo: puntaje, titular ("74 % compatibles · Muy compatibles: los dos son del lado dulce, cítrico…"), rasgos en común y diferentes, y **3 cocteles puente**. |

- **Puntaje:** 75 % similitud de sabor (coseno) + 25 % ingredientes favoritos en común.
- **Cocteles puente:** bebidas que ninguno de los dos ha visto, ordenadas por el gusto del menos
  entusiasta de los dos, para que ambos queden contentos. Respetan la edad de quien consulta.
- **Tarjeta:** se dibuja como SVG y se convierte a PNG con `@resvg/resvg-js` (binarios precompilados,
  sin build nativo) en unos 30 ms. Usa la fuente DejaVu Sans incluida en `assets/fonts/`, con su
  licencia, porque escanear las fuentes del sistema tardaba segundos.

### Cocktle (reto diario)

Adivinar el coctel del día en 6 intentos, al estilo Wordle. Requiere una sesión. Para elegir cada
intento, el frontend usa `GET /drinks/suggest`.

| Endpoint | Para |
| -------- | ---- |
| `GET /cocktle/today?mode=` | La partida de hoy: pistas reveladas, intentos, y la respuesta y el texto para compartir cuando termina. |
| `POST /cocktle/today/guesses` | `{ drinkId, mode? }`: un intento. |
| `GET /cocktle/stats?mode=` | Partidas, victorias, racha actual y máxima, y distribución de intentos. |

- **Modos:** `classic` usa todo el catálogo y es solo para adultos; `zero` usa solo bebidas sin
  alcohol. El modo por defecto depende de la edad de quien juega. La respuesta es la misma para
  todos cada día UTC, elegida por un hash del día, e independiente del coctel del día.
- **Pistas:** van de lo abstracto a lo concreto, una más por cada fallo. Primero el ADN de sabor,
  luego la categoría y la fuerza, el vaso, los ingredientes, más ingredientes y por último la forma
  del nombre (`C _ _ _   _ _ _ _ _`).
- **Cada intento dice:**
  - la cercanía de sabor con la respuesta, de 0 a 100: 🟩 acierto, 🟨 80 o más, 🟧 50 o más, 🟥 frío;
  - los ingredientes en común;
  - si coinciden la categoría y el vaso.
- **Al terminar:** se revela la respuesta y se genera un resultado para compartir sin spoilers,
  por ejemplo `Cocktle 2026-09-24 · 3/6` con `🟥🟨🟩`.
- **Rachas:** cuentan días consecutivos ganados. Si hoy aún no se ha jugado, la racha de ayer sigue viva.

### Carta inteligente: cómo se costea

1. **Qué se puede servir.** Con los ingredientes en stock, la despensa inteligente calcula qué
   cocteles se pueden preparar. Entiende sinónimos en español y compara palabras completas, así
   que `gin` no cubre `ginger ale`.
2. **Costo por ingrediente:**
   - Si la medida de la receta es un volumen (`1 1/2 oz`, `2 cl`, `1 shot`, `2-3 dashes`…):
     `bottleCost / bottleSizeMl × ml`.
   - Si no lo es, o el ítem no tiene precio de botella: `costPerServing`. Sirve para guarniciones
     como la sal del borde, las hojas de menta o una rodaja.
   - Si no hay ninguno de los dos, el ingrediente sale en `unpriced` y el coctel queda sin precio.
     No se inventan costos.
3. **Precio sugerido.** `costo / targetPourCost`, redondeado a como se ve un precio: en COP sube
   al múltiplo de 500; en USD, al de 0.25.
4. **Margen y orden.** Margen = precio − costo. La carta se ordena del más rentable al menos rentable.
5. **Qué comprar.** `shoppingTips` dice qué comprar para ampliar la carta.

### Catálogo de bebidas

El catálogo completo vive en Postgres: filtros por varios ingredientes, despensa, moods, gemelos y
ADN se calculan sobre él. Depende de `CATALOG_SOURCE`:

- **`snapshot`** (por defecto): las 443 bebidas de la migración `0011`. No cambia ni llama afuera.
  `GET /v1/admin/catalog` muestra `mode: "snapshot"` y, como `lastSyncedAt`, la fecha de la toma.
- **`cocktaildb`**: además se sincroniza con TheCocktailDB.
  - Rastrea por letra inicial, con reintentos. Si una letra falla, se omite.
  - Se resincroniza cuando pasa `CATALOG_TTL_MS`, en segundo plano.
  - Las búsquedas y consultas por id **guardan lo que encuentran**.
  - Si TheCocktailDB se cae, la búsqueda responde con los datos locales.

## Pruebas

```bash
pnpm test         # unitarias: dominio, casos de uso y adaptadores
pnpm test:e2e     # e2e con fakes en memoria (sin base de datos ni internet), incluye la verificación de OpenAPI
pnpm test:int     # integración contra el Postgres de .env; cada prueba corre en una transacción con rollback
pnpm typecheck
pnpm lint
pnpm format:check # lo mismo que exige el CI; `pnpm format` corrige
pnpm openapi:check # el contrato OpenAPI y el cliente tipado están al día
```
