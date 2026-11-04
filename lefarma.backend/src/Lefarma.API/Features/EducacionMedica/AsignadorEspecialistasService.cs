using System.Globalization;
using System.Text;
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
        if (ruta?.Estado is Ruta.EstadoArchivada or Ruta.EstadoCancelada or Ruta.EstadoRechazada)
        {
            throw new InvalidOperationException(
                $"La ruta está {ruta.Estado}; no se puede reasignar un especialista en una ruta de solo lectura.");
        }

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

        if (ruta is not null)
        {
            var rutaDestino = await _context.Rutas
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    r => r.IdSeleccionMensual == ruta.IdSeleccionMensual
                        && r.Version == ruta.Version
                        && r.IdEspecialista == request.IdEspecialista
                        && r.Estado != Ruta.EstadoArchivada
                        && r.Estado != Ruta.EstadoCancelada
                        && r.Estado != Ruta.EstadoRechazada,
                    ct);

            if (rutaDestino is null)
            {
                var nombreEspecialista = await _asokamContext.Usuarios
                    .AsNoTracking()
                    .Where(u => u.IdUsuario == request.IdEspecialista)
                    .Select(u => u.NombreCompleto)
                    .FirstOrDefaultAsync(ct);
                rutaDestino = new Ruta
                {
                    IdSeleccionMensual = ruta.IdSeleccionMensual,
                    IdEquipo = null,
                    IdEspecialista = request.IdEspecialista,
                    Version = ruta.Version,
                    IdRutaVersion = ruta.IdRutaVersion,
                    Nombre = $"Ruta {nombreEspecialista ?? $"Especialista {request.IdEspecialista}"} - v{ruta.Version}",
                    Estado = ruta.Estado,
                    FechaConfirmacion = ruta.FechaConfirmacion,
                    FechaCreacion = DateTime.UtcNow,
                    FechaModificacion = DateTime.UtcNow,
                    IdUsuarioCreacion = idUsuario,
                    IdUsuarioModificacion = idUsuario,
                };
                _context.Rutas.Add(rutaDestino);
                await _context.SaveChangesAsync(ct);
            }

            visita.IdRuta = rutaDestino.IdRuta;
        }

        visita.IdEspecialista = request.IdEspecialista;
        if (!visita.IdEjecutivo.HasValue)
        {
            visita.IdEjecutivo = hospital?.IdEjecutivo ?? region?.IdEjecutivo;
        }

        visita.IdUsuarioModificacion = idUsuario;
        visita.FechaModificacion = DateTime.UtcNow;
        await _context.SaveChangesAsync(ct);

        if (ruta is not null && visita.IdRuta != ruta.IdRuta)
        {
            var origenSigueConVisitas = await _context.RutasVisitas
                .AnyAsync(v => v.IdRuta == ruta.IdRuta, ct);
            if (!origenSigueConVisitas)
            {
                var origen = await _context.Rutas.FirstOrDefaultAsync(r => r.IdRuta == ruta.IdRuta, ct);
                if (origen is not null)
                {
                    _context.Rutas.Remove(origen);
                    await _context.SaveChangesAsync(ct);
                }
            }
        }

        return true;
    }

    public async Task<List<SugerenciaEspecialistaDto>> GetSugerenciasAsync(
        int idSeleccionMensual,
        DateOnly? desde,
        DateOnly? hasta,
        int? idRutaVisita = null,
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
                && r.Estado != Ruta.EstadoCancelada
                && r.Estado != Ruta.EstadoRechazada)
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
                && (idRutaVisita.HasValue
                    ? v.IdRutaVisita == idRutaVisita.Value
                    : v.IdEspecialista == null))
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

        var idsRegiones = hospitalesSeleccion.Values
            .Where(h => h.IdRegion.HasValue)
            .Select(h => h.IdRegion!.Value)
            .Distinct()
            .ToList();
        var regionesSeleccion = idsRegiones.Count == 0
            ? new Dictionary<int, SeleccionRegion>()
            : await _context.SeleccionesRegiones
                .AsNoTracking()
                .Where(r => idsRegiones.Contains(r.IdRegion))
                .ToDictionaryAsync(r => r.IdRegion, ct);

        // La carga y el "ya tiene visita" solo consideran planeación vigente.
        // Las versiones archivadas/canceladas/rechazadas no deben contaminar la sugerencia.
        var inicioMes = new DateOnly(inicio.Year, inicio.Month, 1);
        var finMes = inicioMes.AddMonths(1).AddDays(-1);
        var inicioConsulta = inicio < inicioMes ? inicio : inicioMes;
        var finConsulta = fin > finMes ? fin : finMes;

        var visitasEspecialistas = await (
            from v in _context.RutasVisitas.AsNoTracking()
            join r in _context.Rutas.AsNoTracking() on v.IdRuta equals r.IdRuta
            where v.IdEspecialista.HasValue
                && r.IdSeleccionMensual == idSeleccionMensual
                && r.Estado != Ruta.EstadoArchivada
                && r.Estado != Ruta.EstadoCancelada
                && r.Estado != Ruta.EstadoRechazada
                && v.FechaVisita >= inicioConsulta.AddDays(-1)
                && v.FechaVisita <= finConsulta.AddDays(1)
            select v)
            .ToListAsync(ct);

        var historialRealizado = await _context.Talleres.AsNoTracking()
            .Where(t => t.Activo
                && t.Estado == Taller.EstadoRealizado
                && t.IdEspecialista.HasValue
                && idsEspecialistas.Contains(t.IdEspecialista.Value)
                && (t.FechaRealizado ?? t.FechaTaller) != null)
            .Select(t => new
            {
                IdEspecialista = t.IdEspecialista!.Value,
                t.IdHospital,
                t.Region,
                t.CiudadMunicipio,
                Fecha = (t.FechaRealizado ?? t.FechaTaller)!.Value,
            })
            .ToListAsync(ct);

        var idsHospitalReferencia = visitasEspecialistas
            .Select(v => v.IdHospital)
            .Concat(visitasSinEspecialista.Select(v => v.IdHospital))
            .Concat(visitasSinEspecialista
                .Where(v => v.IdSeleccionHospital.HasValue)
                .Select(v => hospitalesSeleccion.GetValueOrDefault(v.IdSeleccionHospital!.Value)?.IdHospital))
            .Concat(historialRealizado.Select(h => h.IdHospital))
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        var hospitalesAsokam = idsHospitalReferencia.Count == 0
            ? new Dictionary<int, Hospital>()
            : await _asokamContext.Hospitales
                .AsNoTracking()
                .Where(h => idsHospitalReferencia.Contains(h.CodigoContacto))
                .ToDictionaryAsync(h => h.CodigoContacto, ct);

        var idsPadre = hospitalesAsokam.Values
            .Select(h => h.CodigoContactoPrincipal)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .Except(idsHospitalReferencia)
            .ToList();
        var padres = idsPadre.Count == 0
            ? new Dictionary<int, Hospital>()
            : await _asokamContext.Hospitales
                .AsNoTracking()
                .Where(h => idsPadre.Contains(h.CodigoContacto))
                .ToDictionaryAsync(h => h.CodigoContacto, ct);

        string? InstitucionDeHospital(int? idHospital)
        {
            if (!idHospital.HasValue
                || !hospitalesAsokam.TryGetValue(idHospital.Value, out var hospital))
            {
                return null;
            }

            return hospital.CodigoContactoPrincipal is int idPadreHospital
                ? padres.GetValueOrDefault(idPadreHospital)?.NombreContacto
                    ?? hospital.NombreContacto
                : hospital.NombreContacto;
        }

        var institucionPorHospital = hospitalesAsokam.Keys
            .ToDictionary(idHospital => idHospital, idHospital => InstitucionDeHospital(idHospital));

        var (maxDia, maxSemana) = await LeerCapacidadesAsync(ct);
        var configuracion = await LeerConfiguracionSugerenciasAsync(ct);
        var sugerencias = new List<SugerenciaEspecialistaDto>();

        foreach (var visita in visitasSinEspecialista)
        {
            var hospital = visita.IdSeleccionHospital.HasValue
                && hospitalesSeleccion.TryGetValue(visita.IdSeleccionHospital.Value, out var h)
                ? h
                : null;
            var ciudad = hospital?.CiudadMunicipio;
            var ciudadNormalizada = NormalizarTexto(ciudad);
            var region = hospital?.IdRegion is int idRegion
                && regionesSeleccion.TryGetValue(idRegion, out var regionSeleccion)
                    ? regionSeleccion.Nombre
                    : null;
            var regionNormalizada = NormalizarTexto(region);
            var idHospitalObjetivo = visita.IdHospital ?? hospital?.IdHospital;
            var institucion = InstitucionDeHospital(idHospitalObjetivo);
            var institucionNormalizada = NormalizarTexto(institucion);
            var inicioSemana = InicioSemana(visita.FechaVisita);
            var finSemana = inicioSemana.AddDays(6);
            var mesInicio = new DateOnly(visita.FechaVisita.Year, visita.FechaVisita.Month, 1);
            var mesFin = mesInicio.AddMonths(1).AddDays(-1);

            SugerenciaEspecialistaDto? mejor = null;
            var mejorScore = decimal.MinValue;

            foreach (var idEspecialista in idsEspecialistas)
            {
                if (visita.IdEspecialista == idEspecialista)
                {
                    continue;
                }

                var visitas = visitasEspecialistas
                    .Where(v => v.IdEspecialista == idEspecialista)
                    .ToList();
                var cargaDia = visitas.Count(v => v.FechaVisita == visita.FechaVisita);
                var cargaSemana = visitas.Count(v => v.FechaVisita >= inicioSemana && v.FechaVisita <= finSemana);
                var cargaMes = visitas.Count(v => v.FechaVisita >= mesInicio && v.FechaVisita <= mesFin);

                if (cargaDia >= maxDia || cargaSemana >= maxSemana)
                {
                    continue;
                }

                var otraCiudadMismoDia = ciudadNormalizada is not null
                    && visitas.Any(v => v.FechaVisita == visita.FechaVisita
                        && NormalizarTexto(CiudadDeVisita(v, hospitalesSeleccion)) is string otraCiudad
                        && otraCiudad != ciudadNormalizada);
                if (otraCiudadMismoDia)
                {
                    continue;
                }

                var mismaCiudadMismoDia = ciudadNormalizada is not null
                    && visitas.Any(v => v.FechaVisita == visita.FechaVisita
                        && NormalizarTexto(CiudadDeVisita(v, hospitalesSeleccion)) == ciudadNormalizada);
                var mismaCiudadCerca = ciudadNormalizada is not null
                    && visitas.Any(v =>
                        Math.Abs(v.FechaVisita.DayNumber - visita.FechaVisita.DayNumber)
                            <= configuracion.VentanaDiasCercania
                        && NormalizarTexto(CiudadDeVisita(v, hospitalesSeleccion)) == ciudadNormalizada);
                var mismaInstitucion = institucionNormalizada is not null
                    && visitas.Any(v =>
                        Math.Abs(v.FechaVisita.DayNumber - visita.FechaVisita.DayNumber)
                            <= configuracion.VentanaDiasCercania
                        && NormalizarTexto(InstitucionDeHospital(v.IdHospital)) == institucionNormalizada);
                var diaConsecutivo = visitas.Any(v =>
                    Math.Abs(v.FechaVisita.DayNumber - visita.FechaVisita.DayNumber) == 1);

                var historialEspecialista = historialRealizado
                    .Where(h => h.IdEspecialista == idEspecialista && h.Fecha < visita.FechaVisita)
                    .ToList();
                var historialHospital = historialEspecialista
                    .Where(h => idHospitalObjetivo.HasValue && h.IdHospital == idHospitalObjetivo)
                    .ToList();
                var historialInstitucion = historialEspecialista
                    .Where(h => institucionNormalizada is not null
                        && h.IdHospital.HasValue
                        && NormalizarTexto(institucionPorHospital.GetValueOrDefault(h.IdHospital.Value))
                            == institucionNormalizada)
                    .ToList();
                var historialCiudad = historialEspecialista
                    .Where(h => ciudadNormalizada is not null
                        && NormalizarTexto(h.CiudadMunicipio) == ciudadNormalizada)
                    .ToList();
                var historialRegion = historialEspecialista
                    .Where(h => regionNormalizada is not null
                        && NormalizarTexto(h.Region) == regionNormalizada)
                    .ToList();
                var bonusHistorial = Math.Min(
                    (Math.Min(historialHospital.Count, 3) * configuracion.PesoHistorialHospital)
                    + (Math.Min(historialCiudad.Count, 3) * configuracion.PesoHistorialCiudad)
                    + (Math.Min(historialRegion.Count, 3) * configuracion.PesoHistorialRegion)
                    + (historialInstitucion.Count > 0 ? configuracion.PesoHistorialInstitucion : 0m),
                    configuracion.TopeHistorial);

                var score = (mismaCiudadMismoDia ? configuracion.PesoMismaCiudadMismoDia : 0)
                    + (mismaCiudadCerca ? configuracion.PesoMismaCiudadCerca : 0)
                    + (mismaInstitucion ? configuracion.PesoMismaInstitucion : 0)
                    + bonusHistorial
                    - (cargaSemana * configuracion.FactorCargaSemana)
                    - (cargaMes * configuracion.FactorCargaMes)
                    - (diaConsecutivo ? configuracion.PenalizacionDiaConsecutivo : 0);

                if (score < mejorScore)
                {
                    continue;
                }

                if (score == mejorScore && mejor is not null)
                {
                    var peorCargaMes = cargaMes > mejor.CargaMes;
                    var mismaCargaMes = cargaMes == mejor.CargaMes;
                    var peorCargaSemana = mismaCargaMes && cargaSemana > mejor.CargaSemana;
                    var mismaCargaSemana = mismaCargaMes && cargaSemana == mejor.CargaSemana;
                    var peorCargaDia = mismaCargaSemana && cargaDia > mejor.CargaDia;
                    var mismaCargaDia = mismaCargaSemana && cargaDia == mejor.CargaDia;

                    if (peorCargaMes || peorCargaSemana || peorCargaDia
                        || (mismaCargaDia && idEspecialista >= mejor.IdEspecialista))
                    {
                        continue;
                    }
                }

                mejorScore = score;
                mejor = new SugerenciaEspecialistaDto
                {
                    IdRutaVisita = visita.IdRutaVisita,
                    IdHospital = idHospitalObjetivo,
                    NombreHospital = hospital?.IdHospital.HasValue == true
                        ? $"Hospital {hospital.IdHospital}"
                        : null,
                    CiudadMunicipio = ciudad,
                    FechaVisita = visita.FechaVisita,
                    IdEspecialista = idEspecialista,
                    NombreEspecialista = nombres.GetValueOrDefault(idEspecialista, $"Usuario {idEspecialista}"),
                    CargaDia = cargaDia,
                    CargaSemana = cargaSemana,
                    CargaMes = cargaMes,
                    TieneDiaConsecutivo = diaConsecutivo,
                    MismaInstitucion = mismaInstitucion,
                    Institucion = institucion,
                    Region = region,
                    HaVisitadoHospital = historialHospital.Count > 0,
                    VisitasRealizadasHospital = historialHospital.Count,
                    UltimaVisitaHospital = historialHospital.Count > 0
                        ? historialHospital.Max(h => h.Fecha)
                        : null,
                    HaVisitadoInstitucion = historialInstitucion.Count > 0,
                    VisitasRealizadasInstitucion = historialInstitucion.Count,
                    UltimaVisitaInstitucion = historialInstitucion.Count > 0
                        ? historialInstitucion.Max(h => h.Fecha)
                        : null,
                    HaVisitadoCiudad = historialCiudad.Count > 0,
                    VisitasRealizadasCiudad = historialCiudad.Count,
                    UltimaVisitaCiudad = historialCiudad.Count > 0
                        ? historialCiudad.Max(h => h.Fecha)
                        : null,
                    HaVisitadoRegion = historialRegion.Count > 0,
                    VisitasRealizadasRegion = historialRegion.Count,
                    UltimaVisitaRegion = historialRegion.Count > 0
                        ? historialRegion.Max(h => h.Fecha)
                        : null,
                    Motivo = mismaCiudadMismoDia
                        ? $"Ya tiene visita en {ciudad} el mismo día"
                        : mismaCiudadCerca
                            ? $"Ya tiene visita en {ciudad} cerca de la fecha"
                            : mismaInstitucion
                                ? $"Ya tiene visita en la instituci�n {institucion} cerca de la fecha"
                                : historialHospital.Count > 0
                                    ? $"Ya visitó este hospital {historialHospital.Count} vez(ces)"
                                    : historialCiudad.Count > 0
                                        ? $"Conoce {ciudad} ({historialCiudad.Count} visita(s))"
                                        : historialRegion.Count > 0
                                            ? $"Conoce la región {region} ({historialRegion.Count} visita(s))"
                                            : "Menor carga semanal",
                };
            }

            if (mejor is not null)
            {
                sugerencias.Add(mejor);
                visitasEspecialistas.Add(new RutaVisita
                {
                    IdRutaVisita = visita.IdRutaVisita,
                    IdRuta = visita.IdRuta,
                    IdSeleccionHospital = visita.IdSeleccionHospital,
                    IdHospital = visita.IdHospital,
                    IdEspecialista = mejor.IdEspecialista,
                    FechaVisita = visita.FechaVisita,
                    Orden = visita.Orden,
                });
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

    private async Task<ConfiguracionSugerencia> LeerConfiguracionSugerenciasAsync(CancellationToken ct)
    {
        var claves = new[]
        {
            "sugerencia_peso_misma_ciudad_dia",
            "sugerencia_peso_misma_ciudad_cerca",
            "sugerencia_peso_misma_institucion",
            "sugerencia_penalizacion_dia_consecutivo",
            "sugerencia_factor_carga_semana",
            "sugerencia_factor_carga_mes",
            "sugerencia_ventana_dias_cercania",
            "sugerencia_peso_historial_hospital",
            "sugerencia_peso_historial_institucion",
            "sugerencia_peso_historial_ciudad",
            "sugerencia_peso_historial_region",
            "sugerencia_tope_historial",
        };

        var valores = await _context.ParametrosModulo
            .AsNoTracking()
            .Where(p => p.Activo && claves.Contains(p.Clave))
            .ToDictionaryAsync(p => p.Clave, p => p.Valor, ct);

        decimal Leer(string clave, decimal porDefecto) =>
            valores.TryGetValue(clave, out var valor) ? Math.Max(0m, valor) : porDefecto;

        return new ConfiguracionSugerencia(
            PesoMismaCiudadMismoDia: Leer("sugerencia_peso_misma_ciudad_dia", 100m),
            PesoMismaCiudadCerca: Leer("sugerencia_peso_misma_ciudad_cerca", 50m),
            PesoMismaInstitucion: Leer("sugerencia_peso_misma_institucion", 25m),
            PenalizacionDiaConsecutivo: Leer("sugerencia_penalizacion_dia_consecutivo", 20m),
            FactorCargaSemana: Leer("sugerencia_factor_carga_semana", 1m),
            FactorCargaMes: Leer("sugerencia_factor_carga_mes", 1m),
            VentanaDiasCercania: (int)Leer("sugerencia_ventana_dias_cercania", 1m),
            PesoHistorialHospital: Leer("sugerencia_peso_historial_hospital", 5m),
            PesoHistorialInstitucion: Leer("sugerencia_peso_historial_institucion", 5m),
            PesoHistorialCiudad: Leer("sugerencia_peso_historial_ciudad", 3m),
            PesoHistorialRegion: Leer("sugerencia_peso_historial_region", 2m),
            TopeHistorial: Leer("sugerencia_tope_historial", 25m));
    }

    private sealed record ConfiguracionSugerencia(
        decimal PesoMismaCiudadMismoDia,
        decimal PesoMismaCiudadCerca,
        decimal PesoMismaInstitucion,
        decimal PenalizacionDiaConsecutivo,
        decimal FactorCargaSemana,
        decimal FactorCargaMes,
        int VentanaDiasCercania,
        decimal PesoHistorialHospital,
        decimal PesoHistorialInstitucion,
        decimal PesoHistorialCiudad,
        decimal PesoHistorialRegion,
        decimal TopeHistorial);

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

    private static string? NormalizarTexto(string? valor)
    {
        if (string.IsNullOrWhiteSpace(valor))
        {
            return null;
        }

        var descompuesto = valor.Trim().Normalize(NormalizationForm.FormD);
        var normalizado = new StringBuilder(descompuesto.Length);
        foreach (var caracter in descompuesto)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(caracter) != UnicodeCategory.NonSpacingMark)
            {
                normalizado.Append(char.ToUpperInvariant(caracter));
            }
        }

        return normalizado.ToString();
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
