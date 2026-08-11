using Lefarma.API.Features.Rh.Vacaciones.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Extensions;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;
using System.Security.Claims;

namespace Lefarma.API.Features.Rh.Vacaciones
{
    [Route("api/rh/vacaciones")]
    [ApiController]
    [EndpointGroupName("Vacaciones")]
    [Authorize]
    public class VacacionesController : ControllerBase
    {
        private readonly IVacacionesService _service;

        public VacacionesController(IVacacionesService service)
        {
            _service = service;
        }

        //cargar
        [HttpGet("dias-habiles")]
        [SwaggerOperation(Summary = "Obtener días hábiles")]
        public async Task<IActionResult> ObtenerDiasNoHabiles([FromQuery] DiaHabilRequest request)
        {
            var result = await _service.ObtenerDiasHabilesAsync(request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<List<DiaHabilResponse>>
            {
                Success = true,
                Message = "Días hábiles obtenidos exitosamente.",
                Data = data
            }));
        }

        [HttpPost("dias-habiles")]
        [SwaggerOperation(Summary = "Cargar días hábiles manualmente")]
        public async Task<IActionResult> CargarDiasNoHabiles([FromBody] CargaDiasHabilesRequest request)
        {
            var idUsuario = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await _service.CargarDiasHabilesManualAsync(request, idUsuario);
            return result.ToActionResult(this, data => Ok(new ApiResponse<CargaDiasHabilesResultResponse>
            {
                Success = true,
                Message = "Días hábiles cargados exitosamente.",
                Data = data
            }));
        }

        [HttpPost("dias-habiles/csv")]
        [SwaggerOperation(Summary = "Cargar días hábiles desde CSV")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> CargarDiasHabilesCsv([FromForm] int idEmpresa, [FromForm] int idSucursal, IFormFile file)
        {
            var idUsuario = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await _service.CargarDiasHabilesDesdeCsvAsync(file, idEmpresa, idSucursal, idUsuario);
            return result.ToActionResult(this, data => Ok(new ApiResponse<CargaDiasHabilesResultResponse>
            {
                Success = true,
                Message = "CSV procesado exitosamente.",
                Data = data
            }));
        }

        [HttpDelete("dias-habiles/{id}")]
        [SwaggerOperation(Summary = "Eliminar un día hábil")]
        public async Task<IActionResult> EliminarDiaHabil(int id)
        {
            var idUsuario = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await _service.EliminarDiaHabilAsync(id, idUsuario);
            return result.ToActionResult(this, _ => Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Día hábil eliminado exitosamente.",
                Data = null
            }));
        }

        [HttpGet("dias-habiles/{id}/usuarios")] 
        [SwaggerOperation(Summary = "Obtener usuarios afectados por un día hábil")]
        public async Task<IActionResult> ObtenerUsuariosAfectados(int id)
        {
            var result = await _service.ObtenerUsuariosAfectadosAsync(id);
            return result.ToActionResult(this, data => Ok(new ApiResponse<List<UsuarioAfectadoResponse>>
            {
                Success = true,
                Message = "Usuarios afectados obtenidos exitosamente.",
                Data = data
            }));
        }

        [HttpGet("saldos")]
        [SwaggerOperation(Summary = "Obtener saldos anuales de vacaciones")]
        public async Task<IActionResult> ObtenerSaldos([FromQuery] SaldoVacacionesRequest request)
        {
            var result = await _service.ObtenerSaldosAsync(request);
            return result.ToActionResult(this, data => Ok(new ApiResponse<List<SaldoVacacionesResponse>>
            {
                Success = true,
                Message = "Saldos obtenidos exitosamente.",
                Data = data
            }));
        }

        [HttpPost("saldos")]
        [SwaggerOperation(Summary = "Cargar saldo anual de vacaciones")]
        public async Task<IActionResult> CargarSaldo([FromBody] SaldoVacacionesCreateRequest request)
        {
            var idUsuario = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await _service.CargarSaldoAsync(request, idUsuario);
            return result.ToActionResult(this, data => Ok(new ApiResponse<SaldoVacacionesResponse>
            {
                Success = true,
                Message = "Saldo cargado exitosamente.",
                Data = data
            }));
        }

        [HttpPost("saldos/sincronizar")]
        [SwaggerOperation(Summary = "Sincronizar saldos de vacaciones desde vwEmpleados")]
        public async Task<IActionResult> SincronizarSaldos([FromBody] SincronizarSaldosRequest request)
        {
            var idUsuario = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var result = await _service.SincronizarSaldosAsync(request, idUsuario);
            return result.ToActionResult(this, data => Ok(new ApiResponse<SincronizarSaldosResponse>
            {
                Success = true,
                Message = $"Sincronización completada: {data.Creados} creados, {data.Actualizados} actualizados, {data.Omitidos} omitidos.",
                Data = data
            }));
        }
    }
}
