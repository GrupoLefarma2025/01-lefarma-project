using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.EducacionMedica;

public class EquipoPareoService : IEquipoPareoService
{
    private readonly IEquipoPareoRepository _repository;
    private readonly ISeleccionMensualRepository _seleccionRepository;
    private readonly IRutaRepository _rutaRepository;
    private readonly IRegionRepository _regionRepository;
    private readonly AsokamDbContext _asokamContext;

    public EquipoPareoService(
        IEquipoPareoRepository repository,
        ISeleccionMensualRepository seleccionRepository,
        IRutaRepository rutaRepository,
        IRegionRepository regionRepository,
        AsokamDbContext asokamContext)
    {
        _repository = repository;
        _seleccionRepository = seleccionRepository;
        _rutaRepository = rutaRepository;
        _regionRepository = regionRepository;
        _asokamContext = asokamContext;
    }

    public async Task<List<EquipoPareoDto>> GetAllAsync(EquipoPareoFiltro? filtro, CancellationToken ct = default)
    {
        filtro ??= new EquipoPareoFiltro();

        var equipos = await _repository.GetAllAsync(filtro, ct);
        if (equipos.Count == 0)
        {
            return [];
        }

        var nombres = await ResolverNombresAsync(equipos, ct);
        var regionesActuales = await ResolverRegionesActualesAsync(equipos.Select(e => e.IdEquipo), ct);
        var nombresRegiones = await ResolverNombresRegionesAsync(equipos.Select(e => e.IdRegion), ct);

        var dtos = equipos
            .Select(e => e.ToResponse(
                nombres,
                regionesActuales.GetValueOrDefault(e.IdEquipo),
                nombresRegiones.GetValueOrDefault(e.IdRegion)))
            .ToList();

        var busqueda = filtro.Busqueda?.Trim();
        if (!string.IsNullOrEmpty(busqueda))
        {
            dtos = dtos
                .Where(d =>
                    d.NombreEjecutivo.Contains(busqueda, StringComparison.OrdinalIgnoreCase) ||
                    d.NombreEspecialista.Contains(busqueda, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        return dtos;
    }

    public async Task<EquipoOperacionDto?> ObtenerOperacionAsync(int idEquipo, CancellationToken ct = default)
    {
        var equipo = await _repository.GetByIdAsync(idEquipo, ct);
        if (equipo is null)
        {
            return null;
        }

        var nombres = await ResolverNombresAsync([equipo], ct);

        var regiones = await _seleccionRepository.GetRegionesPorEquiposAsync([idEquipo], ct);
        var rutas = await _rutaRepository.GetByEquipoAsync(idEquipo, ct);

        var idsSelecciones = regiones.Select(r => r.IdSeleccionMensual)
            .Union(rutas.Select(r => r.IdSeleccionMensual))
            .Distinct()
            .ToList();

        var selecciones = new Dictionary<int, SeleccionMensual>();
        foreach (var idSeleccion in idsSelecciones)
        {
            var seleccion = await _seleccionRepository.GetByIdAsync(idSeleccion, ct);
            if (seleccion is not null)
            {
                selecciones[idSeleccion] = seleccion;
            }
        }

        var participaciones = new List<EquipoParticipacionDto>();
        var totalVisitasConfirmadas = 0;

        foreach (var (idSeleccion, seleccion) in selecciones.OrderByDescending(s => s.Value.FechaSeleccion))
        {
            var regionesDeSeleccion = regiones
                .Where(r => r.IdSeleccionMensual == idSeleccion)
                .Select(r => new EquipoRegionOperadaDto
                {
                    IdRegion = r.IdRegion,
                    Nombre = r.Nombre ?? $"Región {r.IdRegion}",
                    CantidadHospitales = r.CantidadHospitales,
                })
                .ToList();

            var rutasDeSeleccion = rutas
                .Where(r => r.IdSeleccionMensual == idSeleccion && r.Estado != Ruta.EstadoArchivada)
                .ToList();

            var rutasDto = new List<EquipoRutaOperadaDto>();
            foreach (var ruta in rutasDeSeleccion)
            {
                var totalVisitas = (await _rutaRepository.GetVisitasAsync(ruta.IdRuta, ct)).Count;
                if (ruta.Estado == Ruta.EstadoConfirmada)
                {
                    totalVisitasConfirmadas += totalVisitas;
                }

                rutasDto.Add(new EquipoRutaOperadaDto
                {
                    IdRuta = ruta.IdRuta,
                    Version = ruta.Version,
                    Estado = ruta.Estado,
                    FechaConfirmacion = ruta.FechaConfirmacion,
                    TotalVisitas = totalVisitas,
                });
            }

            participaciones.Add(new EquipoParticipacionDto
            {
                IdSeleccionMensual = idSeleccion,
                FechaSeleccion = seleccion.FechaSeleccion,
                EstadoSeleccion = seleccion.Estado,
                Regiones = regionesDeSeleccion,
                Rutas = rutasDto,
            });
        }

        return new EquipoOperacionDto
        {
            IdEquipo = equipo.IdEquipo,
            NombreEjecutivo = nombres.GetValueOrDefault(equipo.IdEjecutivo, $"Usuario {equipo.IdEjecutivo}"),
            NombreEspecialista = nombres.GetValueOrDefault(equipo.IdEspecialista, $"Usuario {equipo.IdEspecialista}"),
            FechaInicio = equipo.FechaInicio,
            FechaFin = equipo.FechaFin,
            Activo = equipo.Activo,
            TotalSelecciones = participaciones.Count,
            TotalVisitasConfirmadas = totalVisitasConfirmadas,
            Participaciones = participaciones,
        };
    }

    public async Task<EquipoPareoDto> CreateAsync(CrearEquipoPareoRequest request, int idUsuario, CancellationToken ct = default)
    {
        if (request.IdEjecutivo == request.IdEspecialista)
        {
            throw new InvalidOperationException("El ejecutivo de ventas y el especialista de producto no pueden ser la misma persona.");
        }

        await ValidarUsuariosEnAsokamAsync(request.IdEjecutivo, request.IdEspecialista, ct);
        await ValidarRegionLibreAsync(request.IdRegion, excluirIdEquipo: null, ct);

        var ejecutivoOcupado = await _repository.ExisteActivoConIntegranteAsync(request.IdEjecutivo, ct);
        if (ejecutivoOcupado)
        {
            throw new InvalidOperationException(
                $"El usuario {request.IdEjecutivo} ya pertenece a un equipo activo. Un integrante solo puede estar en un equipo activo a la vez.");
        }

        var especialistaOcupado = await _repository.ExisteActivoConIntegranteAsync(request.IdEspecialista, ct);
        if (especialistaOcupado)
        {
            throw new InvalidOperationException(
                $"El usuario {request.IdEspecialista} ya pertenece a un equipo activo. Un integrante solo puede estar en un equipo activo a la vez.");
        }

        var equipo = await _repository.CreateAsync(new EquipoPareo
        {
            IdRegion = request.IdRegion,
            IdEjecutivo = request.IdEjecutivo,
            IdEspecialista = request.IdEspecialista,
            FechaInicio = request.FechaInicio ?? DateOnly.FromDateTime(DateTime.UtcNow),
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario,
        }, ct);

        var nombres = await ResolverNombresAsync([equipo], ct);
        var nombresRegiones = await ResolverNombresRegionesAsync([equipo.IdRegion], ct);
        return equipo.ToResponse(nombres, [], nombresRegiones.GetValueOrDefault(equipo.IdRegion));
    }

    public async Task<EquipoPareoDto?> AsignarRegionAsync(
        int idEquipo,
        AsignarRegionEquipoRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        var equipo = await _repository.GetByIdAsync(idEquipo, ct);
        if (equipo is null)
        {
            return null;
        }

        await ValidarRegionLibreAsync(request.IdRegion, excluirIdEquipo: idEquipo, ct);

        equipo.IdRegion = request.IdRegion;
        equipo.IdUsuarioModificacion = idUsuario;
        await _repository.UpdateAsync(equipo, ct);

        var nombres = await ResolverNombresAsync([equipo], ct);
        var nombresRegiones = await ResolverNombresRegionesAsync([equipo.IdRegion], ct);
        return equipo.ToResponse(nombres, [], nombresRegiones.GetValueOrDefault(equipo.IdRegion));
    }

    private async Task ValidarRegionLibreAsync(int idRegion, int? excluirIdEquipo, CancellationToken ct)
    {
        var region = await _regionRepository.GetByIdAsync(idRegion, ct);
        if (region is null || !region.Activo)
        {
            throw new InvalidOperationException($"La región {idRegion} no existe o está inactiva.");
        }

        var ocupada = await _repository.ExisteActivoConRegionAsync(idRegion, excluirIdEquipo, ct);
        if (ocupada)
        {
            throw new InvalidOperationException(
                $"La región '{region.Nombre}' ya está asignada a otro equipo activo. Una región solo puede tener un equipo activo.");
        }
    }

    private async Task<Dictionary<int, string>> ResolverNombresRegionesAsync(IEnumerable<int> idsRegiones, CancellationToken ct)
    {
        var ids = idsRegiones.Distinct().ToList();
        if (ids.Count == 0)
        {
            return new Dictionary<int, string>();
        }

        var regiones = await _regionRepository.GetAllAsync(ct);
        return regiones
            .Where(r => ids.Contains(r.IdRegion))
            .ToDictionary(r => r.IdRegion, r => r.Nombre);
    }

    public async Task<EquipoPareoDto?> DesactivarAsync(int idEquipo, int idUsuario, CancellationToken ct = default)
    {
        var equipo = await _repository.GetByIdAsync(idEquipo, ct);
        if (equipo is null)
        {
            return null;
        }

        if (equipo.Activo)
        {
            equipo.Activo = false;
            equipo.FechaFin = DateOnly.FromDateTime(DateTime.UtcNow);
            equipo.IdUsuarioModificacion = idUsuario;

            await _repository.UpdateAsync(equipo, ct);
        }

        var nombres = await ResolverNombresAsync([equipo], ct);
        return equipo.ToResponse(nombres, []);
    }

    private async Task<Dictionary<int, List<string>>> ResolverRegionesActualesAsync(IEnumerable<int> idsEquipos, CancellationToken ct)
    {
        var ids = idsEquipos.Distinct().ToList();
        if (ids.Count == 0)
        {
            return new Dictionary<int, List<string>>();
        }

        var regiones = await _seleccionRepository.GetRegionesPorEquiposAsync(ids, ct);
        if (regiones.Count == 0)
        {
            return new Dictionary<int, List<string>>();
        }

        var idsSelecciones = regiones.Select(r => r.IdSeleccionMensual).Distinct().ToList();
        var selecciones = new Dictionary<int, SeleccionMensual>();
        foreach (var idSeleccion in idsSelecciones)
        {
            var seleccion = await _seleccionRepository.GetByIdAsync(idSeleccion, ct);
            if (seleccion is not null)
            {
                selecciones[idSeleccion] = seleccion;
            }
        }

        var resultado = new Dictionary<int, List<string>>();
        foreach (var region in regiones)
        {
            var seleccion = selecciones.GetValueOrDefault(region.IdSeleccionMensual);
            if (seleccion is null || seleccion.Estado == SeleccionMensual.EstadoCerrada)
            {
                continue;
            }

            var etiqueta = $"{region.Nombre ?? $"Región {region.IdRegion}"} · {seleccion.FechaSeleccion:dd/MM}";
            if (!resultado.TryGetValue(region.IdEquipo!.Value, out var lista))
            {
                lista = [];
                resultado[region.IdEquipo.Value] = lista;
            }

            lista.Add(etiqueta);
        }

        return resultado;
    }

    private async Task ValidarUsuariosEnAsokamAsync(int idEjecutivo, int idEspecialista, CancellationToken ct)
    {
        var ids = new[] { idEjecutivo, idEspecialista };
        var encontrados = await _asokamContext.Usuarios
            .AsNoTracking()
            .Where(u => ids.Contains(u.IdUsuario))
            .Select(u => u.IdUsuario)
            .ToListAsync(ct);

        var faltantes = ids.Except(encontrados).ToList();
        if (faltantes.Count > 0)
        {
            throw new InvalidOperationException(
                $"Usuario(s) no encontrado(s) en Asokam: {string.Join(", ", faltantes)}.");
        }
    }

    private async Task<Dictionary<int, string>> ResolverNombresAsync(IEnumerable<EquipoPareo> equipos, CancellationToken ct)
    {
        var ids = equipos
            .SelectMany(e => new[] { e.IdEjecutivo, e.IdEspecialista })
            .Distinct()
            .ToList();

        if (ids.Count == 0)
        {
            return new Dictionary<int, string>();
        }

        return await _asokamContext.Usuarios
            .AsNoTracking()
            .Where(u => ids.Contains(u.IdUsuario))
            .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto ?? string.Empty, ct);
    }
}
