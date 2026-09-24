# api-drinks

API de bebidas y cocteles construida con NestJS sobre [TheCocktailDB](https://www.thecocktaildb.com).
No es solo un buscador de recetas:
- te dice qué puedes preparar con lo que tienes en la cocina, y qué comprar para preparar más;
- qué tomar según tu estado de ánimo;
- cuál es el "ADN de sabor" de cada bebida y cuáles son sus gemelas;
- guarda tu despensa y tus favoritos, y aprende de ellos **tu ADN de sabor** para recomendarte bebidas nuevas;
- y a los bares les arma una **carta inteligente** con costo, precio sugerido y margen por coctel.

Corre en el puerto definido por `PORT` (**8090** en `.env.example`).

## Documentación de la API: OpenAPI

La referencia de la API es **OpenAPI 3**, generada desde el código con `@nestjs/swagger`:

| Qué                   | Dónde                                     |
| --------------------- | ----------------------------------------- |
| Swagger UI (probar)   | http://localhost:8090/docs                |
| Documento OpenAPI     | http://localhost:8090/docs/openapi.json   |

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
| Servidor        | `NODE_ENV`, `PORT`, `TRUST_PROXY` (detrás de un proxy, para ver la IP real), `OPENAPI_ENABLED` |
| TheCocktailDB   | `COCKTAILDB_BASE_URL`, `COCKTAILDB_API_KEY`, `COCKTAILDB_TIMEOUT_MS`, `COCKTAILDB_RETRIES`, `COCKTAILDB_CRAWL_CONCURRENCY`, `CATALOG_TTL_MS` |
| PostgreSQL      | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_POOL_MAX` |
| Autenticación   | `JWT_SECRET` (mín. 32 caracteres), `JWT_ACCESS_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS` |
| Límite de login | `LOGIN_MAX_FAILURES_PER_ACCOUNT`, `LOGIN_MAX_FAILURES_PER_IP`, `LOGIN_LOCKOUT_WINDOW_SECONDS` |
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
| `drinks`   | `drinks`, `catalog_syncs`, `user_pantries`, `favorites` |
| `identity` | `users`, `refresh_tokens`, `login_failures`, `api_keys`, `api_usage` |
| `billing`  | `plans` (sembrada por `0004_seed_plans.sql`), `subscriptions` |
| `venues`   | `venues`, `venue_inventory` |

## Flujo de trabajo: Gitflow

| Rama        | Sale de   | Entra a (vía PR)            | Método en GitHub | Para |
| ----------- | --------- | --------------------------- | ---------------- | ---- |
| `main`      | —         | —                           | —                | Lo que está en producción. Cada merge es una versión. |
| `develop`   | `main`    | —                           | —                | Integración de lo próximo a publicar. |
| `feature/*` | `develop` | `develop`                   | **Squash**       | Una funcionalidad o cambio: `feature/carta-bares`. |
| `release/*` | `develop` | `main` y luego `develop`    | **Merge** a `main`; **Squash** a `develop` | Preparar una versión: `release/3.1.0`. Solo ajustes finales. |
| `hotfix/*`  | `main`    | `main` y luego `develop`    | **Merge** a `main`; **Squash** a `develop` | Corrección urgente en producción: `hotfix/login-429`. |

- **Nadie hace push directo** a `main` ni a `develop`: todo entra por pull request.
- **En `develop` se usa squash:** cada feature queda como un único commit con el título del PR.
- **En `main` se usa merge commit:** cada release o hotfix queda visible como una unidad en la historia.
- **Tags:** tras mergear un `release/*` o un `hotfix/*` a `main`, se etiqueta la versión (`git tag v3.1.0`).

```bash
# feature
git switch develop && git pull
git switch -c feature/mi-cambio
# ...commits...
git push -u origin feature/mi-cambio          # abrir PR hacia develop → Squash and merge

# release
git switch -c release/3.1.0 develop           # PR hacia main (Merge) y luego hacia develop (Squash)

# hotfix
git switch -c hotfix/descripcion main         # PR hacia main (Merge) y luego hacia develop (Squash)
```

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
| **Calidad y build** | Todo lo que no necesita infraestructura, rápido: formato (`prettier --check`), tipos (`tsc --noEmit`), lint (`oxlint`), pruebas unitarias y `nest build` |
| **Pruebas e2e e integración** | Pruebas e2e con fakes en memoria (incluida la verificación de OpenAPI) y, sobre un PostgreSQL efímero, migraciones y pruebas de integración |
| **Imagen Docker** | Construye la imagen y hace una prueba de humo: arranca el contenedor y verifica que `/health` responda. En push a `main`/`develop` la **publica** en GitHub Container Registry (CD). |

Los tres corren en paralelo.

- **Configuración:** el CI no tiene configuración propia. Parte de `.env.example`
  (`.github/actions/ci-env`) y genera en cada ejecución los secretos que faltan (contraseña del
  Postgres efímero, `JWT_SECRET`). No hay secretos escritos en el repositorio y no hace falta
  configurar *secrets* en GitHub: la publicación usa el `GITHUB_TOKEN` automático.
- **Tags de la imagen** `ghcr.io/<owner>/<repo>`:
  - push a `main`: `latest`, `main` y `sha-<commit>`;
  - push a `develop`: `develop` y `sha-<commit>`.
- **Despliegue:** el CD termina en la imagen publicada. Desplegarla en un servidor o una nube es el
  siguiente paso cuando se defina dónde va a vivir la API.

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
    cocktaildb/    cliente de TheCocktailDB (DrinkSource)
    security/      scrypt, JWT (jose), tokens opacos
    *.module.ts    cableado de Nest: construye los casos de uso con factories
```

- Los DTOs (lo que en Java serían DTOs) viven solo en `infrastructure/http/dto`. El dominio nunca los ve.
- Los contextos se hablan por puertos. Por ejemplo, `venues` e `identity` definen cada uno su puerto
  de límites del plan, y un adaptador en su `*.module.ts` lo implementa sobre `GetPlanLimits` de
  `billing`.
- Los errores de dominio se traducen a HTTP en un único filtro,
  `shared/infrastructure/http/domain-error.filter.ts`:

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

- **Refresh tokens:** rotan en cada uso. Si alguien reutiliza uno ya rotado, se revoca toda la
  familia de sesiones que viene de ese login.
- **Contraseñas:** se guardan con scrypt.
- **Secretos:** de los refresh tokens y las API keys solo se guarda el hash.
- **Límite de login:** tras `LOGIN_MAX_FAILURES_PER_ACCOUNT` fallos por cuenta, o
  `LOGIN_MAX_FAILURES_PER_IP` por IP, dentro de la ventana, el login responde `429` con
  `Retry-After`. Un login exitoso limpia los fallos de la cuenta.
- **Lo que una API key no puede hacer:** gestionar la cuenta (`/me/*`, `/auth/*`, `/admin/*`) ni
  escribir en un bar. Si llega con una API key, responde `403`.

### Roles

| Rol           | Puede |
| ------------- | ----- |
| `user`        | Todo lo público; con 18+, ver bebidas con alcohol; despensa, favoritos y API keys |
| `premium`     | Lo de `user` + recomendaciones personalizadas según su ADN de sabor |
| `bartender`   | Reservado para las siguientes funcionalidades |
| `venue_owner` | Registrar bares y usar la carta inteligente (debe ser mayor de edad) |
| `admin`       | Gestionar roles y suscripciones, resincronizar el catálogo y ver cualquier bar. Sin límites de plan. |

### Planes (freemium)

Los planes son datos de la tabla `plans`, no código. Se consultan en `GET /plans`.
Los valores iniciales son:

| Plan     | COP/mes | Bares | Ítems de inventario | Precios en la carta | API keys | Peticiones/día |
| -------- | ------- | ----- | ------------------- | ------------------- | -------- | -------------- |
| free     | 0       | 1     | 30                  | no                  | 1        | 100            |
| pro      | 89.000  | 3     | 300                 | sí                  | 3        | 10.000         |
| business | 249.000 | ∞     | ∞                   | sí                  | 10       | 100.000        |

- Quien no tiene una suscripción vigente está en `free`.
- Pasar un límite responde `402`.
- La cuota diaria es **por usuario**, sumando todas sus keys. Cada respuesta lleva
  `X-RateLimit-Limit`, `X-RateLimit-Remaining` y `X-RateLimit-Reset`.
- Por ahora un admin asigna las suscripciones (`PUT /admin/users/:id/subscription`), por ejemplo
  al confirmar una transferencia. Conectar una pasarela de pago es agregar un adaptador.
- Una suscripción cancelada sigue vigente hasta el fin del periodo.

### Tu ADN de sabor

- **`GET /me/taste`** (cualquier usuario autenticado): promedia el ADN de sabor de tus favoritos y
  devuelve tu perfil de 0 a 100, tus rasgos dominantes, tu personalidad, la intensidad que sueles
  elegir y los ingredientes que más repites.
  - La confianza sube con la cantidad de favoritos: `low` con 1–2, `medium` con 3–7 y `high` con 8 o más.
  - Sin favoritos responde `taste: null` con una pista de cómo empezar.
- **`GET /me/taste/recommendations`** (rol `premium` o `admin`): bebidas que aún no están en tus
  favoritos, ordenadas por afinidad (0–100) y cada una con sus razones.
  - La afinidad combina un 70 % de similitud entre sabores (coseno entre tu perfil y el ADN de la
    bebida) y un 30 % de ingredientes que ya están en tus favoritos.
  - Ejemplos de razones: *"Coincide con tu lado dulce, cítrico e intenso"*,
    *"Comparte ingredientes con tus favoritos: light rum, lime juice"*.
- **Edad:** respeta la verificación de edad. A un menor nunca se le recomienda alcohol.

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

La clave gratuita de TheCocktailDB no permite filtrar por varios ingredientes. Por eso el catálogo
completo se sincroniza a Postgres:
- Rastrea por letra inicial, con reintentos. Si una letra falla, se omite.
- Se resincroniza cuando pasa `CATALOG_TTL_MS`, en segundo plano.
- Las búsquedas y consultas por id **guardan lo que encuentran**, así que el catálogo crece con el uso.
- Si TheCocktailDB se cae, la búsqueda responde con los datos locales.

## Pruebas

```bash
pnpm test         # unitarias: dominio, casos de uso y adaptadores
pnpm test:e2e     # e2e con fakes en memoria (sin base de datos ni internet), incluye la verificación de OpenAPI
pnpm test:int     # integración contra el Postgres de .env; cada prueba corre en una transacción con rollback
pnpm typecheck
pnpm lint
pnpm format:check # lo mismo que exige el CI; `pnpm format` corrige
```
