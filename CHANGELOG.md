# Changelog

Todos los cambios relevantes de api-drinks. Formato basado en
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado
[semántico](https://semver.org/lang/es/): la versión de la aplicación es independiente de la
versión del contrato HTTP (`/v1`).

## [Unreleased]

### Añadido

- **Pagos en producción** (`docs/pagos-wompi.md`): por qué el frontend usa un proxy de `/v1` cuando
  vive en otro sitio (Netlify y Render), el recorrido de la vuelta desde Wompi y las pruebas
  contra Render.
- **Archivos de entorno ordenados.**
  - `.env.example` es la plantilla que se sube.
  - `.env` guarda los valores locales y `.env.production` los de Render.
  - `.gitignore` ignora cualquier `.env*` salvo la plantilla.
  - Se documenta `PGSSLMODE` para usar una base externa con SSL.
- **Frontend en local:** `docs/pagos-wompi.md` explica por qué en desarrollo todo debe correr en
  `lvh.me` y no en `localhost`: si no, al volver de Wompi la cookie de sesión no viaja y el
  usuario parece desconectado. Incluye la prueba de login y refresh contra la API en `lvh.me`.
- **Propuesta de frontend:** `docs/propuesta_frontend.md` recoge el stack previsto (React + Vite +
  TypeScript + shadcn/ui), el recorrido de la demo, el mapa de pantallas y la identidad visual.
  El README lo menciona en *Conectar un frontend*. El frontend aún no se implementa.

## [5.0.0] - 2026-09-25

La API queda autónoma para la evaluación académica. El catálogo, las imágenes y las cuentas demo
viajan con las migraciones, así que cualquier base nueva (local o Railway) queda lista con
`pnpm db:migrate`, sin llamar a TheCocktailDB ni pagar su clave Premium.

### ⚠️ Cambios incompatibles con 4.0.0

- **Configuración:** la variable **`CATALOG_SOURCE`** es nueva y obligatoria. Con `snapshot` (el
  valor de `.env.example`) la API nunca llama a TheCocktailDB. Las variables `COCKTAILDB_*` y
  `CATALOG_TTL_MS` solo se piden con `CATALOG_SOURCE=cocktaildb`.
- **Readiness:** en `GET /health/ready`, `checks.theCocktailDb` solo aparece con
  `CATALOG_SOURCE=cocktaildb`.
- **Sincronización:** `POST /v1/admin/catalog/sync` responde `409 CATALOG_SOURCE_DISABLED` con el
  catálogo congelado.
- **Pagos:** con `PAYMENTS_PROVIDER=wompi`, la API no arranca si `PAYMENTS_REDIRECT_URL` apunta a
  `localhost`, porque el firewall de Wompi bloquea ese checkout con un `403`. En local se usa
  `http://lvh.me:<puerto>/…`.
- **Textos del ADN:** las personalidades cambian de texto (ver *Cambiado*). Los clientes que las
  comparen como cadena deben actualizarse.

### Añadido

- **Catálogo congelado:** las 443 bebidas tomadas de TheCocktailDB quedan en la migración
  `0011_seed_drinks_catalog.sql`. `GET /v1/admin/catalog` informa `mode` (`snapshot` o `synced`).
- **Imágenes en Cloudinary:** las fotos de bebidas (443) e ingredientes (299) se copiaron a
  Cloudinary (`cocktailDB/`) con `scripts/upload-images-cloudinary.mjs`, y la migración
  `0012_images_cloudinary.sql` apunta el catálogo a ellas. Los tamaños `small/medium/large` salen
  de transformaciones de Cloudinary, en WebP o AVIF según el navegador.
- **Cuentas demo:** la migración `0013_seed_demo_users.sql` crea 7 cuentas con datos sintéticos:
  una por rol, un menor de edad y la de Andrés Borja. La premium trae historial, ADN y Cocktle, y
  el dueño de bar trae bar, inventario y plan Pro. Ver README, *Cuentas demo*.
- **Guía de pagos:** `docs/pagos-wompi.md` documenta el flujo de Wompi pantalla por pantalla, cómo
  generar checkouts de prueba, los datos de prueba, los problemas comunes y el registro de pruebas
  en sandbox (PSE y tarjetas aprobada y rechazada).
- **`scripts/wompi-sandbox.sh`:** genera checkouts, verifica pagos y muestra el plan y el historial
  de una cuenta.
- **Imagen de cada versión:** al etiquetar un release, el workflow `release-image.yml` publica la
  imagen ya probada con `X.Y.Z`, `X.Y`, `X` y `latest`, sin reconstruirla. Si existe el secreto
  `RENDER_DEPLOY_HOOK_URL`, también dispara el despliegue en Render.

### Cambiado

- **ADN con lenguaje neutro:** las personalidades ya no asumen el género de la persona. El adjetivo
  concuerda con un sustantivo (paladar, espíritu, carácter, mente, corazón): "El ácido rebelde con
  alma frutal" ahora es "Espíritu ácido y rebelde con alma frutal". Los moods también reconocen las
  formas femeninas ("aventurera", "relajada", "romántica"…).
- **Autocompletado:** la foto de un ingrediente sale del catálogo, no de una URL armada con la
  configuración.
- **Qué se cobra:** los datos de las bebidas son gratis y abiertos. Los planes pagos cubren solo
  funciones propias (bares, inventario, carta con márgenes y API keys de bares).
- **Documentación:** el README explica el flujo de release y hotfix y los tags de la imagen.

### Verificado

- **Wompi sandbox:** un pago PSE y otro con tarjeta aprobaron y activaron el plan Pro. Una tarjeta
  rechazada no cambió nada, verificar dos veces no extendió el periodo, y otro usuario no pudo
  reclamar una transacción ajena (`403`).

## [4.0.0] - 2026-09-24

Primer release a producción desde `develop`.

### ⚠️ Cambios incompatibles con 3.0.0

- **Rutas:** todas van bajo **`/v1`** (por ejemplo `GET /v1/drinks`), salvo `/`, `/health` y
  `/health/ready`.
- **Login y refresh:** por defecto entregan el refresh token en una **cookie `httpOnly`** (acotada a
  `/v1/auth`) y devuelven `refreshToken: null`. Los clientes sin navegador deben enviar
  `refreshTokenIn: "body"`.
- **Errores:** tienen la forma `{ statusCode, code, message, error, details?, requestId }`. Los
  clientes deben decidir por **`code`**, que es estable, y no por `message`.
- **Configuración:** hay variables de entorno nuevas **obligatorias**; `.env.example` las documenta
  todas.

### Añadido

- **Explorar el catálogo:** filtros combinables (incluidos varios ingredientes en español),
  paginación por cursor, facetas, autocompletado tolerante a errores, imágenes en 3 tamaños, fotos
  de ingredientes y nombres en español.
- **Tu ADN de sabor:** el perfil de sabor del usuario, aprendido de favoritos y swipes;
  recomendaciones con razones para el rol premium.
- **Swipe (`/discover`):** mazo de tarjetas con un 70 % afín al gusto y un 30 % de exploración;
  like, dislike y superlike.
- **ADN compartible:** enlace público revocable, tarjeta PNG/SVG de 1200×630 para compartir en
  redes y compatibilidad entre amigos con cocteles puente.
- **Cocktle:** reto diario con pistas progresivas, modos `classic` y `zero`, resultado compartible
  sin spoilers y rachas.
- **Cuenta:** recuperar la contraseña por correo, cambiar nombre y contraseña, y borrar la cuenta
  en cascada.
- **Pagos con Wompi:** Web Checkout firmado, webhook verificado y confirmación con el id de la
  transacción; un pago aprobado activa o extiende el plan.
- **Contrato OpenAPI versionado** (`openapi/`) y cliente TypeScript generado, verificados en el CI.
- **Observabilidad:** `X-Request-Id`, logs JSON por petición, métricas Prometheus en `/metrics` y
  reporte de errores a Sentry (opcional).
- **Despliegue:** `docker-compose.yml`, migraciones al arrancar (seguras con varias réplicas),
  scripts de backup y restauración, y caché del catálogo coherente entre instancias.
- **CI/CD** con GitHub Actions, rulesets de `main` y `develop`, y documentación de Gitflow.

### Seguridad

- **CORS:** solo acepta los orígenes de `CORS_ORIGINS`, con credenciales.
- **CSRF:** la cookie de sesión solo se acepta si el `Origin` está permitido.
- **Límite de peticiones:** por IP, compartido entre instancias, con un balde estricto para los
  endpoints costosos.
- **Cabeceras:** `helmet` y límite de tamaño del body JSON (`413` en lugar de `500`).
- **Errores internos:** los inesperados nunca se exponen al cliente.

### Corregido

- **Heurística de sabores y despensa:** ahora compara palabras completas (`gin` ya no cuenta como
  `ginger`, y `chocolate` no es burbujeante por contener `cola`).
- **TheCocktailDB:** un timeout en una letra ya no tumba la sincronización completa del catálogo.
- **Carta de bares:** la coincidencia exacta del ingrediente tiene prioridad (`lime` ya no se
  confunde con `lime juice`).
- **Tarjeta PNG:** ahora sale como imagen (antes Nest la serializaba como JSON).

### Datos

- **Atribución:** es obligatoria y va en `GET /` y en OpenAPI. El frontend debe mostrarla.
- **Producción:** requiere la clave Premium de TheCocktailDB (ver README, *Datos de
  TheCocktailDB*).

## [3.0.0] - 2026-09-24

Versión inicial: catálogo sobre TheCocktailDB (búsqueda, detalle, coctel del día, ADN de sabor,
gemelos), despensa inteligente, moods, autenticación con roles y verificación de edad, planes
freemium con API keys, carta inteligente para bares y documentación OpenAPI.

[5.0.0]: https://github.com/anvorja/api-crazy-drinks/compare/v4.0.0...v5.0.0
[4.0.0]: https://github.com/anvorja/api-crazy-drinks/compare/8e3d78c...v4.0.0
[3.0.0]: https://github.com/anvorja/api-crazy-drinks/commit/8e3d78c
