using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.EducacionMedica;

public class AsignadorEspecialistasService : IAsignadorEspecialistasService
{
    private readonly ApplicationDbContext _context;
    private readonly AsokamDbContext _asokamContext;

    public AsignadorEspecialistasService(ApplicationDbContext context, AsokamDbContext asokamContext)
    {
        _context = context;
        _asokamContext = asokamContext;
    }

    public async Task<bool> AsignarEspecialistaAsync(
        int idRutaVisita,
        AsignarEspecialistaVisitaRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        var visita = await _context.RutasVisitas
            .FirstOrDefaultAsync(v => v.IdRutaVisita == idRutaVisita, ct);
        if (visita is null)
        {
            return false;
        }

        var ruta = await _context.Rutas
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.IdRuta == visita.IdRuta, ct);
        var seleccion = ruta is null
            ? null
            : await _context.SeleccionesMensuales
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.IdSeleccionMensual == ruta.IdSeleccionMensual, ct);

        var hospital = visita.IdSeleccionHospital.HasValue
            ? await _context.SeleccionesHospitales
                .AsNoTracking()
                .FirstOrDefaultAsync(h => h.IdSeleccionHospital == visita.IdSeleccionHospital.Value, ct)
            : null;
        var region = hospital?.IdRegion.HasValue == true
            ? await _context.SeleccionesRegiones
                .AsNoTracking()
                .FirstOrDefaultAsync(r => r.IdRegion == hospital.IdRegion!.Value, ct)
            : null;

        await ValidarEspecialistaAsync(
            request.IdEspecialista, seleccion?.IdTipoGerencia, ct);

        var (maxDia, maxSemana) = await LeerCapacidadesAsync(ct);
        var (cargaDia, cargaSemana) = await ContarCargaAsync(
            request.IdEspecialista, visita.FechaVisita, idRutaVisita, ct);

        if (cargaDia >= maxDia)
        {
            throw new InvalidOperationException(
                $"El especialista ya tiene {cargaDia} visita(s) el {visita.FechaVisita:dd/MM/yyyy}; el máximo es {maxDia}.");
        }

        if (cargaSemana >= maxSemana)
        {
            throw new InvalidOperationException(
                $"El especialista ya tiene {cargaSemana} visita(s) esa semana; el máximo es {maxSemana}.");
        }

        visita.IdEspecialista = request.IdEspecialista;
        if (!visita.IdEjecutivo.HasValue)
        {
            visita.IdEjecutivo = hospital?.IdEjecutivo ?? region?.IdEjecutivo;
        }

        visita.IdUsuarioModificacion = idUsuario;
        visita.FechaModificacion = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);
        return true;
    }

    public async Task<List<SugerenciaEspecialistaDto>> GetSugerenciasAsync(
        int idSeleccionMensual,
        DateOnly? desde,
        DateOnly? hasta,
        CancellationToken ct = default)
    {
        var seleccion = await _context.SeleccionesMensuales
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.IdSeleccionMensual == idSeleccionMensual, ct);
        if (seleccion is null)
        {
            return [];
        }

        var inicio = desde ?? seleccion.FechaInicioVigencia ?? DateOnly.FromDateTime(DateTime.UtcNow);
        var fin = hasta ?? seleccion.FechaFinVigencia ?? inicio.AddDays(45);
        if (inicio > fin)
        {
            throw new InvalidOperationException("El rango de fechas es inválido.");
        }

        var idsRutas = await _context.Rutas
            .AsNoTracking()
            .Where(r => r.IdSeleccionMensual == idSeleccionMensual
                && r.Estado != Ruta.EstadoArchivada
                && r.Estado != Ruta.EstadoCancelada)
            .Select(r => r.IdRuta)
            .ToListAsync(ct);
        if (idsRutas.Count == 0)
        {
            return [];
        }

        var visitasSinEspecialista = await _context.RutasVisitas
            .AsNoTracking()
            .Where(v => idsRutas.Contains(v.IdRuta)
                && v.FechaVisita >= inicio
                && v.FechaVisita <= fin
                && v.IdEspecialista == null)
            .OrderBy(v => v.FechaVisita)
            .ThenBy(v => v.Orden)
            .ToListAsync(ct);
        if (visitasSinEspecialista.Count == 0)
        {
            return [];
        }

        var especialistasQuery = _context.EspecialistasGerencia
            .AsNoTracking()
            .Where(e => e.Activo);
        if (seleccion.IdTipoGerencia.HasValue)
        {
            especialistasQuery = especialistasQuery.Where(
                e => e.IdTipoGerencia == seleccion.IdTipoGerencia.Value);
        }

        var idsEspecialistas = await especialistasQuery
            .Select(e => e.IdUsuario)
            .Distinct()
            .ToListAsync(ct);
        if (idsEspecialistas.Count == 0)
        {
            return [];
        }

        var nombres = await _asokamContext.Usuarios
            .AsNoTracking()
            .Where(u => idsEspecialistas.Contains(u.IdUsuario))
            .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto ?? string.Empty, ct);

        var hospitalesSeleccion = await _context.SeleccionesHospitales
            .AsNoTracking()
            .Where(h => h.IdSeleccionMensual == idSeleccionMensual)
            .ToDictionaryAsync(h => h.IdSeleccionHospital, ct);

        var visitasEspecialistas = await _context.RutasVisitas
            .AsNoTracking()
            .Where(v => v.IdEspecialista.HasValue
                && v.FechaVisita >= inicio.AddDays(-1)
                && v.FechaVisita <= fin.AddDays(1))
            .ToListAsync(ct);

        var (maxDia, maxSemana) = await LeerCapacidadesAsync(ct);
        var sugerencias = new List<SugerenciaEspecialistaDto>();

        foreach (var visita in visitasSinEspecialista)
        {
            var hospital = visita.IdSeleccionHospital.HasValue
                && hospitalesSeleccion.TryGetValue(visita.IdSeleccionHospital.Value, out var h)
                ? h
                : null;
            var ciudad = hospital?.CiudadMunicipio;
            var inicioSemana = InicioSemana(visita.FechaVisita);
            var finSemana = inicioSemana.AddDays(6);

            SugerenciaEspecialistaDto? mejor = null;
            var mejorScore = int.MinValue;

            foreach (var idEspecialista in idsEspecialistas)
            {
                var visitas = visitasEspecialistas
                    .Where(v => v.IdEspecialista == idEspecialista)
                    .ToList();
                var cargaDia = visitas.Count(v => v.FechaVisita == visita.FechaVisita);
                var cargaSemana = visitas.Count(v => v.FechaVisita >= inicioSemana && v.FechaVisita <= finSemana);

                if (cargaDia >= maxDia || cargaSemana >= maxSemana)
                {
                    continue;
                }

                var mismaCiudadMismoDia = !string.IsNullOrWhiteSpace(ciudad)
                    && visitas.Any(v => v.FechaVisita == visita.FechaVisita
                        && CiudadDeVisita(v, hospitalesSeleccion) == ciudad);
                var mismaCiudadCerca = !string.IsNullOrWhiteSpace(ciudad)
                    && visitas.Any(v => Math.Abs(v.FechaVisita.DayNumber - visita.FechaVisita.DayNumber) <= 1
                        && CiudadDeVisita(v, hospitalesSeleccion) == ciudad);

                var score = (mismaCiudadMismoDia ? 100 : 0)
                    + (mismaCiudadCerca ? 50 : 0)
                    - cargaSemana;

                if (score <= mejorScore)
                {
                    continue;
                }

                mejorScore = score;
                mejor = new SugerenciaEspecialistaDto
                {
                    IdRutaVisita = visita.IdRutaVisita,
                    IdHospital = visita.IdHospital,
                    NombreHospital = hospital?.IdHospital.HasValue == true
                        ? $"Hospital {hospital.IdHospital}"
                        : null,
                    CiudadMunicipio = ciudad,
                    FechaVisita = visita.FechaVisita,
                    IdEspecialista = idEspecialista,
                    NombreEspecialista = nombres.GetValueOrDefault(idEspecialista, $"Usuario {idEspecialista}"),
                    CargaDia = cargaDia,
                    CargaSemana = cargaSemana,
                    Motivo = mismaCiudadMismoDia
                        ? $"Ya tiene visita en {ciudad} el mismo día"
                        : mismaCiudadCerca
                            ? $"Ya tiene visita en {ciudad} cerca de la fecha"
                            : "Menor carga semanal",
                };
            }

            if (mejor is not null)
            {
                sugerencias.Add(mejor);
            }
        }

        return sugerencias;
    }

    private async Task ValidarEspecialistaAsync(
        int idEspecialista,
        int? idTipoGerencia,
        CancellationToken ct)
    {
        var existe = await _asokamContext.Usuarios
            .AsNoTracking()
            .AnyAsync(u => u.IdUsuario == idEspecialista, ct);
        if (!existe)
        {
            throw new InvalidOperationException($"El especialista {idEspecialista} no existe en Asokam.");
        }

        var query = _context.EspecialistasGerencia
            .AsNoTracking()
            .Where(e => e.Activo && e.IdUsuario == idEspecialista);
        if (idTipoGerencia.HasValue)
        {
            query = query.Where(e => e.IdTipoGerencia == idTipoGerencia.Value);
        }

        if (!await query.AnyAsync(ct))
        {
            throw new InvalidOperationException(
                "El especialista no es elegible para la gerencia de la selección.");
        }
    }

    private async Task<(int MaxDia, int MaxSemana)> LeerCapacidadesAsync(CancellationToken ct)
    {
        var claves = new[] { "max_visitas_dia", "max_visitas_semana" };
        var valores = await _context.ParametrosModulo
            .AsNoTracking()
            .Where(p => claves.Contains(p.Clave))
            .ToDictionaryAsync(p => p.Clave, p => (int)p.Valor, ct);

        return (
            valores.GetValueOrDefault("max_visitas_dia", 3),
            valores.GetValueOrDefault("max_visitas_semana", 8));
    }

    private async Task<(int CargaDia, int CargaSemana)> ContarCargaAsync(
        int idEspecialista,
        DateOnly fecha,
        int idRutaVisitaExcluir,
        CancellationToken ct)
    {
        var inicioSemana = InicioSemana(fecha);
        var finSemana = inicioSemana.AddDays(6);

        var fechas = await _context.RutasVisitas
            .AsNoTracking()
            .Where(v => v.IdEspecialista == idEspecialista
                && v.IdRutaVisita != idRutaVisitaExcluir
                && v.FechaVisita >= inicioSemana
                && v.FechaVisita <= finSemana)
            .Select(v => v.FechaVisita)
            .ToListAsync(ct);

        return (fechas.Count(f => f == fecha), fechas.Count);
    }

    private static DateOnly InicioSemana(DateOnly fecha)
    {
        var offset = ((int)fecha.DayOfWeek + 6) % 7;
        return fecha.AddDays(-offset);
    }

    private static string? CiudadDeVisita(
        RutaVisita visita,
        IReadOnlyDictionary<int, SeleccionHospital> hospitales)
    {
        return visita.IdSeleccionHospital.HasValue
            && hospitales.TryGetValue(visita.IdSeleccionHospital.Value, out var hospital)
            ? hospital.CiudadMunicipio
            : null;
    }
}
