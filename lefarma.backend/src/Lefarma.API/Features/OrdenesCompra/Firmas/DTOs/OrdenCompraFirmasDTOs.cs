namespace Lefarma.API.Features.OrdenesCompra.Firmas.DTOs
{

    // ── Envío Concentrado ─────────────────────────────────────────────────────

    public class EnvioConcentradoRequest
    {
        /// <summary>IDs de las órdenes en paso 4 a avanzar.</summary>
        public required List<int> IdsOrdenes { get; set; }

        /// <summary>Comentario que quedará en la bitácora de cada orden.</summary>
        public string? Comentario { get; set; }
    }

    public class EnvioConcentradoItemResult
    {
        public int IdOrden { get; set; }
        public string Folio { get; set; } = string.Empty;
        public bool Exitoso { get; set; }
        public string? NuevoEstado { get; set; }
        public string? Error { get; set; }
    }

    public class EnvioConcentradoResponse
    {
        public int Total { get; set; }
        public int Exitosas { get; set; }
        public int Fallidas { get; set; }
        public List<EnvioConcentradoItemResult> Resultados { get; set; } = new();
    }

    public class EnvioConcentradoConPdfRequest
    {
        public required List<int> IdsOrdenes { get; set; }
        public string? Comentario { get; set; }
        public string? Nombre { get; set; }
        public string? Usuario { get; set; }
        public string? Correo { get; set; }
        public string? CorreoCC { get; set; }
        public IFormFile? Archivo { get; set; }
        public bool TieneDocumentoSoporte { get; set; }
        public IFormFile? ArchivoSoporte { get; set; }
    }

    // ── Respuesta del Sistema Externo ────────────────────────────────────────

    public class RespuestaConcentradoExternoRequest
    {
        public required int IdConcentrado { get; set; }
        public required string TokenSeguridad { get; set; }
        public required int IdUsuario { get; set; }
        public required string Accion { get; set; } // "APROBAR" o "DEVOLVER"
        public string? Comentario { get; set; }
    }

    public class RespuestaConcentradoResponse
    {
        public int Total { get; set; }
        public int Exitosas { get; set; }
        public int Fallidas { get; set; }
        public List<EnvioConcentradoItemResult> Resultados { get; set; } = new();
    }

    public class AsokamLoginResponse
    {
        public string Token { get; set; } = "";
        public string? ExpiresAt { get; set; }
    }
}
