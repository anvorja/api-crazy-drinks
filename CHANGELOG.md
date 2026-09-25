# Changelog

Todos los cambios relevantes de api-drinks. Formato basado en
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versionado
[semántico](https://semver.org/lang/es/): la versión de la aplicación es independiente de la
versión del contrato HTTP (`/v1`).

## [Unreleased]

### Cambiado

- **Catálogo congelado:** las 443 bebidas tomadas de TheCocktailDB quedan en la migración
  `0011_seed_drinks_catalog.sql`. `pnpm db:migrate` crea las tablas y las siembra.
- **Sin dependencia de TheCocktailDB:** la variable nueva y obligatoria **`CATALOG_SOURCE`** vale
  `snapshot` por defecto, y en ese modo la API nunca llama a TheCocktailDB. `/health/ready` ya no
  la revisa, `GET /v1/admin/catalog` informa `mode` y la sincronización manual responde
  `409 CATALOG_SOURCE_DISABLED`. Con `CATALOG_SOURCE=cocktaildb` se sincroniza como antes.
- **Configuración:** las variables `COCKTAILDB_*` (salvo `COCKTAILDB_IMAGES_BASE_URL`) y
  `CATALOG_TTL_MS` solo se piden con `CATALOG_SOURCE=cocktaildb`.
- **Imágenes en Cloudinary:** las fotos de bebidas (443) e ingredientes (299) se copiaron a
  Cloudinary (`cocktailDB/`) con `scripts/upload-images-cloudinary.mjs`, y la migración
  `0012_images_cloudinary.sql` apunta el catálogo a ellas. Los tamaños `small/medium/large` salen
  de transformaciones de Cloudinary, en WebP o AVIF según el navegador.
- **Autocompletado:** la foto de un ingrediente sale del catálogo, no de una URL armada con la
  configuración. `COCKTAILDB_IMAGES_BASE_URL` solo se pide con `CATALOG_SOURCE=cocktaildb`.
- **Cuentas demo:** la migración `0013_seed_demo_users.sql` crea 7 cuentas con datos
  sintéticos, una por rol más un menor de edad. La premium trae historial, ADN y Cocktle, y el
  dueño de bar trae bar, inventario y plan Pro. Ver README, *Cuentas demo*.
- **Wompi en local:** la API no arranca si `PAYMENTS_PROVIDER=wompi` y `PAYMENTS_REDIRECT_URL`
  apunta a `localhost`, porque el firewall de Wompi bloquea ese checkout con un `403`. En local se
  usa `http://lvh.me:<puerto>/…`. Probado en sandbox con un pago PSE aprobado.
- **Guía de pagos:** `docs/pagos-wompi.md` documenta el flujo de Wompi pantalla por pantalla, los
  datos de prueba, los problemas comunes y el registro de pruebas en sandbox (PSE y tarjetas
  aprobada y rechazada).
- **Documentación:** los datos de las bebidas son gratis. Los planes pagos cubren solo funciones
  propias (bares, inventario, carta con márgenes y API keys de bares).

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

[4.0.0]: https://github.com/anvorja/api-crazy-drinks/compare/8e3d78c...release/4.0.0
[3.0.0]: https://github.com/anvorja/api-crazy-drinks/commit/8e3d78c
