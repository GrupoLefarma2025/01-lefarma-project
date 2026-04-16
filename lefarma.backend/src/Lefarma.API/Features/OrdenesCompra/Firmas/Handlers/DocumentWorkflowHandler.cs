using Lefarma.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Lefarma.API.Features.OrdenesCompra.Firmas.Handlers
{
    /// <summary>
    /// Maneja campos de tipo Archivo (comprobante_pago, comprobante_gasto/factura).
    /// Si handler.Requerido = true → valida que exista en BD un archivo con el tipo del campo.
    /// Si campo.ValidarFiscal = true y el archivo no es imagen → placeholder webservice CFDI (Fase 2).
    /// Reemplaza RequiredFields para campos tipo Archivo.
    /// </summary>
    public class DocumentWorkflowHandler : IWorkflowActionHandler
    {
        private static readonly HashSet<string> _imageMimeTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "image/jpeg", "image/jpg", "image/png", "image/gif",
            "image/webp", "image/bmp", "image/tiff", "image/svg+xml"
        };

        private readonly ApplicationDbContext _context;

        public DocumentWorkflowHandler(ApplicationDbContext context)
        {
            _context = context;
        }

        public string HandlerKey => "Document";

        public async Task<HandlerResult> ProcessAsync(WorkflowHandlerContext context, string? configJson)
        {
            if (context.Handler?.Campo is not { } campo)
                return HandlerResult.Fail("Document: el handler no tiene un campo vinculado.");

            if (!context.Handler.Requerido)
                return HandlerResult.Ok(); // documento opcional — no validar

            var archivos = await _context.Archivos
                .AsNoTracking()
                .Where(a => a.Activo && a.EntidadTipo == "OrdenCompra" && a.EntidadId == context.IdOrden)
                .ToListAsync();

            if (!archivos.Any())
                return HandlerResult.Fail($"Esta acción requiere adjuntar: {campo.EtiquetaUsuario}.");

            var archivo = archivos.FirstOrDefault(a =>
                (a.Metadata ?? string.Empty).Contains(campo.NombreTecnico, StringComparison.OrdinalIgnoreCase) ||
                (a.Metadata ?? string.Empty).Contains(campo.EtiquetaUsuario, StringComparison.OrdinalIgnoreCase));

            if (archivo is null)
                return HandlerResult.Fail($"No se encontró el documento requerido: {campo.EtiquetaUsuario}.");

            if (campo.ValidarFiscal)
            {
                var esImagen = _imageMimeTypes.Contains(archivo.TipoMime) ||
                               archivo.TipoMime.StartsWith("image/", StringComparison.OrdinalIgnoreCase);

                if (!esImagen)
                {
                    // TODO Fase 2: invocar webservice SAT para validar CFDI (UUID, RFC emisor/receptor, monto)
                    // Solo aplica a XML/PDF. Las imágenes pasan sin validación fiscal.
                }
            }

            return HandlerResult.Ok();
        }
    }
}
