using Lefarma.API.Features.Telemetria.Almacen;
using Lefarma.API.Features.Telemetria.Cola;
using Lefarma.API.Features.Telemetria.Escritor;

namespace Lefarma.API.Features.Telemetria;

public sealed record EstadoTelemetria(
    EstadoAlmacen Almacen,
    EstadoCola Cola,
    EstadoEscritor Escritor,
    DateTime ConsultadoEn);
