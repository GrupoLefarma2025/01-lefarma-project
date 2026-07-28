using ErrorOr;
using Lefarma.API.Features.Config.EmpleadoJefes.DTOs;

namespace Lefarma.API.Features.Config.EmpleadoJefes
{
    public interface IEmpleadoJefesConfigService
    {
        Task<ErrorOr<List<EmpleadoJefesConfigListItem>>> GetListAsync();
        Task<ErrorOr<EmpleadoJefesConfigResponse>> GetByUsuarioAsync(int idUsuario);
        Task<ErrorOr<EmpleadoJefesConfigResponse>> UpdateAsync(int idUsuario, UpdateEmpleadoJefesConfigRequest request);
        Task<ErrorOr<WorkflowJefesExcluidosResponse>> GetExcluidosAsync(int idWorkflow);
        Task<ErrorOr<WorkflowJefesExcluidosResponse>> UpdateExcluidosAsync(int idWorkflow, UpdateWorkflowJefesExcluidosRequest request);
    }
}
