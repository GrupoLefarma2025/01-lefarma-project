using ErrorOr;
using Lefarma.API.Features.Catalogos.Monedas.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Catalogos.Monedas;

public class MonedaService : BaseService, IMonedaService
{
    private readonly ApplicationDbContext _context;
    protected override string EntityName => "Moneda";

    public MonedaService(ApplicationDbContext context, IWideEventAccessor wideEventAccessor)
        : base(wideEventAccessor)
    {
        _context = context;
    }

    public async Task<ErrorOr<IEnumerable<MonedaResponse>>> GetAllActivasAsync()
    {
        try
        {
            var monedas = await _context.Monedas
                .Where(m => m.Activo)
                .OrderByDescending(m => m.EsDefault)
                .ThenBy(m => m.Nombre)
                .Select(m => new MonedaResponse
                {
                    IdMoneda = m.IdMoneda,
                    Codigo = m.Codigo,
                    Nombre = m.Nombre,
                    Simbolo = m.Simbolo,
                    Locale = m.Locale,
                    TipoCambio = m.TipoCambio,
                    EsDefault = m.EsDefault,
                    Activo = m.Activo
                })
                .ToListAsync();

            EnrichWideEvent("GetAll", count: monedas.Count);
            return monedas;
        }
        catch (Exception ex)
        {
            EnrichWideEvent("GetAll", exception: ex);
            return CommonErrors.InternalServerError("Error al obtener las monedas.");
        }
    }
}
