# viaticos-capturas

Servicio HTTP (Traefik + Docker) que **captura pantallas** de sitios externos y
**cotiza autobuses** con datos del adapter público de ClickBus, devolviendo un JSON
listo para importar en el wizard de viáticos.

Corre en `capturas.app.grupolefarma.com.mx` (servidor `192.168.6.4`, puerto SSH `8022`,
usuario `brandom`), detrás del Traefik ya instalado (`traefik-puro`, red `traefik-puro-test`).

## Endpoints

Todas las rutas `/v1/*` exigen el header `x-api-key: <API_KEY>`. `/health` y `/c/*` son públicas.

| Método y ruta | Qué hace |
|---|---|
| `GET /health` | Estado, versión, si Chromium está listo y si el modo agéntico está habilitado. |
| `POST /v1/capturar` | Captura una URL: `{url, nombre?, esperar_texto?, selector?, esperar_ms?, full_page?, ancho?, alto?}`. Devuelve `archivo`, `url`, `bytes`, `ancho`, `alto`, `ms`. |
| `POST /v1/capturas` | Hasta 10 URLs en una llamada: `{urls: ["...", {...}]}`. |
| `POST /v1/cotizar` | Cotiza autobuses y devuelve el JSON del contrato v1.0.0 (ver abajo). Acepta origen/destino como texto, como `slug` o como **coordenadas**. |
| `POST /v1/cotizar?detalle=1` | Igual, pero envuelve `{ok, cotizacion, detalle}` con slugs, terminales, asientos, duraciones, capturas y cómo se resolvió cada punto (`resuelto_por`, `coordenadas`, `distancia_km`). |
| `GET /v1/lugares?q=Durango` | Resuelve texto libre a lugares del catálogo de ClickBus (slug + sugerencias). |
| `GET /v1/lugares?lat=24.0277&lng=-104.6532` | Resuelve unas **coordenadas** al lugar de ClickBus más cercano (también acepta `latitud`/`longitud` o `q=lat,lng`). |
| `POST /v1/agentico/capturar` | Opcional (requiere `ENABLE_AGENTICO=1` y `OPENCODE_MODEL`): deja que OpenCode + Playwright MCP navegue y capture. |
| `GET /c/:archivo` | Sirve la captura PNG guardada en el volumen `/data`. |

### Contrato de `/v1/cotizar`

Cumple `lefarma.docs/viaticos/schemas/cotizacion-viajes.schema.json` (v1.0.0,
`additionalProperties: false`): `version`, `consulta`, `cobertura_declarada`,
`transportistas_no_encontrados` y `opciones[]` con `transportista`, `modo`
(`autobus`), `salida`/`llegada` ISO con zona, `precio`, `moneda`, `url_compra`,
`capturas[]`, `fuente`, `consultado_en`. El wizard ya importa este formato: guarda
`capturas[0]` como `ruta_captura` y pinta URLs externas tal cual.

Ejemplo (coordenadas, como las manda el wizard):

```bash
curl -s -X POST http://127.0.0.1:8099/v1/cotizar \
  -H "content-type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"origen":{"latitud":19.4326,"longitud":-99.1332},"destino":{"latitud":24.0277,"longitud":-104.6532},"fecha_salida":"2026-10-28","personas":1}' \
  | jq .
```

También acepta `[lat,lng]`, `{lat,lng}`, `"lat,lng"` o `origen_lat`/`origen_lng`
(campos sueltos). La resolución de coordenadas primero busca la terminal más cercana
(radio `RADIO_DIRECTO_KM`, 40 km) y prefiere el grupo "Todas Las Terminales" de esa
ciudad; si la ciudad no tiene terminales con coordenadas (p. ej. Durango), hace
geocodificación inversa con Nominatim y resuelve por nombre de ciudad. En la respuesta,
`consulta.origen`/`consulta.destino` siguen siendo texto (el nombre resuelto).

## Despliegue

```bash
# En el servidor (o por scp -P 8022):
mkdir -p /home/brandom/apps/viaticos-capturas
scp -P 8022 -r ./* brandom@192.168.6.4:/home/brandom/apps/viaticos-capturas/
cp .env.example .env && nano .env   # poner API_KEY real
docker compose build               # ~2-4 min (descarga Chromium + deps)
docker compose up -d
curl -s http://127.0.0.1:8099/health | jq .
```

Traefik toma el router por labels (`Host(\`capturas.app.grupolefarma.com.mx\`)`,
`priority=30`, `certresolver=letsencrypt`); el certificado se emite solo en la
primera petición por HTTPS. La app no publica puertos al host: solo es alcanzable
por la red de Traefik.

## Integración con el wizard

1. El backend (o cualquier cliente) llama `POST /v1/cotizar` con origen, destino, fecha
   y personas; origen/destino pueden ser texto, slug o coordenadas (`latitud`/`longitud`).
2. Ese JSON se importa en el wizard de viáticos (mismo formato que produce el agente `pi`).
3. Las capturas quedan en `capturas[]` como URLs públicas
   `https://capturas.app.grupolefarma.com.mx/c/<archivo>.png`; la tabla las muestra
   en la columna **Captura** sin más cambios.

## Límites conocidos

- ClickBus **no vende** Primera Plus, ADO GL/Platino ni ETN Turistar; para esas líneas
  hace falta captura directa por sitio o el modo agéntico. Tampoco cubre vuelos ni hoteles.
- Coordenadas **fuera de México** se rechazan con `422` (`fuera_de_mexico: true`): el
  catálogo de ClickBus es mexicano.
- `GET /c/*` es pública (las URLs son aleatorias). Si se quiere proteger, conviene
  firmar las URLs o poner `forwardAuth` en Traefik.
- El modo agéntico necesita credenciales de un proveedor con crédito dentro del
  contenedor (`/data/home/.config/opencode/` + `auth.json`, `HOME=/data/home`).
  Ojo: Token Harbor está en $0.

## Desarrollo local

```bash
npm install
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright npx playwright install chromium
API_KEY=dev PORT=8099 BASE_URL=http://localhost:8099 node server.js
```
