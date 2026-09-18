namespace Lefarma.API.Domain.Entities.Rh
{
    public class TipoSolicitud
    {
        public int IdTipoSolicitud { get; set; }
        public string Nombre { get; set; } = null!;
        public string? NombreNormalizado { get; set; }
        public string Descripcion { get; set; } = null!;
        public string? DescripcionNormalizada { get; set; }
        public string Clave { get; set; } = null!;
        public CategoriaSolicitud Categoria { get; set; }
        public bool RequiereReposicionTiempo { get; set; } 
        public bool RequiereFechaFin { get; set; } 
        public bool RequiereFechaRegreso { get; set; } 
        public bool RequiereLugarComision { get; set; } 
        // Sin uso en la lógica actual: solo se persiste por compatibilidad del catálogo de tipos de solicitud.
        public bool DescuentaNomina { get; set; } 
        // Sin uso en la lógica actual: solo se persiste por compatibilidad del catálogo de tipos de solicitud.
        public bool DescuentaVacaciones { get; set; } 
        public bool RequiereDocumentacion { get; set; } 
        public bool PermiteFechasPasadas { get; set; }
        public bool PermiteFechasFuturas { get; set; }
        public bool TomaEnCuentaChecado { get; set; }
        public bool RequiereIncidenciasExistentes { get; set; }
        public bool PideDiasSolicitados { get; set; }
        public int? LimitePorPeriodo { get; set; }
        public string? PeriodoLimite { get; set; }
        // Sin uso en la lógica actual: solo se persiste por compatibilidad del catálogo de tipos de solicitud.
        public int? TotalParaDescuento { get; set; }
        public bool Activo { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }

    }
}
