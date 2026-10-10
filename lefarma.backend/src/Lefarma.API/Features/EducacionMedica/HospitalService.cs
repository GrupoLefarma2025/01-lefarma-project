using Lefarma.API.Domain.Entities.EducacionMedica;
using Lefarma.API.Domain.Interfaces.EducacionMedica;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Features.EducacionMedica.Services;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;

namespace Lefarma.API.Features.EducacionMedica;

public class HospitalService : IHospitalService
{
    private readonly IHospitalRepository _hospitalRepository;
    private readonly IHospitalExtensionRepository _extensionRepository;
    private readonly ITipoGerenciaRepository _tipoGerenciaRepository;
    private readonly IParametroAnestesiaRepository _parametroAnestesiaRepository;
    private readonly IRegionRepository _regionRepository;

    public HospitalService(
        IHospitalRepository hospitalRepository,
        IHospitalExtensionRepository extensionRepository,
        ITipoGerenciaRepository tipoGerenciaRepository,
        IParametroAnestesiaRepository parametroAnestesiaRepository,
        IRegionRepository regionRepository)
    {
        _hospitalRepository = hospitalRepository;
        _extensionRepository = extensionRepository;
        _tipoGerenciaRepository = tipoGerenciaRepository;
        _parametroAnestesiaRepository = parametroAnestesiaRepository;
        _regionRepository = regionRepository;
    }

    public async Task<PagedResult<HospitalDto>> GetHospitalesAsync(HospitalFilterParams? filter = null, CancellationToken ct = default)
    {
        filter ??= new HospitalFilterParams();

        var resultado = await ObtenerHospitalesFiltradosAsync(filter, ct);
        if (resultado.Count == 0)
        {
            return new PagedResult<HospitalDto>();
        }

        var totalCount = resultado.Count;
        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);

        var items = resultado
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        return new PagedResult<HospitalDto>
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
        };
    }

    private async Task<List<HospitalDto>> ObtenerHospitalesFiltradosAsync(
        HospitalFilterParams filter,
        CancellationToken ct)
    {
        // Regla de negocio explícita: el buscador/catálogo no ofrece Privados ni Distribuidores.
        filter.ExcluirTipos = ["Privado", "Distribuidor"];

        var hospitales = await _hospitalRepository.GetHospitalesAsync(filter, ct);
        if (hospitales.Count == 0)
        {
            return [];
        }

        var ids = hospitales.Select(h => h.CodigoContacto).ToList();
        var extensiones = await _extensionRepository.GetByHospitalIdsAsync(ids, ct);
        var tipos = await _tipoGerenciaRepository.GetAllAsync(ct);
        var tiposDict = tipos.ToDictionary(t => t.IdTipoGerencia, t => t.Descripcion);
        var regionesDict = (await _regionRepository.GetAllAsync(ct)).ToDictionary(r => r.IdRegion, r => r.Nombre);

        var extDict = extensiones.ToDictionary(e => e.IdHospital);

        var idsPadres = hospitales
            .Where(h => h.CodigoContactoPrincipal.HasValue)
            .Select(h => h.CodigoContactoPrincipal!.Value)
            .Distinct()
            .ToList();

        var padres = idsPadres.Count > 0
            ? await _hospitalRepository.GetByIdsAsync(idsPadres, ct)
            : new List<Hospital>();

        var padresDict = padres.ToDictionary(p => p.CodigoContacto, p => p.NombreContacto ?? string.Empty);

        var resultado = hospitales.Select(h => h.ToResponse(
            extDict.GetValueOrDefault(h.CodigoContacto),
            tiposDict,
            h.CodigoContactoPrincipal.HasValue && padresDict.TryGetValue(h.CodigoContactoPrincipal.Value, out var nom)
                ? nom
                : null,
            regionesDict)).ToList();

        resultado = AplicarFiltrosExtension(resultado, filter);
        resultado = Ordenar(resultado, filter.OrderBy, filter.OrderDirection);

        return resultado;
    }

    public async Task<List<HospitalUbicacionDto>> GetUbicacionesAsync(
        HospitalFilterParams? filter = null,
        CancellationToken ct = default)
    {
        filter ??= new HospitalFilterParams();
        var hospitales = await ObtenerHospitalesFiltradosAsync(filter, ct);

        return hospitales
            .Where(h => h.Latitud.HasValue && h.Longitud.HasValue)
            .Select(h => new HospitalUbicacionDto
            {
                CodigoContacto = h.CodigoContacto,
                NombreContacto = h.NombreContacto,
                NombreCorto = h.NombreCorto,
                Clues = h.Clues,
                Ciudad = h.Ciudad,
                CodigoEstado = h.CodigoEstado,
                Latitud = h.Latitud,
                Longitud = h.Longitud,
                IdRegion = h.Extension?.IdRegion,
                RegionNombre = h.Extension?.RegionNombre,
            })
            .ToList();
    }

    private static List<HospitalDto> AplicarFiltrosExtension(List<HospitalDto> hospitales, HospitalFilterParams filter)
    {
        if (!string.IsNullOrWhiteSpace(filter.FiltroSede))
        {
            hospitales = filter.FiltroSede.ToLowerInvariant() switch
            {
                // "sedes" excluye solo los marcados explícitamente como logísticos (0);
                // los NULL (sin clasificar) se conservan para no ocultar hospitales.
                "sedes" => hospitales.Where(h => h.Extension?.EsSedeTaller != false).ToList(),
                "logisticos" => hospitales.Where(h => h.Extension?.EsSedeTaller == false).ToList(),
                "sin-clasificar" => hospitales
                    .Where(h => h.Extension is not null && h.Extension.EsSedeTaller == null)
                    .ToList(),
                _ => hospitales,
            };
        }

        if (filter.ConSia.HasValue)
        {
            hospitales = hospitales
                .Where(h => h.Extension?.ConSia == filter.ConSia.Value)
                .ToList();
        }

        if (filter.IdTipoGerencia.HasValue)
        {
            hospitales = hospitales
                .Where(h => h.Extension?.IdTipoGerencia == filter.IdTipoGerencia.Value)
                .ToList();
        }

        if (filter.IdRegion.HasValue)
        {
            hospitales = hospitales
                .Where(h => h.Extension?.IdRegion == filter.IdRegion.Value)
                .ToList();
        }

        if (filter.NumeroQuirofanosMin.HasValue)
        {
            hospitales = hospitales
                .Where(h => (h.Extension?.NumeroQuirofanos ?? 0) >= filter.NumeroQuirofanosMin.Value)
                .ToList();
        }

        if (filter.AnestesiasTotalesMin.HasValue)
        {
            hospitales = hospitales
                .Where(h => (h.Extension?.AnestesiasTotales ?? 0) >= filter.AnestesiasTotalesMin.Value)
                .ToList();
        }

        return hospitales;
    }

    private static List<HospitalDto> Ordenar(List<HospitalDto> hospitales, string? orderBy, string? orderDirection)
    {
        var asc = !string.Equals(orderDirection, "desc", StringComparison.OrdinalIgnoreCase);

        return (orderBy?.ToLowerInvariant() switch
        {
            "clues" => asc
                ? hospitales.OrderBy(h => h.Clues ?? string.Empty)
                : hospitales.OrderByDescending(h => h.Clues ?? string.Empty),
            "institucion" => asc
                ? hospitales.OrderBy(h => h.Institucion ?? string.Empty)
                : hospitales.OrderByDescending(h => h.Institucion ?? string.Empty),
            "gerencia" => asc
                ? hospitales.OrderBy(h => h.Extension?.TipoGerencia ?? string.Empty)
                : hospitales.OrderByDescending(h => h.Extension?.TipoGerencia ?? string.Empty),
            "sia" => asc
                ? hospitales.OrderBy(h => h.Extension?.ConSia == true)
                : hospitales.OrderByDescending(h => h.Extension?.ConSia == true),
            "quirofanos" => asc
                ? hospitales.OrderBy(h => h.Extension?.NumeroQuirofanos ?? 0)
                : hospitales.OrderByDescending(h => h.Extension?.NumeroQuirofanos ?? 0),
            "anestesiasTotales" => asc
                ? hospitales.OrderBy(h => h.Extension?.AnestesiasTotales ?? 0)
                : hospitales.OrderByDescending(h => h.Extension?.AnestesiasTotales ?? 0),
            "anestesiasGenerales" => asc
                ? hospitales.OrderBy(h => h.Extension?.AnestesiasGenerales ?? 0)
                : hospitales.OrderByDescending(h => h.Extension?.AnestesiasGenerales ?? 0),
            "anestesiasRegionales" => asc
                ? hospitales.OrderBy(h => h.Extension?.AnestesiasRegionales ?? 0)
                : hospitales.OrderByDescending(h => h.Extension?.AnestesiasRegionales ?? 0),
            _ => asc
                ? hospitales.OrderBy(h => h.NombreContacto)
                : hospitales.OrderByDescending(h => h.NombreContacto),
        }).ToList();
    }

    public async Task<HospitalDto?> GetHospitalByIdAsync(int idHospital, CancellationToken ct = default)
    {
        var hospital = await _hospitalRepository.GetByIdAsync(idHospital, ct);
        if (hospital is null) return null;

        var extension = await _extensionRepository.GetByHospitalIdAsync(idHospital, ct);
        var tipos = await _tipoGerenciaRepository.GetAllAsync(ct);
        var tiposDict = tipos.ToDictionary(t => t.IdTipoGerencia, t => t.Descripcion);
        var regionesDict = (await _regionRepository.GetAllAsync(ct)).ToDictionary(r => r.IdRegion, r => r.Nombre);

        return hospital.ToResponse(extension, tiposDict, null, regionesDict);
    }

    public async Task<HospitalExtensionDto> UpsertExtensionAsync(
        int idHospital,
        UpsertHospitalExtensionRequest request,
        int idUsuario,
        CancellationToken ct = default)
    {
        var anioActual = DateTime.UtcNow.Year;
        var parametros = await _parametroAnestesiaRepository.GetByAnioAsync(anioActual, ct);
        var factores = parametros.ToDictionary(p => p.Clave, p => p.Valor);

        var existing = await _extensionRepository.GetByHospitalIdAsync(idHospital, ct);

        if (request.IdRegion.HasValue)
        {
            var region = await _regionRepository.GetByIdAsync(request.IdRegion.Value, ct);
            if (region is null || !region.Activo)
            {
                throw new InvalidOperationException($"No existe la región {request.IdRegion.Value}.");
            }

            var gerenciaEfectiva = request.IdTipoGerencia ?? existing?.IdTipoGerencia;
            if (gerenciaEfectiva is null)
            {
                throw new InvalidOperationException(
                    "El hospital no tiene gerencia asignada. Asigne una gerencia antes de asignarle región.");
            }

            if (region.IdTipoGerencia != gerenciaEfectiva)
            {
                throw new InvalidOperationException(
                    $"La región '{region.Nombre}' pertenece a otra gerencia; solo se pueden asignar regiones de la gerencia del hospital.");
            }
        }

        if (existing is null)
        {
            var created = await _extensionRepository.CreateAsync(new Domain.Entities.EducacionMedica.HospitalExtension
            {
                IdHospital = idHospital,
                Fecha = request.Fecha,
                IdTipoGerencia = request.IdTipoGerencia,
                IdRegion = request.IdRegion,
                ConSia = request.ConSia,
                NumeroQuirofanos = request.NumeroQuirofanos,
                EsZonaMetropolitana = request.EsZonaMetropolitana,
                EsAlmacen = request.EsAlmacen,
                EsFarmacia = request.EsFarmacia,
                EsSedeTaller = request.EsSedeTaller,
                IdUsuarioCreacion = idUsuario,
                IdUsuarioModificacion = idUsuario
            }, ct);

            AnestesiaCalculator.Calcular(created, factores);
            await _extensionRepository.UpdateAsync(created, ct);

            return created.ToResponse();
        }

        existing.Fecha = request.Fecha;
        existing.IdTipoGerencia = request.IdTipoGerencia;
        existing.IdRegion = request.IdRegion;
        existing.ConSia = request.ConSia;
        existing.NumeroQuirofanos = request.NumeroQuirofanos;
        existing.EsZonaMetropolitana = request.EsZonaMetropolitana;
        existing.EsAlmacen = request.EsAlmacen;
        existing.EsFarmacia = request.EsFarmacia;
        existing.EsSedeTaller = request.EsSedeTaller;
        existing.IdUsuarioModificacion = idUsuario;

        AnestesiaCalculator.Calcular(existing, factores);

        await _extensionRepository.UpdateAsync(existing, ct);

        var tipoDescripcion = request.IdTipoGerencia.HasValue
            ? (await _tipoGerenciaRepository.GetByIdAsync(request.IdTipoGerencia.Value, ct))?.Descripcion
            : null;

        return existing.ToResponse(tipoDescripcion);
    }

    public async Task<int> RecalcularAnestesiasAsync(int anio, CancellationToken ct = default)
    {
        var parametros = await _parametroAnestesiaRepository.GetByAnioAsync(anio, ct);
        if (parametros.Count == 0)
        {
            throw new InvalidOperationException($"No existen parametros de anestesias para el anio {anio}.");
        }

        var factores = parametros.ToDictionary(p => p.Clave, p => p.Valor);
        var extensiones = await _extensionRepository.GetAllAsync(ct);

        foreach (var extension in extensiones)
        {
            AnestesiaCalculator.Calcular(extension, factores);
            await _extensionRepository.UpdateAsync(extension, ct);
        }

        return extensiones.Count;
    }

    public async Task<SincronizarHospitalesResponse> SincronizarExtensionesAsync(
        int idUsuario,
        CancellationToken ct = default)
    {
        // Universo = el mismo del catálogo: activos y sin Privado/Distribuidor.
        var hospitales = await _hospitalRepository.GetHospitalesAsync(
            new HospitalFilterParams { ExcluirTipos = ["Privado", "Distribuidor"] }, ct);

        if (hospitales.Count == 0)
        {
            return new SincronizarHospitalesResponse();
        }

        var ids = hospitales.Select(h => h.CodigoContacto).ToList();
        var existentes = await _extensionRepository.GetByHospitalIdsAsync(ids, ct);
        var idsConExtension = existentes.Select(e => e.IdHospital).ToHashSet();

        // Gerencia por jerarquía institucional (espeja el script 0019).
        var tiposGerencia = await _tipoGerenciaRepository.GetAllAsync(ct);
        var idsPorGerencia = tiposGerencia.ToDictionary(t => t.Descripcion, t => t.IdTipoGerencia);

        // Solo altas: las extensiones existentes no se insertan ni actualizan.
        var nuevas = hospitales
            .Where(h => !idsConExtension.Contains(h.CodigoContacto))
            .Select(h =>
            {
                var (esAlmacen, esFarmacia, esSedeTaller) = ClasificarContacto(h, hospitales);
                return new HospitalExtension
                {
                    IdHospital = h.CodigoContacto,
                    IdTipoGerencia = idsPorGerencia.TryGetValue(ClasificarTipoGerencia(h), out var idGerencia)
                        ? idGerencia
                        : null,
                    EsZonaMetropolitana = ClasificarZonaMetropolitana(h),
                    EsAlmacen = esAlmacen,
                    EsFarmacia = esFarmacia,
                    EsSedeTaller = esSedeTaller,
                    IdUsuarioCreacion = idUsuario,
                    IdUsuarioModificacion = idUsuario,
                };
            })
            .ToList();

        if (nuevas.Count > 0)
        {
            await _extensionRepository.CreateRangeAsync(nuevas, ct);
        }

        return new SincronizarHospitalesResponse
        {
            TotalHospitales = hospitales.Count,
            Creadas = nuevas.Count,
            YaExistian = idsConExtension.Count,
        };
    }

    /// <summary>
    /// Gerencia por jerarquía institucional (espeja vw_hospitales_clasificados y el
    /// script 0019): 364 o hijo de 364 -> IMSS; tipo Privado -> Privado; todo lo demás
    /// (Gobierno, Bienestar 385, ISSSTE 370, tipo NULL) -> Descentralizado.
    /// </summary>
    private static string ClasificarTipoGerencia(Hospital hospital)
    {
        if (hospital.CodigoContacto == 364 || hospital.CodigoContactoPrincipal == 364)
        {
            return "IMSS";
        }

        return hospital.Tipo == "Privado" ? "Privado" : "Descentralizado";
    }

    /// <summary>
    /// Clasificación del contacto como sede/logístico (espeja el script 0024): almacenes
    /// delegacionales/subdelegacionales y BIRMEX no son sede; el sub-almacén es la sede
    /// preferente de su UMAE; la farmacia es sede solo si no existe sub-almacén del mismo
    /// prefijo; el resto es sede.
    /// </summary>
    private static (bool EsAlmacen, bool EsFarmacia, bool EsSedeTaller) ClasificarContacto(
        Hospital hospital,
        IReadOnlyCollection<Hospital> universo)
    {
        var nombre = (hospital.NombreContacto ?? string.Empty).Trim().ToUpperInvariant();

        var esAlmacenDistribucion =
            nombre.Contains("BIRMEX")
            || (nombre.Contains("ALMAC") && (nombre.Contains("DELEGACIONAL") || nombre.Contains("DELEGACION")));
        if (esAlmacenDistribucion)
        {
            return (true, false, false);
        }

        if (nombre.Contains("SUB-ALMAC") || nombre.Contains("SUB ALMAC"))
        {
            return (true, false, true);
        }

        if (nombre.Contains("FARMACIA"))
        {
            var baseNombre = nombre.Replace(" - FARMACIA", string.Empty);
            var tieneSubAlmacen = universo.Any(o =>
            {
                var n = (o.NombreContacto ?? string.Empty).Trim().ToUpperInvariant();
                return (n.Contains("SUB-ALMAC") || n.Contains("SUB ALMAC"))
                    && n.StartsWith(baseNombre, StringComparison.Ordinal);
            });
            return (false, true, !tieneSubAlmacen);
        }

        return (false, false, true);
    }

    /// <summary>
    /// ZMVM: CDMX (493) y municipios conurbados de Edomex (501); espeja la regla
    /// del script 0017 (clasificar zona metropolitana).
    /// </summary>
    private static bool ClasificarZonaMetropolitana(Hospital hospital)
    {
        if (!int.TryParse(hospital.CodigoEstado, out var codigoEstado))
        {
            return false;
        }

        if (codigoEstado == 493)
        {
            return true;
        }

        if (codigoEstado != 501)
        {
            return false;
        }

        var ciudad = (hospital.Ciudad ?? string.Empty).Trim().ToUpperInvariant();
        return ciudad.StartsWith("ECATEPEC")
            || ciudad.StartsWith("CIUDAD ECATEPEC")
            || ciudad.StartsWith("NEZAHUALC")
            || ciudad.StartsWith("NETZAHUALC")
            || ciudad.StartsWith("NAUCALPAN")
            || ciudad.StartsWith("TLALNEPANTLA")
            || ciudad.Contains("UAUTITLAN")
            || ciudad.StartsWith("TULTITLAN")
            || ciudad.StartsWith("COACALCO")
            || (ciudad.StartsWith("NICOL") && ciudad.Contains("ROMERO"))
            || ciudad.StartsWith("ATIZAPAN")
            || ciudad.StartsWith("MELCHOR OCAMPO")
            || ciudad.StartsWith("CHIMALHUAC")
            || ciudad.StartsWith("IXTAPALUCA")
            || ciudad.StartsWith("VALLE DE CHALCO")
            || ciudad.StartsWith("CHICOLOAPAN")
            || ciudad.StartsWith("TEPOZOTL")
            || ciudad == "LA PAZ";
    }
}
