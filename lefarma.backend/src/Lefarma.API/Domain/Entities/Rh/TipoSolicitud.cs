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
        public bool DescuentaNomina { get; set; } 
        public bool DescuentaVacaciones { get; set; } 
        public bool RequiereDocumentacion { get; set; } 
        public int? LimitePorPeriodo { get; set; }
        public string? PeriodoLimite { get; set; }
        public int? TotalParaDescuento { get; set; }
        public bool Activo { get; set; }
        public DateTime FechaCreacion { get; set; }
        public DateTime? FechaModificacion { get; set; }

    }
}
