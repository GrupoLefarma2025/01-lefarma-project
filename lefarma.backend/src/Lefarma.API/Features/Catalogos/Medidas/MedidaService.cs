using ErrorOr;
using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Interfaces.Catalogos;
using Lefarma.API.Features.Catalogos.Medidas.DTOs;
using Lefarma.API.Infrastructure.Data.Repositories.Catalogos;
using Lefarma.API.Shared.Errors;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Logging;
using Lefarma.API.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using System.Linq;

namespace Lefarma.API.Features.Catalogos.Medidas
{
public class MedidaService : BaseService, IMedidaService
    {
        private readonly IMedidaRepository _medidaRepository;
        private readonly IUnidadMedidaRepository _unidadMedidaRepository;
        private readonly ILogger<MedidaService> _logger;
        protected override string EntityName => "Medida";

        public MedidaService(
            IMedidaRepository medidaRepository,
            IUnidadMedidaRepository unidadMedidaRepository,
            IWideEventAccessor wideEventAccessor,
            ILogger<MedidaService> logger)
            : base(wideEventAccessor)
        {
            _medidaRepository = medidaRepository;
            _unidadMedidaRepository = unidadMedidaRepository;
            _logger = logger;
        }

        public async Task<ErrorOr<IEnumerable<MedidaResponse>>> GetAllAsync(MedidaRequest query)
        {
            try
            {
                IQueryable<Medida> queryable = _medidaRepository.GetQueryable()
                    .Include(m => m.UnidadesMedida);

                if (!string.IsNullOrWhiteSpace(query.Nombre))
                    queryable = queryable.Where(m => m.Nombre.Contains(query.Nombre));

                if (query.Activo.HasValue)
                    queryable = queryable.Where(m => m.Activo == query.Activo.Value);

                queryable = (query.OrderBy?.ToLower(), query.OrderDirection?.ToLower()) switch
                {
                    ("nombre", "desc") => queryable.OrderByDescending(m => m.Nombre),
                    ("fechacreacion", "asc") => queryable.OrderBy(m => m.FechaCreacion),
                    ("fechacreacion", "desc") => queryable.OrderByDescending(m => m.FechaCreacion),
                    _ => queryable.OrderBy(m => m.Nombre)
                };

                var result = await queryable.ToListAsync();

                if (!result.Any())
                {
                    EnrichWideEvent(action: "GetAll", count: 0, additionalContext: new Dictionary<string, object>
                    {
                        ["filters"] = new { query.Nombre, query.Activo, query.OrderBy, query.OrderDirection }
                    });
                    return new List<MedidaResponse>();
                }

                var response = result.Select(m => m.ToResponse()).ToList();

                EnrichWideEvent(action: "GetAll", count: response.Count, additionalContext: new Dictionary<string, object>
                {
                    ["filters"] = new { query.Nombre, query.Activo, query.OrderBy, query.OrderDirection },
                    ["items"] = response.Select(m => m.Nombre).ToList()
                });
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetAll", exception: ex);
                return CommonErrors.DatabaseError("obtener las medidas");
            }
        }

        public async Task<ErrorOr<MedidaResponse>> GetByIdAsync(int id)
        {
            try
            {
                var result = await _medidaRepository.GetByIdAsync(id);
                if (result == null)
                {
                    EnrichWideEvent(action: "GetById", entityId: id, notFound: true);
                    return CommonErrors.NotFound("medida", id.ToString());
                }

                var response = result.ToResponse();
                EnrichWideEvent(action: "GetById", entityId: id, nombre: response.Nombre);
                return response;
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "GetById", entityId: id, exception: ex);
                return CommonErrors.DatabaseError($"obtener la medida");
            }
        }

        public async Task<ErrorOr<MedidaResponse>> CreateAsync(CreateMedidaRequest request)
        {
            try
            {
                var existeNombre = await _medidaRepository.ExistsAsync(t => t.Nombre == request.Nombre);
                if (existeNombre)
                {
                    EnrichWideEvent(action: "Create", nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("medida", "nombre", request.Nombre);
                }

                var medida = new Medida
                {
                    Nombre = request.Nombre.Trim(),
                    NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre),
                    Descripcion = request.Descripcion,
                    DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion),
                    Activo = request.Activo,
                    FechaCreacion = DateTime.UtcNow
                };

                var result = await _medidaRepository.AddAsync(medida);


                await _unidadMedidaRepository.ActualizarActivosAsync(result.IdMedida, request.UnidadesMedida);

                EnrichWideEvent(action: "Create", entityId: result.IdMedida, nombre: result.Nombre);
                return result.ToResponse();
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Nombre, exception: ex);
                return CommonErrors.DatabaseError($"guardar la medida");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Create", nombre: request.Nombre, exception: ex);
                return CommonErrors.InternalServerError($"Error inesperado al crear la medida.");
            }
        }

        public async Task<ErrorOr<MedidaResponse>> UpdateAsync(int id, UpdateMedidaRequest request)
        {
            try
            {
                var medida = await _medidaRepository.GetByIdAsync(id);
                if (medida == null)
                {
                    EnrichWideEvent(action: "Update", entityId: id, notFound: true);
                    return CommonErrors.NotFound("medida", id.ToString());
                }

                var existeNombre = await _medidaRepository.ExistsAsync(t => t.Nombre == request.Nombre && t.IdMedida != id);
                if (existeNombre)
                {
                    EnrichWideEvent(action: "Update", entityId: id, nombre: request.Nombre, duplicate: true);
                    return CommonErrors.AlreadyExists("medida", "nombre", request.Nombre);
                }

                medida.Nombre = request.Nombre.Trim();
                medida.NombreNormalizado = StringExtensions.RemoveDiacritics(request.Nombre);
                medida.Descripcion = request.Descripcion;
                medida.DescripcionNormalizada = StringExtensions.RemoveDiacritics(request.Descripcion);
                medida.Activo = request.Activo;
                medida.FechaModificacion = DateTime.UtcNow;

                var result = await _medidaRepository.UpdateAsync(medida);

                await _unidadMedidaRepository.ActualizarActivosAsync(result.IdMedida, request.UnidadesMedida);

                EnrichWideEvent(action: "Update", entityId: id, nombre: result.Nombre);
                return result.ToResponse();
            }
            catch (DbUpdateConcurrencyException ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, exception: ex);
                return CommonErrors.ConcurrencyError("medida");
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, exception: ex);
                return CommonErrors.DatabaseError($"actualizar la medida");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Update", entityId: id, exception: ex);
                return CommonErrors.InternalServerError($"Error inesperado al actualizar la medida.");
            }
        }

        public async Task<ErrorOr<bool>> DeleteAsync(int id)
        {
            try
            {
                var medida = await _medidaRepository.GetByIdAsync(id);
                if (medida == null)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, notFound: true);
                    return CommonErrors.NotFound("medida", id.ToString());
                }

                var eliminado = await _medidaRepository.DeleteAsync(medida);
                if (!eliminado)
                {
                    EnrichWideEvent(action: "Delete", entityId: id, deleteFailed: true);
                    return CommonErrors.DeleteFailed("medida");
                }

                EnrichWideEvent(action: "Delete", entityId: id, nombre: medida.Nombre);
                return true;
            }
            catch (DbUpdateException ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, exception: ex);
                return CommonErrors.HasDependencies("Medida");
            }
            catch (Exception ex)
            {
                EnrichWideEvent(action: "Delete", entityId: id, exception: ex);
                return CommonErrors.InternalServerError($"Error inesperado al eliminar la medida.");
            }
        }
    }
}
