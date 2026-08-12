using Lefarma.API.Features.Catalogos.Envios.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Catalogos.Envios;

[ApiController]
[Route("api/catalogos/envios")]
[EndpointGroupName("Catalogos")]
public class EnviosController : ControllerBase
{
    private readonly AsokamDbContext _asokam;
    private readonly ApplicationDbContext _db;

    public EnviosController(AsokamDbContext asokam, ApplicationDbContext db)
    {
        _asokam = asokam;
        _db = db;
    }

    /// <summary>
    /// Obtiene los folios de transporte externo disponibles (no usados en una orden activa).
    /// </summary>
    [HttpGet("transportes")]
    [SwaggerOperation(Summary = "Folios de transporte disponibles",
        Description = "Lista los enviosCab con tipoTraslado = 'transporte externo' que no estén ya usados en una orden de compra activa. Opcionalmente excluye una orden (modo edición) para que su folio actual siga disponible.")]
    public async Task<IActionResult> GetTransportesDisponibles([FromQuery] int? idOrden, CancellationToken ct)
    {
        var foliosUsados = await _db.OrdenesCompra
            .Where(o => o.FolioTransporte.HasValue
                && (!idOrden.HasValue || o.IdOrden != idOrden.Value))
            .Select(o => o.FolioTransporte!.Value)
            .ToListAsync(ct);

        var disponibles = await _asokam.EnviosCab
            .Where(e => e.TipoTraslado == "transporte externo")
            .Select(e => new TransporteDisponibleResponse(e.CodigoEnvio, e.NombreTraslado))
            .ToListAsync(ct);

        disponibles = disponibles
            .Where(d => !foliosUsados.Contains(d.CodigoEnvio))
            .OrderBy(d => d.NombreTraslado)
            .ToList();

        return Ok(new ApiResponse<List<TransporteDisponibleResponse>>
        {
            Success = true,
            Message = "Folios de transporte obtenidos",
            Data = disponibles
        });
    }
}
