using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Features.EducacionMedica.Services;
using Lefarma.API.Infrastructure.Data;
using Lefarma.API.Shared.Extensions;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.EducacionMedica;

public class RegionService : IRegionService
{
    private readonly IRegionRepository _regionRepository;
    private readonly IHospitalRepository _hospitalRepository;
    private readonly IHospitalExtensionRepository _extensionRepository;
    private readonly AsokamDbContext _asokamContext;

    public RegionService(
        IRegionRepository regionRepository,
        IHospitalRepository hospitalRepository,
        IHospitalExtensionRepository extensionRepository,
        AsokamDbContext asokamContext)
    {
        _regionRepository = regionRepository;
        _hospitalRepository = hospitalRepository;
        _extensionRepository = extensionRepository;
        _asokamContext = asokamContext;
    }

    public async Task<List<RegionDto>> GetRegionesAsync(CancellationToken ct = default)
    {
        var regiones = await _regionRepository.GetAllAsync(ct);
        var mapeos = await _regionRepository.GetMapeosAsync(ct);
        var conteos = await _regionRepository.GetConteosHospitalesAsync(ct);
        var nombresEstados = await NombresEstadosAsync(ct);

        var estadosPorRegion = mapeos
            .GroupBy(m => m.IdRegion)
            .ToDictionary(
                g => g.Key,
                g => g.Select(m => new RegionEstadoResumenDto
                {
                    CodigoEstado = m.CodigoEstado,
                    NombreEstado = nombresEstados.GetValueOrDefault(m.CodigoEstado)
                }).ToList());

        return regiones.Select(r => new RegionDto
        {
            IdRegion = r.IdRegion,
            Nombre = r.Nombre,
            CentroLatitud = r.CentroLatitud,
            CentroLongitud = r.CentroLongitud,
            Activo = r.Activo,
            CantidadHospitales = conteos.GetValueOrDefault(r.IdRegion),
            Estados = estadosPorRegion.GetValueOrDefault(r.IdRegion) ?? []
        }).ToList();
    }

    public async Task<RegionDto> CreateRegionAsync(UpsertRegionRequest request, int idUsuario, CancellationToken ct = default)
    {
        ValidarNombre(request.Nombre);

        if (await _regionRepository.GetByNombreAsync(request.Nombre.Trim(), ct) is not null)
        {
            throw new InvalidOperationException($"Ya existe una región con el nombre '{request.Nombre.Trim()}'.");
        }

        var region = await _regionRepository.CreateAsync(new RegionCatalogo
        {
            Nombre = request.Nombre.Trim(),
            CentroLatitud = request.CentroLatitud,
            CentroLongitud = request.CentroLongitud,
            Activo = request.Activo ?? true,
            IdUsuarioCreacion = idUsuario,
            IdUsuarioModificacion = idUsuario
        }, ct);

        await _regionRepository.SyncEstadosAsync(region.IdRegion, request.CodigoEstados, idUsuario, ct);

        return await ToDtoAsync(region, request.CodigoEstados, ct);
    }

    public async Task<RegionDto> UpdateRegionAsync(int idRegion, UpsertRegionRequest request, int idUsuario, CancellationToken ct = default)
    {
        var region = await _regionRepository.GetByIdAsync(idRegion, ct)
            ?? throw new InvalidOperationException($"No existe la región {idRegion}.");

        ValidarNombre(request.Nombre);

        var duplicada = await _regionRepository.GetByNombreAsync(request.Nombre.Trim(), ct);
        if (duplicada is not null && duplicada.IdRegion != idRegion)
        {
            throw new InvalidOperationException($"Ya existe una región con el nombre '{request.Nombre.Trim()}'.");
        }

        region.Nombre = request.Nombre.Trim();
        region.CentroLatitud = request.CentroLatitud;
        region.CentroLongitud = request.CentroLongitud;
        region.Activo = request.Activo ?? region.Activo;
        region.IdUsuarioModificacion = idUsuario;

        await _regionRepository.UpdateAsync(region, ct);
        await _regionRepository.SyncEstadosAsync(idRegion, request.CodigoEstados, idUsuario, ct);

        return await ToDtoAsync(region, request.CodigoEstados, ct);
    }

    public async Task<List<EstadoCatalogoDto>> GetEstadosCatalogoAsync(CancellationToken ct = default)
    {
        var estados = await _asokamContext.GenEstados
            .AsNoTracking()
            .OrderBy(e => e.NombreEstado)
            .ToListAsync(ct);

        var mapeos = await _regionRepository.GetMapeosAsync(ct);
        var regiones = (await _regionRepository.GetAllAsync(ct)).ToDictionary(r => r.IdRegion, r => r.Nombre);
        var mapeoPorEstado = mapeos.ToDictionary(m => m.CodigoEstado, m => m.IdRegion);

        return estados.Select(e =>
        {
            var tieneMapeo = mapeoPorEstado.TryGetValue(e.CodigoEstado, out var idRegionActual);
            return new EstadoCatalogoDto
            {
                CodigoEstado = e.CodigoEstado,
                NombreEstado = e.NombreEstado,
                IdRegionActual = tieneMapeo ? idRegionActual : null,
                NombreRegionActual = tieneMapeo ? regiones.GetValueOrDefault(idRegionActual) : null
            };
        }).ToList();
    }

    public async Task<SugerenciaRegionResponseDto> GetSugerenciaAsync(int codigoContacto, CancellationToken ct = default)
    {
        var hospital = await _hospitalRepository.GetByIdAsync(codigoContacto, ct)
            ?? throw new InvalidOperationException($"No existe el hospital {codigoContacto}.");

        SugerenciaRegionOpcionDto? porEstado = null;
        if (int.TryParse(hospital.CodigoEstado, out var codigoEstado))
        {
            var mapeo = await _regionRepository.GetMapeoByEstadoAsync(codigoEstado, ct);
            if (mapeo is not null)
            {
                var region = await _regionRepository.GetByIdAsync(mapeo.IdRegion, ct);
                if (region is not null && region.Activo)
                {
                    porEstado = new SugerenciaRegionOpcionDto
                    {
                        IdRegion = region.IdRegion,
                        NombreRegion = region.Nombre
                    };
                }
            }
        }

        SugerenciaRegionOpcionDto? porGps = null;
        if (hospital.Latitud.HasValue && hospital.Longitud.HasValue)
        {
            var regiones = await _regionRepository.GetAllAsync(ct);
            RegionCatalogo? mejor = null;
            var mejorKm = double.MaxValue;

            foreach (var region in regiones.Where(r => r.Activo && r.CentroLatitud.HasValue && r.CentroLongitud.HasValue))
            {
                var km = Haversine.DistanciaKm(
                    (double)hospital.Latitud.Value,
                    (double)hospital.Longitud.Value,
                    (double)region.CentroLatitud!.Value,
                    (double)region.CentroLongitud!.Value);

                if (km < mejorKm)
                {
                    mejorKm = km;
                    mejor = region;
                }
            }

            if (mejor is not null)
            {
                porGps = new SugerenciaRegionOpcionDto
                {
                    IdRegion = mejor.IdRegion,
                    NombreRegion = mejor.Nombre,
                    DistanciaKm = Math.Round(mejorKm, 1)
                };
            }
        }

        return new SugerenciaRegionResponseDto
        {
            PorEstado = porEstado,
            PorGps = porGps
        };
    }

    public async Task<AplicarMapeoResponseDto> PreviewAplicarMapeoAsync(CancellationToken ct = default)
    {
        var filas = await _regionRepository.PreviewAplicarMapeoAsync(ct);
        var nombresEstados = await NombresEstadosAsync(ct);
        var regiones = (await _regionRepository.GetAllAsync(ct)).ToDictionary(r => r.IdRegion, r => r.Nombre);

        var filasGps = await _regionRepository.PreviewAplicarMapeoGpsAsync(ct);
        var sinCoordenadas = await _regionRepository.ContarSinRegionSinCoordenadasAsync(ct);

        return new AplicarMapeoResponseDto
        {
            TotalHospitales = filas.Sum(f => f.Hospitales),
            Detalles = filas.Select(f => new AplicarMapeoDetalleDto
            {
                CodigoEstado = f.CodigoEstado,
                NombreEstado = nombresEstados.GetValueOrDefault(f.CodigoEstado),
                IdRegion = f.IdRegion,
                NombreRegion = regiones.GetValueOrDefault(f.IdRegion),
                Hospitales = f.Hospitales
            }).ToList(),
            TotalPorGps = filasGps.Sum(f => f.Hospitales),
            DetallesGps = filasGps.Select(f => new AplicarMapeoGpsDetalleDto
            {
                IdRegion = f.IdRegion,
                NombreRegion = regiones.GetValueOrDefault(f.IdRegion),
                Hospitales = f.Hospitales
            }).ToList(),
            SinCoordenadas = sinCoordenadas
        };
    }

    public async Task<AplicarMapeoResultadoDto> AplicarMapeoAsync(int idUsuario, CancellationToken ct = default)
    {
        var porEstado = await _regionRepository.AplicarMapeoAsync(idUsuario, ct);
        // Después del pase por estado: el GPS solo rellena los que siguen sin región.
        var porGps = await _regionRepository.AplicarMapeoGpsAsync(idUsuario, ct);

        return new AplicarMapeoResultadoDto { PorEstado = porEstado, PorGps = porGps };
    }

    public async Task<HospitalExtensionDto> AsignarRegionHospitalAsync(
        int codigoContacto,
        AsignarRegionHospitalRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        var hospital = await _hospitalRepository.GetByIdAsync(codigoContacto, ct)
            ?? throw new InvalidOperationException($"No existe el hospital {codigoContacto}.");

        if (request.IdRegion.HasValue)
        {
            var region = await _regionRepository.GetByIdAsync(request.IdRegion.Value, ct);
            if (region is null || !region.Activo)
            {
                throw new InvalidOperationException($"No existe la región {request.IdRegion.Value}.");
            }
        }

        var extension = await _extensionRepository.GetByHospitalIdAsync(hospital.CodigoContacto, ct);
        if (extension is null)
        {
            extension = await _extensionRepository.CreateAsync(new HospitalExtension
            {
                IdHospital = hospital.CodigoContacto,
                IdRegion = request.IdRegion,
                IdUsuarioCreacion = idUsuario,
                IdUsuarioModificacion = idUsuario
            }, ct);
        }
        else
        {
            extension.IdRegion = request.IdRegion;
            extension.IdUsuarioModificacion = idUsuario;
            await _extensionRepository.UpdateAsync(extension, ct);
        }

        return extension.ToResponse();
    }

    // ---- Métodos del mapeo estado -> región ----

    public async Task<List<RegionEstadoDto>> GetMapeoEstadosAsync(CancellationToken ct = default)
    {
        var mapeos = await _regionRepository.GetMapeosAsync(ct);
        var nombresEstados = await NombresEstadosAsync(ct);

        return mapeos.Select(m => new RegionEstadoDto
        {
            CodigoEstado = m.CodigoEstado,
            NombreEstado = nombresEstados.GetValueOrDefault(m.CodigoEstado),
            IdRegion = m.IdRegion,
            NombreRegion = m.Region?.Nombre
        }).ToList();
    }

    public async Task<RegionEstadoDto> UpsertMapeoEstadoAsync(
        int codigoEstado,
        UpsertRegionEstadoRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        var region = await _regionRepository.GetByIdAsync(request.IdRegion, ct);
        if (region is null || !region.Activo)
        {
            throw new InvalidOperationException($"No existe la región {request.IdRegion}.");
        }

        var mapeo = await _regionRepository.GetMapeoByEstadoAsync(codigoEstado, ct);
        if (mapeo is null)
        {
            mapeo = await _regionRepository.CreateMapeoAsync(new RegionEstado
            {
                CodigoEstado = codigoEstado,
                IdRegion = request.IdRegion,
                IdUsuarioCreacion = idUsuario,
                IdUsuarioModificacion = idUsuario
            }, ct);
        }
        else
        {
            mapeo.IdRegion = request.IdRegion;
            mapeo.IdUsuarioModificacion = idUsuario;
            await _regionRepository.UpdateMapeoAsync(mapeo, ct);
        }

        var nombreEstado = (await _asokamContext.GenEstados
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.CodigoEstado == codigoEstado, ct))?.NombreEstado;

        return new RegionEstadoDto
        {
            CodigoEstado = codigoEstado,
            NombreEstado = nombreEstado,
            IdRegion = request.IdRegion,
            NombreRegion = region.Nombre
        };
    }

    // ---- Auxiliares ----

    private async Task<Dictionary<int, string?>> NombresEstadosAsync(CancellationToken ct)
    {
        return await _asokamContext.GenEstados
            .AsNoTracking()
            .ToDictionaryAsync(e => e.CodigoEstado, e => e.NombreEstado, ct);
    }

    private async Task<RegionDto> ToDtoAsync(RegionCatalogo region, List<int> codigoEstados, CancellationToken ct)
    {
        var conteos = await _regionRepository.GetConteosHospitalesAsync(ct);
        var nombresEstados = await NombresEstadosAsync(ct);

        return new RegionDto
        {
            IdRegion = region.IdRegion,
            Nombre = region.Nombre,
            CentroLatitud = region.CentroLatitud,
            CentroLongitud = region.CentroLongitud,
            Activo = region.Activo,
            CantidadHospitales = conteos.GetValueOrDefault(region.IdRegion),
            Estados = codigoEstados.Select(c => new RegionEstadoResumenDto
            {
                CodigoEstado = c,
                NombreEstado = nombresEstados.GetValueOrDefault(c)
            }).ToList()
        };
    }

    private static void ValidarNombre(string nombre)
    {
        if (string.IsNullOrWhiteSpace(nombre))
        {
            throw new InvalidOperationException("El nombre de la región es obligatorio.");
        }
    }
}
