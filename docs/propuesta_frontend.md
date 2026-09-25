# Propuesta de frontend

> **Estado:** propuesta. El frontend **todavía no se implementa**. Este documento guarda las ideas
> de recorrido, pantallas e identidad visual para cuando se construya. La API (versión 5.0.0) ya
> ofrece todo lo que se describe aquí.

## Stack previsto

**React + Vite + TypeScript + shadcn/ui**, en un repositorio aparte (por ejemplo
`crazy-drinks-web`) con el mismo Gitflow que la API.

| Pieza | Para qué |
| ----- | -------- |
| **Vite** | Servidor de desarrollo en el puerto **5173**, el que la API ya asume en CORS y en el retorno de Wompi |
| **TypeScript + `openapi-fetch`** | Cliente tipado a partir de `openapi/api.d.ts` de la API, sin escribir tipos a mano |
| **TanStack Query** | Caché, reintentos y scroll infinito (`nextCursor` de `GET /v1/drinks`) |
| **React Router** | Rutas, incluida `/pago/resultado`, la página de retorno de Wompi |
| **shadcn/ui + Tailwind** | Componentes accesibles que se copian al proyecto y se adaptan a la identidad visual |
| **Framer Motion** (opcional) | Gestos y animaciones del swipe |

**En desarrollo, todo en `lvh.me`:**
- abrir `http://lvh.me:5173`;
- `VITE_API_URL=http://lvh.me:8090`;
- `CORS_ORIGINS=http://lvh.me:5173` en la API.

Si no, al volver de un pago la sesión se pierde; ver [pagos-wompi.md](pagos-wompi.md),
*Frontend en local*. Todas las peticiones de `/v1/auth` van con `credentials: 'include'`, y al
cargar la app se llama a `POST /v1/auth/refresh` para recuperar la sesión.

## Recorrido de la demo

Pensado para mostrar la app en la evaluación en unos 10 minutos, de lo más visible a lo más
técnico. Cada paso usa una cuenta demo (contraseña `ApiDrinks2026`; ver README, *Cuentas demo*).

| # | Paso | Cuenta | Qué se muestra | Endpoints |
| - | ---- | ------ | -------------- | --------- |
| 1 | **Explorar** | Sin sesión | Grilla con scroll infinito, filtros combinables, autocompletado tolerante a errores ("margarta") y el coctel del día. Sin sesión solo aparecen bebidas sin alcohol | `GET /v1/drinks`, `/drinks/facets`, `/drinks/suggest`, `/drinks/of-the-day`, `/drinks/{id}` |
| 2 | **Login** | `premium@api-drinks.local` | Al entrar como adulto aparecen las bebidas con alcohol. Contraste: `menor@…` recibe `403 AGE_RESTRICTED` | `POST /v1/auth/login`, `GET /v1/auth/me` |
| 3 | **Swipe** | premium | Mazo de tarjetas: 70 % afín al gusto y 30 % de exploración. Like, dislike, superlike y deshacer | `GET /v1/discover/deck`, `PUT/DELETE /v1/discover/{drinkId}`, `/discover/stats` |
| 4 | **ADN de sabor** | premium | Radar de 9 sabores, personalidad ("Espíritu ácido y rebelde con alma frutal"), ingredientes favoritos y recomendaciones con razones | `GET /v1/me/taste`, `/me/taste/recommendations` |
| 5 | **Tarjeta compartible** | premium | Enlace público, tarjeta PNG de 1200×630 lista para redes y compatibilidad con un amigo, con cocteles puente | `PUT /v1/me/taste/share`, `GET /v1/taste/{slug}`, `/taste/{slug}/card.png`, `/me/taste/compatibility/{slug}` |
| 6 | **Cocktle** | premium | Reto diario con pistas progresivas y termómetro (🟩🟨🟧🟥), rachas y resultado compartible sin spoilers. Modo `zero` sin alcohol | `GET /v1/cocktle/today`, `POST /cocktle/today/guesses`, `/cocktle/stats` |
| 7 | **Plan Pro con Wompi** | `basico@api-drinks.local` | Comparar planes, pagar en el sandbox (tarjeta `4242…` o PSE), volver y ver el plan activo | `GET /v1/plans`, `POST /me/subscription/checkout`, `/me/payments/verify`, `GET /me/subscription` |
| 8 | **Carta del bar** | `bar@api-drinks.local` | "La Barra Demo": qué cocteles puede servir con su inventario, con costo, precio sugerido y margen, y qué comprar para ampliar la carta | `GET /v1/venues/mine`, `/venues/{id}/inventory`, `/venues/{id}/menu` |

**Extras si sobra tiempo:**
- despensa inteligente (`/lab/pantry`) y cocteles por estado de ánimo (`/lab/moods/{mood}`);
- gemelos de una bebida (`/drinks/{id}/twins`);
- panel de admin (`admin.demo@…`).

## Mapa de pantallas

```
/                       Inicio: coctel del día, buscador y accesos a Swipe, Cocktle y Lab
/explorar               Grilla con filtros (facetas) y scroll infinito
/bebida/:id             Detalle: receta ES/EN, ingredientes con foto, ADN de la bebida y gemelas
/descubrir              Swipe
/mi-adn                 Mi ADN, recomendaciones, compartir y compatibilidad
/adn/:slug              ADN público de otra persona (sin sesión) y "¿qué tan compatibles somos?"
/cocktle                Reto del día (clásico / zero) y estadísticas
/lab                    Despensa y moods
/planes                 Planes y checkout
/pago/resultado         Retorno de Wompi: refresh de sesión + verify + estado del pago
/mi-bar/:id             Inventario y carta inteligente (venue_owner)
/cuenta                 Perfil, contraseña, favoritos, historial de pagos y borrar cuenta
/entrar, /registro      Login y registro (con fecha de nacimiento)
/restablecer-contrasena Destino del correo de recuperación (PASSWORD_RESET_URL)
```

## Identidad visual

### Nombre y tono

- **Crazy Drinks**, como el repositorio.
- **Tagline**, la que ya usa la API: *"No te decimos qué tomar: te decimos quién eres cuando lo
  tomas."*
- **Tono:** cercano, con humor y en español. Sin asumir el género de quien usa la app: la API ya
  habla en lenguaje neutro ("Espíritu…", "Paladar…").

### Paleta

Parte de la tarjeta de ADN que ya genera la API, para que la app y lo que se comparte en redes se
vean como una sola marca. **Modo oscuro por defecto**, con ambiente de bar de noche.

| Token | Color | Uso |
| ----- | ----- | --- |
| `--bg` | `#1b1036` | Fondo principal (morado noche) |
| `--bg-2` | `#4a1248` | Degradado de fondo y secciones destacadas (ciruela) |
| `--surface` | `#2a1a4a` | Tarjetas y paneles |
| `--primary` | `#ff7a59` | Botones y acciones principales (coral, el relleno del radar) |
| `--accent` | `#ffb86b` | Resaltados, rasgos dominantes y bordes activos (ámbar) |
| `--text` | `#ffffff` | Texto principal |
| `--muted` | `rgba(255,255,255,.6)` | Texto secundario |
| `--success` | `#2ecc71` | Like, pago aprobado, 🟩 |
| `--danger` | `#ff4d6d` | Dislike, rechazado, 🟥 |

- **Colores del termómetro de Cocktle:** 🟩 `#2ecc71`, 🟨 `#f1c40f`, 🟧 `#ff9f43`, 🟥 `#ff4d6d`.
- **Modo claro, si se hace:** fondo crema `#fff7ef`, texto `#1b1036` y el mismo coral y ámbar.

### Tipografía

- **Títulos:** *Space Grotesk*, geométrica y con carácter.
- **Texto:** *Inter*, muy legible en tamaños pequeños.
- **Carga:** las dos desde Google Fonts o empaquetadas.
- **Tarjeta PNG:** usa DejaVu Sans por limitaciones del render en el servidor; no hace falta
  igualarla.

### Logo (idea)

- **Símbolo:** una **copa de cóctel** cuyo líquido es un **radar de sabor** (el polígono del ADN),
  en coral con borde ámbar sobre el morado.
- **Versión corta,** para favicon e ícono de app: solo la copa con el radar.
- **Wordmark:** "Crazy Drinks" en Space Grotesk, con "Crazy" en ámbar ligeramente inclinado.

### Componentes clave

| Componente | Idea |
| ---------- | ---- |
| **DrinkCard** | Foto `images.medium` (Cloudinary, WebP o AVIF), nombre, categoría en español y chips de sabores dominantes. Esqueleto de carga con el mismo tamaño |
| **SwipeCard** | Foto a pantalla completa con degradado inferior y nombre grande. Arrastrar a la derecha es like (borde verde), a la izquierda dislike (rojo) y hacia arriba superlike (ámbar con destello). Botones equivalentes para accesibilidad y botón deshacer |
| **DnaRadar** | El radar de 9 ejes dibujado en el cliente (SVG), animado al cargar, con los rasgos dominantes en ámbar, igual que la tarjeta. Al tocar un eje se ve su valor |
| **DnaShareCard** | Vista previa de `card.png` con botones para copiar el enlace, descargar y compartir (Web Share API en móvil) |
| **CompatibilityMeter** | Porcentaje grande, titular ("Muy compatibles…") y carrusel de cocteles puente |
| **CocktleBoard** | Seis intentos. Cada intento es una fila con su color de termómetro, ingredientes compartidos y si coinciden categoría y vaso. Las pistas se revelan una a una. Al terminar: rachas, distribución y botón de compartir |
| **PlanCard** | Precio en COP, límites del plan y un botón que abre el checkout de Wompi |
| **MenuTable** | Carta del bar: coctel, costo, precio sugerido y margen, con color según el margen. Sección "Te falta poco" y consejos de compra |
| **AttributionFooter** | "Datos e imágenes: TheCocktailDB" con enlace, en todas las pantallas que muestran bebidas (**obligatorio**) |

### Estados que el diseño debe cubrir

- **Edad:** sin sesión o con menores de edad, un aviso amable en lugar de las bebidas con alcohol
  (`403 AGE_RESTRICTED`).
- **Plan:** `402 PLAN_LIMIT` abre un modal con el plan que lo incluye y el botón para pagarlo.
- **Límite de peticiones:** `429 RATE_LIMITED` muestra un mensaje breve y reintenta según
  `Retry-After`.
- **Pago pendiente:** con PSE, `/pago/resultado` muestra "Procesando…" y vuelve a verificar.
- **ADN vacío:** una cuenta nueva sin ADN invita a hacer swipe (`hint` de `GET /v1/me/taste`).
- **Errores:** el frontend decide por `code` y muestra su propio texto en español; `message` es
  solo una pista en inglés.

### Principios

- **Mobile first:** el swipe y el Cocktle se viven en el celular.
- **Accesibilidad:** contraste AA sobre el fondo morado, todo el swipe usable con teclado y
  botones, y textos alternativos en las fotos.
- **Consumo responsable:** la verificación de edad es visible, y un pie discreto dice
  "Disfruta con moderación".
