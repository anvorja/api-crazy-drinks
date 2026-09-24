# api-drinks

API de bebidas y cocteles construida con NestJS sobre [TheCocktailDB](https://www.thecocktaildb.com).
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
| TheCocktailDB   | `COCKTAILDB_BASE_URL`, `COCKTAILDB_API_KEY`, `COCKTAILDB_IMAGES_BASE_URL`, `COCKTAILDB_TIMEOUT_MS`, `COCKTAILDB_RETRIES`, `COCKTAILDB_CRAWL_CONCURRENCY`, `CATALOG_TTL_MS` |
| PostgreSQL      | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_POOL_MAX` |
| Autenticación   | `JWT_SECRET` (mín. 32 caracteres), `JWT_ACCESS_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS` |
| Frontend (web)  | `CORS_ORIGINS`, `REFRESH_COOKIE_SAMESITE`, `REFRESH_COOKIE_SECURE`, `REFRESH_COOKIE_DOMAIN` (ver *Conectar un frontend*) |
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
| `drinks`   | `drinks`, `catalog_syncs`, `user_pantries`, `favorites`, `drink_reactions`, `taste_shares`, `cocktle_games` |
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
