namespace Lefarma.API.Features.Catalogos.Envios.DTOs;

public record TransporteDisponibleResponse(
    int CodigoEnvio,
    string? NombreTraslado
);
