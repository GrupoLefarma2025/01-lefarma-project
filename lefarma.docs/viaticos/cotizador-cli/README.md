# Cotizador CLI de viáticos

Mini programa de consola para probar rutas, vuelos, autobuses y hoteles sin abrir el sistema. Cada prueba genera su propia carpeta con JSON, TXT y capturas.

## Requisitos

- Node.js 18 o superior.
- Playwright instalado en `lefarma.frontend`.
- Chrome o Edge instalado en Windows.

## Cómo ejecutar

Doble clic en `cotizador.cmd`, o desde consola:

```powershell
cd lefarma.docs\viaticos\cotizador-cli
node cotizador.mjs
```

Modo demo (sin preguntas, usa CDMX → Guadalajara, Kayak y Booking.com):

```powershell
node cotizador.mjs --demo
node cotizador.mjs --demo-bus
node cotizador.mjs --demo-pp
```

Ver el navegador mientras corre:

```powershell
node cotizador.mjs --headful
```

## Flujo

1. Eliges ciudad de origen y destino (número, nombre o IATA).
2. Eliges fecha de ida y, si aplica, fecha de vuelta.
3. Eliges medio: vuelo o autobús.
4. Eliges proveedor:
   - Vuelo: Kayak (recomendado) o Google Flights.
   - Autobús: ClickBus (recomendado) o Primera Plus (solo si hay slug).
5. El programa busca, muestra opciones y tú eliges una.
6. Si es ida y vuelta, repite la búsqueda para el regreso.
7. Eliges noches de hotel y seleccionas un hotel de Booking.com. La tabla muestra rating, distancia al centro, precio por noche y total cuando Booking los publica.
8. Se genera la cotización en `cotizaciones/<id>/`.

## Salida

```
cotizaciones/
└── cotizacion-20261111-143000-ciudad-de-mexico-guadalajara/
    ├── cotizacion.json
    ├── cotizacion.txt
    └── capturas/
        ├── ida-opciones.png
        ├── ida-elegido.png
        ├── vuelta-opciones.png
        ├── vuelta-elegido.png
        ├── hotel-opciones.png
        └── hotel-elegido.png
```

El JSON incluye consulta, tramos, hotel, precios, disponibilidad, links y capturas. El TXT es el resumen legible. En hotel se agregan rating, distancia, zona y habitaciones disponibles cuando el buscador los publica.

## Notas

- Los precios y la disponibilidad son los que muestra el buscador al momento; no son una reserva.
- Kayak es el proveedor de vuelos más consistente en las pruebas. Google Flights puede alternar entre resultados, “sin resultados” y portada.
- ClickBus puede tardar más de 10 segundos en pintar los viajes; el programa espera 15 segundos.
- El CLI usa Booking.com para hoteles porque aplica las fechas por URL. Google Hotels se prueba en el banco de links (`../pruebas/links-viaticos.md`), pero su calendario es frágil para automatización.
- En Booking, el precio de la tarjeta es de toda la estancia; el CLI lo divide entre las noches. Revisa la captura si el precio parece raro.
- Booking.com se usa en el CLI porque aplica las fechas por URL. El sistema tiene prohibida su captura; este CLI es solo para pruebas y no forma parte de la aplicación.
- Si no se pueden leer opciones, el programa ofrece capturarlas manualmente y deja la captura de la página.
- Para agregar ciudades o corregir slugs, edita `ciudades.json`.
- El CLI intenta cerrar el modal "Inicia sesión y ahorra" de Booking antes de capturar. Si reaparece, la captura puede mostrarlo.
- Las carpetas que ya están en `cotizaciones/` son ejemplos de las demos; puedes borrarlas.
- Los detalles que aplican al backend/frontend (modal de Booking, fechas, precios, cercanía, capturas) están en `NOTAS-BACKEND.md`.
- Este programa no modifica el backend ni el frontend; solo escribe en `cotizaciones/`.
