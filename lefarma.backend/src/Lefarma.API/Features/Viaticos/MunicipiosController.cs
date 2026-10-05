using Lefarma.API.Features.Viaticos.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.Viaticos;

[ApiController]
[Route("api/viaticos")]
[EndpointGroupName("Viaticos")]
[Authorize]
public class MunicipiosController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public MunicipiosController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("municipios")]
    [SwaggerOperation(
        Summary = "Obtener catálogo de municipios",
        Description = "Retorna los municipios de viaticos.municipios_cat (sincronizados desde OpenStreetMap con el job semanal SP_Jobs_ActualizaMunicipios). Opcionalmente acotado a un estado (codigoEstado).")]
    [SwaggerResponse(200, "Catálogo obtenido", typeof(ApiResponse<List<MunicipioDto>>))]
    public async Task<IActionResult> GetMunicipios([FromQuery] int? codigoEstado, CancellationToken ct)
    {
        var query = _context.Municipios.AsNoTracking().Where(m => m.Activo);
        if (codigoEstado.HasValue)
        {
            query = query.Where(m => m.CodigoEstado == codigoEstado.Value);
        }

        var catalogo = await query
            .OrderBy(m => m.Nombre)
            .Select(m => new MunicipioDto
            {
                IdMunicipio = m.IdMunicipio,
                CodigoEstado = m.CodigoEstado,
                Nombre = m.Nombre,
                ClaveMunicipio = m.ClaveMunicipio,
                Latitud = m.Latitud,
                Longitud = m.Longitud
            })
            .ToListAsync(ct);

        return Ok(new ApiResponse<List<MunicipioDto>>
        {
            Success = true,
            Message = "Catálogo de municipios obtenido exitosamente.",
            Data = catalogo
        });
    }
}
