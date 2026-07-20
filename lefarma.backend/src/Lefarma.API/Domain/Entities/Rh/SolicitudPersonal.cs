using Lefarma.API.Domain.Entities.Catalogos;
using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Interfaces.Config;
using Lefarma.API.Shared.Constants;

namespace Lefarma.API.Domain.Entities.Rh
{
    public class SolicitudPersonal : IWorkflowEntity
    {
        public int IdSolicitud { get; set; }
        public string Folio { get; set; } = null!;

        public int IdEmpresa { get; set; }
        public int IdSucursal { get; set; }
        public int IdArea { get; set; }
        public int IdUsuarioCreador { get; set; }

        public int IdEstado { get; set; }
        public virtual WorkflowEstados? Estado { get; set; }

        public int IdWorkflow { get; set; }
        public int? IdPasoActual { get; set; }

        public int IdTipoSolicitud { get; set; }
        public virtual TipoSolicitud? TipoSolicitud { get; set; }
        public string? LugarComision { get; set; } = null!; // Lugar al que se comisiona al empleado (en caso de ser una comisión)
        public string? Motivo { get; set; } = null!; // Motivo de la solicitud (ej: motivo del accidente o enfermedad, o motivo de la comisión)

        // Naevación a catálogos
        public virtual Empresa? Empresa { get; set; }
        public virtual Sucursal? Sucursal { get; set; }
        public virtual Area? Area { get; set; }

        // Detalle de fechas
        public virtual ICollection<SolicitudPersonalDetalle> Detalle { get; set; } = new List<SolicitudPersonalDetalle>();

        public DateTime? FechaEnvio { get; set; } // Fecha en que el usuario envia la solicitud (se asigna al ejecutar la acción de envío)

        public DateTime? FechaInicio { get; set; }
        public DateTime? FechaFin { get; set; }
        public DateTime? FechaReposicion { get; set; } // Fecha en que el empleado repone el día perdido

        public int? DiasSolicitados { get; set; }
        public DateTime? FechaRegreso { get; set; }

        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }


        // IWorkflowEntity
        int IWorkflowEntity.Id { get => IdSolicitud; set => IdSolicitud = value; }
        public string ObtenerTipoEntidad() => CodigoProceso.SOLICITUD_PERSONAL;
    }
}
