using Lefarma.API.Features.Telemetria.Almacen;
using Lefarma.API.Features.Telemetria.Cola;
using Lefarma.API.Features.Telemetria.Escritor;

namespace Lefarma.API.Features.Telemetria;

/// <summary>Foto completa del módulo para el panel de estado.</summary>
public sealed record EstadoTelemetria(
    EstadoAlmacen Almacen,
    EstadoCola Cola,
    EstadoEscritor Escritor,
    DateTime ConsultadoEn);
