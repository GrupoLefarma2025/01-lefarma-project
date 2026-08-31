namespace Lefarma.API.Domain.Interfaces.Config
{
    public interface IWorkflowEntity
    {
        int Id { get; set; }
        int IdWorkflow { get; set; }
        int? IdPasoActual { get; set; }
        int IdEstado { get; set; }
        int IdUsuarioCreador { get; set; }
        string ObtenerTipoEntidad();
    }
}
