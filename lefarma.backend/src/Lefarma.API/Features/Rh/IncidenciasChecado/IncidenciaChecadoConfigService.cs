using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Features.Rh.IncidenciasChecado.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Helpers;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Rh.IncidenciasChecado;

public class IncidenciaChecadoConfigService : IIncidenciaChecadoConfigService
{
    private readonly ApplicationDbContext _context;

    public IncidenciaChecadoConfigService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task EnriquecerDescuentosAsync(
        List<IncidenciaChecadoResponse> items,
        CancellationToken cancellationToken = default)
    {
        var evaluables = items
            .Select((i, idx) =>
            {
                var (entro, salio, checoEntrada, checoSalida) = CalcularChecadasReales(
                    i.Entrada, i.Salida, i.Entro, i.Salio);

                return new ItemEvaluable
                {
                    Fecha = i.Fecha,
                    Nomina = i.Nomina ?? 0,
                    OrdenOriginal = idx,
                    Entrada = i.Entrada,
                    Salida = i.Salida,
                    Entro = entro,
                    Salio = salio,
                    ChecoEntrada = checoEntrada,
                    ChecoSalida = checoSalida,
                    SetDescuento = v => i.Descuento = v,
                    AgregarTipoIncidencia = t => i.IncidenciasCalculadas.Add(t)
                };
            })
            .ToList();

        await EnriquecerInternoAsync(evaluables, cancellationToken);
    }

    public async Task EnriquecerDescuentosAsync(
        List<NotificarIncidenciaItemRequest> items,
        CancellationToken cancellationToken = default)
    {
        var evaluables = items
            .Select((i, idx) =>
            {
                var entrada = ParseTimeSpan(i.Entrada);
                var salida = ParseTimeSpan(i.Salida);
                var entro = ParseTimeSpan(i.Entro);
                var salio = ParseTimeSpan(i.Salio);

                var (entroReal, salioReal, checoEntrada, checoSalida) = CalcularChecadasReales(
                    entrada, salida, entro, salio);

                return new ItemEvaluable
                {
                    Fecha = i.Fecha,
                    Nomina = i.Nomina,
                    OrdenOriginal = idx,
                    Entrada = entrada,
                    Salida = salida,
                    Entro = entroReal,
                    Salio = salioReal,
                    ChecoEntrada = checoEntrada,
                    ChecoSalida = checoSalida,
                    SetDescuento = v => i.Descuento = v,
                    AgregarTipoIncidencia = t => i.IncidenciasCalculadas.Add(t)
                };
            })
            .ToList();

        await EnriquecerInternoAsync(evaluables, cancellationToken);
    }

    private static (TimeSpan? Entro, TimeSpan? Salio, bool ChecoEntrada, bool ChecoSalida) CalcularChecadasReales(
        TimeSpan? entradaOficial,
        TimeSpan? salidaOficial,
        TimeSpan? entro,
        TimeSpan? salio)
    {
        if (entro.HasValue && salio.HasValue && entro == salio)
        {
            var unica = entro.Value;
            var diffEntrada = entradaOficial.HasValue
                ? Math.Abs((unica - entradaOficial.Value).TotalMinutes)
                : double.MaxValue;
            var diffSalida = salidaOficial.HasValue
                ? Math.Abs((unica - salidaOficial.Value).TotalMinutes)
                : double.MaxValue;

            if (diffEntrada <= diffSalida)
            {
                return (entro, null, true, false);
            }

            return (null, salio, false, true);
        }

        var checoEntrada = entro.HasValue && (!salio.HasValue || entro != salio);
        var checoSalida = salio.HasValue && (!entro.HasValue || entro != salio);

        return (checoEntrada ? entro : null, checoSalida ? salio : null, checoEntrada, checoSalida);
    }

    private async Task EnriquecerInternoAsync(
        List<ItemEvaluable> items,
        CancellationToken cancellationToken)
    {
        if (items.Count == 0)
            return;

        var reglas = await _context.IncidenciasChecadoConfig
            .AsNoTracking()
            .Where(r => r.Activo)
            .OrderByDescending(r => r.Prioridad)
            .ToListAsync(cancellationToken);

        if (reglas.Count == 0)
            return;

        var conRegla = items
            .SelectMany(i => ClasificarReglas(i, reglas).Select(r => new { Item = i, Regla = r }))
            .ToList();

        var agrupados = conRegla
            .GroupBy(x => new
            {
                x.Item.Nomina,
                x.Regla.IdConfig,
                Periodo = PeriodoHelper.ObtenerPeriodoActual(x.Item.Fecha, x.Regla.Periodo)
            });

        foreach (var grupo in agrupados)
        {
            var regla = grupo.First().Regla;
            var ordenados = grupo
                .OrderBy(x => x.Item.Fecha)
                .ThenBy(x => x.Item.OrdenOriginal)
                .ToList();

            var cantidadParaDescuento = Math.Max(1, regla.CantidadAcumulada);

            for (var i = 0; i < ordenados.Count; i++)
            {
                var generaDescuento = ((i + 1) % cantidadParaDescuento) == 0;

                ordenados[i].Item.AgregarTipoIncidencia(new IncidenciaCalculadaDto
                {
                    TipoIncidencia = regla.TipoIncidencia,
                    Nombre = regla.Nombre,
                    GeneraDescuento = generaDescuento
                });

                if (generaDescuento)
                {
                    ordenados[i].Item.SetDescuento(true);
                }
            }
        }
    }

    private static List<IncidenciaChecadoConfig> ClasificarReglas(
        ItemEvaluable item,
        List<IncidenciaChecadoConfig> reglas)
    {
        var coincidencias = new List<IncidenciaChecadoConfig>();

        foreach (var regla in reglas)
        {
            if (ReglaCoincide(item, regla))
            {
                coincidencias.Add(regla);
            }
        }

        return coincidencias;
    }

    private static bool ReglaCoincide(ItemEvaluable item, IncidenciaChecadoConfig regla)
    {
        switch (regla.TipoIncidencia)
        {
            case "TARDANZA_ENTRADA":
                return item.ChecoEntrada &&
                       item.Entrada.HasValue &&
                       item.Entro.HasValue &&
                       MinutosEnRango((int)(item.Entro.Value - item.Entrada.Value).TotalMinutes, regla.MinutosMin, regla.MinutosMax);

            case "TARDANZA_SALIDA":
                return item.ChecoSalida &&
                       item.Salida.HasValue &&
                       item.Salio.HasValue &&
                       MinutosEnRango((int)(item.Salio.Value - item.Salida.Value).TotalMinutes, regla.MinutosMin, regla.MinutosMax);

            case "SALIDA_ANTICIPADA":
                return item.ChecoSalida &&
                       item.Salida.HasValue &&
                       item.Salio.HasValue &&
                       item.Salio.Value < item.Salida.Value &&
                       MinutosEnRango((int)(item.Salida.Value - item.Salio.Value).TotalMinutes, regla.MinutosMin, regla.MinutosMax);

            case "OMISION_ENTRADA":
                return regla.RegistroEntrada &&
                       item.Entrada.HasValue &&
                       !item.ChecoEntrada;

            case "OMISION_SALIDA":
                return regla.RegistroSalida &&
                       item.Salida.HasValue &&
                       !item.ChecoSalida;

            default:
                return false;
        }
    }

    private static bool MinutosEnRango(int minutos, int? min, int? max)
    {
        if (minutos <= 0)
            return false;
        if (min.HasValue && minutos < min.Value)
            return false;
        if (max.HasValue && minutos > max.Value)
            return false;
        return true;
    }

    private static TimeSpan? ParseTimeSpan(string? valor)
    {
        if (TimeSpan.TryParse(valor, out var ts))
            return ts;
        return null;
    }

    private class ItemEvaluable
    {
        public DateTime Fecha { get; set; }
        public long Nomina { get; set; }
        public int OrdenOriginal { get; set; }
        public TimeSpan? Entrada { get; set; }
        public TimeSpan? Salida { get; set; }
        public TimeSpan? Entro { get; set; }
        public TimeSpan? Salio { get; set; }
        public bool ChecoEntrada { get; set; }
        public bool ChecoSalida { get; set; }
        public Action<bool> SetDescuento { get; set; } = _ => { };
        public Action<IncidenciaCalculadaDto> AgregarTipoIncidencia { get; set; } = _ => { };
    }
}
