using ErrorOr;
using Lefarma.API.Domain.Entities.Rh;
using Lefarma.API.Domain.Interfaces.Rh;
using Lefarma.API.Features.Rh.SolicitudesPersonal.DTOs;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.Rh.SolicitudesPersonal
{
    public class TipoSolicitudService : BaseService, ITipoSolicitudService
    {
        private readonly ITipoSolicitudRepository _repository;
        protected override string EntityName => "TipoSolicitud";

        public TipoSolicitudService(
            ITipoSolicitudRepository repository,
            IWideEventAccessor wideEventAccessor)
            : base(wideEventAccessor)
        {
            _repository = repository;
        }

        public async Task<ErrorOr<IEnumerable<TipoSolicitudResponse>>> GetAllAsync(TipoSolicitudRequest query)
        {
            try
            {
                var tiposQuery = await _repository.GetQueryableAsync();

                if (!string.IsNullOrWhiteSpace(query.Nombre))
                    tiposQuery = tiposQuery.Where(t => t.Nombre.Contains(query.Nombre));

                if (!string.IsNullOrWhiteSpace(query.Clave))
                    tiposQuery = tiposQuery.Where(t => t.Clave.Contains(query.Clave));

                if (!string.IsNullOrWhiteSpace(query.Categoria)
                    && Enum.TryParse<CategoriaSolicitud>(query.Categoria, ignoreCase: true, out var categoria))
                    tiposQuery = tiposQuery.Where(t => t.Categoria == categoria);

                if (query.Activo.HasValue)
                    tiposQuery = tiposQuery.Where(t => t.Activo == query.Activo.Value);

                tiposQuery = query.OrderBy?.ToLower() switch
                {
                    "nombre" => query.OrderDirection?.ToLower() == "desc"
                        ? tiposQuery.OrderByDescending(t => t.Nombre)
                        : tiposQuery.OrderBy(t => t.Nombre),
                    "clave" => query.OrderDirection?.ToLower() == "desc"
                        ? tiposQuery.OrderByDescending(t => t.Clave)
                        : tiposQuery.OrderBy(t => t.Clave),
                    "categoria" => query.OrderDirection?.ToLower() == "desc"
                        ? tiposQuery.OrderByDescending(t => t.Categoria)
                        : tiposQuery.OrderBy(t => t.Categoria),
                    "fechacreacion" => query.OrderDirection?.ToLower() == "desc"
                        ? tiposQuery.OrderByDescending(t => t.FechaCreacion)
                        : tiposQuery.OrderBy(t => t.FechaCreacion),
                    _ => tiposQuery.OrderBy(t => t.Nombre)
                };

                var tipos = await tiposQuery.ToListAsync();
                var response = tipos.Select(t => t.ToResponse()).ToList();

                EnrichWideEvent("GetAll", count: response.Count);
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("GetAll", exception: ex);
                return CommonErrors.DatabaseError("obtener los tipos de solicitud");
            }
        }

        public async Task<ErrorOr<TipoSolicitudResponse>> GetByIdAsync(int id)
        {
            try
            {
                var tipo = await _repository.GetByIdAsync(id);
                if (tipo is null)
                {
                    EnrichWideEvent("GetById", entityId: id, notFound: true);
                    return CommonErrors.NotFound("TipoSolicitud", id.ToString());
                }

                EnrichWideEvent("GetById", entityId: id, nombre: tipo.Nombre);
                return tipo.ToResponse();
            }
            catch (Exception ex)
            {
                EnrichWideEvent("GetById", entityId: id, exception: ex);
                return CommonErrors.DatabaseError("obtener el tipo de solicitud");
            }
        }

        public async Task<ErrorOr<TipoSolicitudResponse>> CreateAsync(CreateTipoSolicitudRequest request)
        {
            try
            {
                if (await _repository.ExistePorClaveAsync(request.Clave))
                {
                    EnrichWideEvent("Create", nombre: request.Clave, duplicate: true);
                    return CommonErrors.AlreadyExists("tipo de solicitud", "clave", request.Clave);
                }

                if (!Enum.TryParse<CategoriaSolicitud>(request.Categoria, ignoreCase: true, out var categoria))
                    return CommonErrors.Validation("Categoria", "La categoría no es válida.");

                var tipo = new TipoSolicitud
                {
                    Nombre = request.Nombre.Trim(),
                    NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre),
                    Descripcion = request.Descripcion?.Trim() ?? string.Empty,
                    DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion ?? string.Empty),
                    Clave = request.Clave.Trim(),
                    Categoria = categoria,
                    RequiereReposicionTiempo = request.RequiereReposicionTiempo,
                    RequiereFechaFin = request.RequiereFechaFin,
                    RequiereFechaRegreso = request.RequiereFechaRegreso,
                    RequiereLugarComision = request.RequiereLugarComision,
                    DescuentaNomina = request.DescuentaNomina,
                    DescuentaVacaciones = request.DescuentaVacaciones,
                    RequiereDocumentacion = request.RequiereDocumentacion,
                    PermiteFechasPasadas = request.PermiteFechasPasadas,
                    PermiteFechasFuturas = request.PermiteFechasFuturas,
                    TomaEnCuentaChecado = request.TomaEnCuentaChecado,
                    RequiereIncidenciasExistentes = request.RequiereIncidenciasExistentes,
                    PideDiasSolicitados = request.PideDiasSolicitados,
                    LimitePorPeriodo = request.LimitePorPeriodo,
                    PeriodoLimite = request.PeriodoLimite,
                    TotalParaDescuento = request.TotalParaDescuento,
                    Activo = request.Activo,
                    FechaCreacion = DateTime.Now
                };

                var result = await _repository.AddAsync(tipo);
                EnrichWideEvent("Create", entityId: result.IdTipoSolicitud, nombre: result.Nombre);
                return result.ToResponse();
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent("Create", nombre: request.Clave, exception: ex);
                if (ex.InnerException is Microsoft.Data.SqlClient.SqlException sqlEx
                    && (sqlEx.Number == 2601 || sqlEx.Number == 2627))
                {
                    return CommonErrors.AlreadyExists("tipo de solicitud", "clave", request.Clave);
                }
                return CommonErrors.DatabaseError("guardar el tipo de solicitud");
            }
            catch (Exception ex)
            {
                EnrichWideEvent("Create", exception: ex);
                return CommonErrors.InternalServerError("Error inesperado al crear el tipo de solicitud.");
            }
        }

        public async Task<ErrorOr<TipoSolicitudResponse>> UpdateAsync(int id, UpdateTipoSolicitudRequest request)
        {
            try
            {
                var tipo = await _repository.GetByIdAsync(id);
                if (tipo is null)
                {
                    EnrichWideEvent("Update", entityId: id, notFound: true);
                    return CommonErrors.NotFound("TipoSolicitud", id.ToString());
                }

                if (await _repository.ExistePorClaveAsync(request.Clave, id))
                {
                    EnrichWideEvent("Update", entityId: id, nombre: request.Clave, duplicate: true);
                    return CommonErrors.AlreadyExists("tipo de solicitud", "clave", request.Clave);
                }

                if (!Enum.TryParse<CategoriaSolicitud>(request.Categoria, ignoreCase: true, out var categoria))
                    return CommonErrors.Validation("Categoria", "La categoría no es válida.");

                tipo.Nombre = request.Nombre.Trim();
                tipo.NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre);
                tipo.Descripcion = request.Descripcion?.Trim() ?? string.Empty;
                tipo.DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion ?? string.Empty);
                tipo.Clave = request.Clave.Trim();
                tipo.Categoria = categoria;
                tipo.RequiereReposicionTiempo = request.RequiereReposicionTiempo;
                tipo.RequiereFechaFin = request.RequiereFechaFin;
                tipo.RequiereFechaRegreso = request.RequiereFechaRegreso;
                tipo.RequiereLugarComision = request.RequiereLugarComision;
                tipo.DescuentaNomina = request.DescuentaNomina;
                tipo.DescuentaVacaciones = request.DescuentaVacaciones;
                tipo.RequiereDocumentacion = request.RequiereDocumentacion;
                tipo.PermiteFechasPasadas = request.PermiteFechasPasadas;
                tipo.PermiteFechasFuturas = request.PermiteFechasFuturas;
                tipo.TomaEnCuentaChecado = request.TomaEnCuentaChecado;
                tipo.RequiereIncidenciasExistentes = request.RequiereIncidenciasExistentes;
                tipo.PideDiasSolicitados = request.PideDiasSolicitados;
                tipo.LimitePorPeriodo = request.LimitePorPeriodo;
                tipo.PeriodoLimite = request.PeriodoLimite;
                tipo.TotalParaDescuento = request.TotalParaDescuento;
                tipo.Activo = request.Activo;
                tipo.FechaModificacion = DateTime.Now;

                await _repository.UpdateAsync(tipo);

                EnrichWideEvent("Update", entityId: id, nombre: tipo.Nombre);
                return tipo.ToResponse();
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent("Update", entityId: id, nombre: request.Clave, exception: ex);
                if (ex.InnerException is Microsoft.Data.SqlClient.SqlException sqlEx
                    && (sqlEx.Number == 2601 || sqlEx.Number == 2627))
                {
                    return CommonErrors.AlreadyExists("tipo de solicitud", "clave", request.Clave);
                }
                return CommonErrors.DatabaseError("actualizar el tipo de solicitud");
            }
            catch (Exception ex)
            {
                EnrichWideEvent("Update", entityId: id, exception: ex);
                return CommonErrors.InternalServerError("Error inesperado al actualizar el tipo de solicitud.");
            }
        }

        public async Task<ErrorOr<bool>> DeleteAsync(int id)
        {
            try
            {
                var tipo = await _repository.GetByIdAsync(id);
                if (tipo is null)
                {
                    EnrichWideEvent("Delete", entityId: id, notFound: true);
                    return CommonErrors.NotFound("TipoSolicitud", id.ToString());
                }

                if (await _repository.TieneSolicitudesAsociadasAsync(id))
                    return CommonErrors.HasDependencies("Tipo de solicitud");

                await _repository.DeleteAsync(tipo);

                EnrichWideEvent("Delete", entityId: id, nombre: tipo.Nombre);
                return true;
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent("Delete", entityId: id, exception: ex);
                return CommonErrors.HasDependencies("Tipo de solicitud");
            }
            catch (Exception ex)
            {
                EnrichWideEvent("Delete", entityId: id, exception: ex);
                return CommonErrors.InternalServerError("Error inesperado al eliminar el tipo de solicitud.");
            }
        }

        public async Task<ErrorOr<IEnumerable<TipoSolicitudResponse>>> GetActivosAsync()
        {
            try
            {
                var tipos = await _repository.GetTiposActivosAsync();
                var response = tipos.Select(t => t.ToResponse()).ToList();

                EnrichWideEvent("GetActivos", count: response.Count);
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent("GetActivos", exception: ex);
                return CommonErrors.DatabaseError("obtener los tipos de solicitud activos");
            }
        }
    }
}
