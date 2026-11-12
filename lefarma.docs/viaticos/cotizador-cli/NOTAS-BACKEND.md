# Detalles del CLI a considerar en backend/frontend

Estas notas salen de las pruebas del cotizador CLI. No son cambios al sistema; son puntos a resolver cuando se implementen las mejoras de hoteles y evidencias.

## 1. Modal de Booking

En las capturas de hoteles aparece el modal:

> "Inicia sesión y ahorra. Inicia sesión para ahorrar 10% o más con una membresía gratis de Booking.com"

El modal tapa la lista de hoteles y el hotel elegido. Tiene un botón de cerrar (X).

- El CLI intenta cerrarlo antes de tomar la captura (`cerrarModalBooking`).
- El backend/frontend debe hacer lo mismo antes de guardar evidencia:
  - cerrar modales, cookies y avisos;
  - esperar a que desaparezcan;
  - reintentar si reaparecen;
  - o usar el agente de capturas con un paso explícito de cierre.
- Si no se cierra, la captura de evidencia muestra el modal en lugar del hotel.

## 2. Fechas de hotel

- Booking.com aplica `checkin` y `checkout` por URL.
- Google Hotels ignora esos parámetros en la URL: hay que fijar las fechas en el calendario.
- En las pruebas, Google Hotels no aplicó las fechas en Cuernavaca y en la ficha de un hotel específico.
- Si el sistema usa Google Hotels, debe fijar las fechas en la interfaz o usar una API de hoteles.

## 3. Precio de hotel

- Booking muestra el precio de toda la estancia; el CLI lo divide entre las noches para mostrar `precio_noche`.
- Hay que separar impuestos y cargos, y revisar promociones.
- El backend hoy usa el tabulador para todos los hoteles; si se integra Booking, el precio real y el tabulador deben quedar separados y etiquetados.

## 4. Cercanía, rating y disponibilidad

El CLI ahora muestra, cuando Booking lo publica:

- `rating` y `rating_count` (comentarios)
- `distancia_texto` (distancia al centro, p. ej. "5.3 km del centro")
- `zona`
- `disponibles` ("Nos quedan N a este precio")
- `precio_noche` y `precio_total`
- `habitaciones` (el CLI cotiza 1 habitación)

Esto se parece a los campos que ya expone `CostosRutaHotel` (`Habitaciones`, `DistanciaKm`, `Rating`, `RatingCount`, `PrecioNoche`, `PrecioTotal`, `Direccion`), pero **no son equivalentes**:

- Booking mide distancia al centro; el backend mide distancia al punto de destino con lat/lon.
- Booking puede dar rating de huéspedes; Google Places da rating de Google.
- La disponibilidad de Booking es un conteo del buscador; no es una reserva.

## 5. Capturas

- Booking está prohibido en `CapturasService.HardBannedDomains` (`booking.com`), pero el motor genera links de Booking. Hay que decidir la política.
- Primera Plus no llega a `networkidle`; usar `domcontentloaded` + espera de resultados.
- ClickBus a veces tarda más de 10 segundos en pintar viajes.
- Google Flights es intermitente: la misma URL puede devolver resultados, "sin resultados" o la portada.
- Kayak funciona, pero puede pedir validación anti-bot.

## 6. Disponibilidad

- Booking: "N alojamientos encontrados".
- ClickBus: asientos disponibles.
- Primera Plus: boletos disponibles.
- Son conteos del buscador, no una garantía de reserva.
