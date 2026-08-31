using Lefarma.API.Features.Config.EmpleadoJefes.DTOs;
using Lefarma.API.Shared.Authorization;
using Lefarma.API.Shared.Constants;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Mvc;

namespace Lefarma.API.Features.Config.EmpleadoJefes
{
    [ApiController]
    //    [HasPermission(Permissions.Usuarios.Manage)]
    public class EmpleadoJefesConfigController : ControllerBase
    {
        private readonly IEmpleadoJefesConfigService _service;

        public EmpleadoJefesConfigController(IEmpleadoJefesConfigService service)
        {
            _service = service;
        }

        [HttpGet("api/config/empleados/jefes-config/list")]
        public async Task<IActionResult> GetList()
        {
            var result = await _service.GetListAsync();
            return result.IsError
                ? Problem(result.FirstError.Description)
                : Ok(new ApiResponse<List<EmpleadoJefesConfigListItem>>
                {
                    Success = true,
                    Message = "Configuraciones obtenidas exitosamente.",
                    Data = result.Value
                });
        }

        [HttpGet("api/config/empleados/{idUsuario:int}/jefes-config")]
        public async Task<IActionResult> GetConfig(int idUsuario)
        {
            var result = await _service.GetByUsuarioAsync(idUsuario);
            return result.IsError
                ? Problem(result.FirstError.Description)
                : Ok(new ApiResponse<EmpleadoJefesConfigResponse>
                {
                    Success = true,
                    Message = "Configuración obtenida exitosamente.",
                    Data = result.Value
                });
        }

        [HttpGet("api/config/empleados/{idUsuario:int}/jefes-cadena")]
        public async Task<IActionResult> GetCadena(int idUsuario)
        {
            var result = await _service.GetCadenaAsync(idUsuario);
            return result.IsError
                ? Problem(result.FirstError.Description)
                : Ok(new ApiResponse<EmpleadoJefesCadenaResponse>
                {
                    Success = true,
                    Message = "Cadena de jefes obtenida exitosamente.",
                    Data = result.Value
                });
        }

        [HttpPut("api/config/empleados/{idUsuario:int}/jefes-config")]
        public async Task<IActionResult> PutConfig(int idUsuario, [FromBody] UpdateEmpleadoJefesConfigRequest request)
        {
            var result = await _service.UpdateAsync(idUsuario, request);
            return result.IsError
                ? Problem(result.FirstError.Description)
                : Ok(new ApiResponse<EmpleadoJefesConfigResponse>
                {
                    Success = true,
                    Message = "Configuración actualizada exitosamente.",
                    Data = result.Value
                });
        }

        [HttpGet("api/config/workflows/{idWorkflow:int}/jefes-excluidos")]
        public async Task<IActionResult> GetExcluidos(int idWorkflow)
        {
            var result = await _service.GetExcluidosAsync(idWorkflow);
            return result.IsError
                ? Problem(result.FirstError.Description)
                : Ok(new ApiResponse<WorkflowJefesExcluidosResponse>
                {
                    Success = true,
                    Message = "Exclusiones obtenidas exitosamente.",
                    Data = result.Value
                });
        }

        [HttpPut("api/config/workflows/{idWorkflow:int}/jefes-excluidos")]
        public async Task<IActionResult> PutExcluidos(int idWorkflow, [FromBody] UpdateWorkflowJefesExcluidosRequest request)
        {
            var result = await _service.UpdateExcluidosAsync(idWorkflow, request);
            return result.IsError
                ? Problem(result.FirstError.Description)
                : Ok(new ApiResponse<WorkflowJefesExcluidosResponse>
                {
                    Success = true,
                    Message = "Exclusiones actualizadas exitosamente.",
                    Data = result.Value
                });
        }
    }
}
