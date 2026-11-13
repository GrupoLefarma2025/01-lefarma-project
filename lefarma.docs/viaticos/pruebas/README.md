# Banco de pruebas de links de viáticos

Este folder no forma parte del sistema. Sirve para probar links, precios y capturas de vuelos, hoteles y autobuses sin tocar el backend ni el frontend.

Para probar rutas de forma interactiva (vuelo/autobús + hotel + capturas), usa el cotizador CLI en `../cotizador-cli/cotizador.cmd`.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `links-viaticos.json` | Fuente de verdad. Casos, links actuales, candidatos, resultados, capturas y decisiones. |
| `links-viaticos.md` | Vista humana generada desde el JSON. Aquí puedes abrir los links y ver el estado. |
| `links-viaticos.schema.json` | Esquema de validación del JSON. |
| `evidencias/` | Capturas PNG de las pruebas. |
| `../../lefarma.frontend/scripts/probar-links.mjs` | Script opcional de Playwright. Solo prueba candidatos `pendiente`. |

## Cómo leer las pruebas

1. Abre `links-viaticos.md`.
2. En el resumen ves el caso, la ruta, la fecha, el precio actual y el link actual del sistema.
3. En cada caso, la tabla de candidatos muestra: proveedor, link, estado, precio visible, resultado, captura y si el sistema puede capturarlo.
4. La columna `Capturable` indica si la política actual lo permite (`sí`/`no`) y el estado observado.
5. Las capturas se abren desde la columna `Captura` o desde `evidencias/`.
6. La columna `Disponibilidad` muestra el conteo que publica el buscador (vuelos, hoteles o asientos). Es indicativo y puede incluir resultados de la zona; no es una reserva.

## Estados

| Estado | Significado |
|---|---|
| `ok` | La página carga y muestra resultados o precios de la ruta/ciudad. |
| `sin_resultados` | La página carga pero no muestra resultados para la ruta/fecha, o muestra otra ciudad. |
| `error` | La página muestra un error explícito. |
| `timeout` | La navegación no terminó en el tiempo límite. |
| `captcha` | El sitio pide captcha o validación anti-bot. |
| `bloqueado` | El sitio bloquea el acceso (403/denegado). |
| `no_aplica` | No se puede construir el link o no hay deep link verificado. |
| `implementado` | El patrón ya se llevó al sistema. |

## Disponibilidad

| Valor | Significado |
|---|---|
| `disponible` | El buscador mostró resultados o un conteo para la ruta/fecha. |
| `no_disponible` | El buscador no mostró resultados para la ruta/fecha. |
| `no_verificable` | El link no ejecutó la búsqueda, el sitio bloqueó/captcha, o la página no es de disponibilidad. |

Google Flights es intermitente: la misma URL puede devolver resultados, “sin resultados” o la portada en corridas distintas. Kayak fue el más consistente en las pruebas.

## Fechas

Las fechas de los casos se movieron a diciembre de 2026 para que los proveedores devuelvan resultados. Varias solicitudes reales tenían fechas ya pasadas. El campo `fecha_original` conserva la fecha real de la solicitud y los precios de `sistema_actual` son el snapshot histórico, no el precio del día de la prueba.

## Cómo agregar un caso

1. Copia un bloque de `casos` en `links-viaticos.json`.
2. Cambia `id`, `tipo`, `descripcion`, `entrada` y `sistema_actual`.
3. Agrega candidatos con un `proveedor` de `proveedores` o con un link explícito.
4. Ejecuta `node scripts/probar-links.mjs --md-only` desde `lefarma.frontend` para regenerar el MD.
5. Prueba los links manualmente y actualiza `estado`, `resultado`, `precio_visible`, `captura` y `fecha_prueba`.

## Cómo probar con Playwright

El script vive en `lefarma.frontend/scripts/probar-links.mjs` y usa Playwright. Se ejecuta desde `lefarma.frontend`.

```powershell
node scripts/probar-links.mjs --md-only
node scripts/probar-links.mjs --case vuelo-mex-mty-2026-11-10
node scripts/probar-links.mjs --proveedor kayak_vuelos
node scripts/probar-links.mjs --case bus-cdmx-xalapa-2026-11-20 --force
```

Opciones:

| Opción | Uso |
|---|---|
| `--md-only` | Solo regenera el MD; no abre el navegador. |
| `--case <id>` | Prueba un solo caso. |
| `--proveedor <id>` | Prueba un solo proveedor. |
| `--force` | Repite candidatos ya probados. |
| `--no-captura` | No genera PNG. |
| `--timeout <ms>` | Timeout de navegación (default 45000). |
| `--wait <ms>` | Espera después de cargar (default 15000). |

El script usa Chrome o Edge instalado en Windows. No usa el navegador de Playwright descargado.

## Capturas

- ClickBus: capturable; algunas rutas tardan más de 10 s en pintar viajes.
- Primera Plus: capturable con `domcontentloaded`; con `networkidle` da timeout.
- Google Flights: capturable cuando la búsqueda se ejecuta; en varias rutas cae en portada o “sin resultados”.
- Kayak: capturable; puede pedir validación anti-bot.
- Google Hotels: capturable; la búsqueda por ciudad es más estable que la de hotel.
- Booking: **no capturable** por `CapturasService.HardBannedDomains` (`booking.com`). Además, la búsqueda por nombre puede resolver otra ciudad.
- Aeroméxico: bloqueado (Access Denied).
- Skyscanner: captcha.

## Cambios al sistema

Las propuestas están en la sección **Decisiones globales** y **Cambios al sistema** del MD. No se aplicó ningún cambio al backend ni al frontend; este folder es solo el banco de pruebas.
