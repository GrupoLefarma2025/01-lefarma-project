using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.EducacionMedica;

[ApiController]
[Route("api/educacion-medica/tipo-visita")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
[HasPermission(Permissions.EducacionMedica.TalleresVer)]
public class TipoVisitaController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public TipoVisitaController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    [SwaggerOperation(Summary = "Catálogo de tipos de visita")]
    [SwaggerResponse(200, "Tipos obtenidos", typeof(ApiResponse<List<TipoVisitaDto>>))]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var tipos = await _context.TiposVisita
            .AsNoTracking()
            .Where(t => t.Activo)
            .OrderBy(t => t.IdTipoVisita)
            .Select(t => new TipoVisitaDto
            {
                IdTipoVisita = t.IdTipoVisita,
                Clave = t.Clave,
                Descripcion = t.Descripcion,
            })
            .ToListAsync(ct);

        return Ok(new ApiResponse<List<TipoVisitaDto>>
        {
            Success = true,
            Message = "Tipos de visita obtenidos exitosamente.",
            Data = tipos,
        });
    }
}

public class TipoVisitaDto
{
    public int IdTipoVisita { get; set; }
    public string Clave { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
}
