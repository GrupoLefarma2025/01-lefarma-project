using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.EducacionMedica;

internal static class EducacionMedicaNombres
{
    public static async Task<Dictionary<string, string>> ResolverEstadosAsync(
        AsokamDbContext asokam, IEnumerable<string?> codigos, CancellationToken ct)
    {
        var limpios = codigos
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Select(c => c!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (limpios.Count == 0)
        {
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        }

        var enteros = limpios
            .Select(c => int.TryParse(c, out var v) ? (int?)v : null)
            .Where(v => v.HasValue)
            .Select(v => v!.Value)
            .ToList();

        return await asokam.GenEstados
            .AsNoTracking()
            .Where(e => enteros.Contains(e.CodigoEstado))
            .ToDictionaryAsync(
                e => e.CodigoEstado.ToString(),
                e => e.NombreEstado ?? $"Estado {e.CodigoEstado}",
                StringComparer.OrdinalIgnoreCase,
                ct);
    }

    public static async Task<Dictionary<int, string>> ResolverProductosAsync(
        AsokamDbContext asokam, IEnumerable<string?> idsProducto, CancellationToken ct)
    {
        var ids = idsProducto
            .Where(i => !string.IsNullOrWhiteSpace(i))
            .Select(i => int.TryParse(i, out var v) ? (int?)v : null)
            .Where(v => v.HasValue)
            .Select(v => v!.Value)
            .Distinct()
            .ToList();

        if (ids.Count == 0)
        {
            return new Dictionary<int, string>();
        }

        return await asokam.Productos
            .AsNoTracking()
            .Where(p => ids.Contains(p.CodigoProducto))
            .ToDictionaryAsync(
                p => p.CodigoProducto,
                p => p.NombreInternoProducto ?? p.DescripcionCorta ?? $"Producto {p.CodigoProducto}",
                ct);
    }

    public static async Task<(Dictionary<string, string> Estados, Dictionary<int, string> Productos)> ResolverParaTalleresAsync(
        AsokamDbContext asokam, IEnumerable<Taller> talleres, CancellationToken ct)
    {
        var lista = talleres as IReadOnlyCollection<Taller> ?? talleres.ToList();
        var estados = await ResolverEstadosAsync(asokam, lista.Select(t => t.EntidadFederativa), ct);
        var productos = await ResolverProductosAsync(
            asokam, lista.SelectMany(t => t.Recursos).Select(r => r.IdProducto), ct);
        return (estados, productos);
    }
}
