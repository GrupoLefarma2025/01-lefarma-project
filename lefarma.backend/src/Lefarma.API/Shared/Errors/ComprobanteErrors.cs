using ErrorOr;

namespace Lefarma.API.Shared.Errors;

public static partial class Errors
{
    public static class Comprobante
    {
        public static Error NotFound => Error.NotFound(
            "Comprobante.NotFound", "El comprobante no fue encontrado");

        public static Error UuidDuplicado => Error.Conflict(
            "Comprobante.UuidDuplicado", "Ya existe una factura registrada con este UUID CFDI");

        public static Error XmlInvalido => Error.Validation(
            "Comprobante.XmlInvalido", "El XML no es un CFDI válido o está malformado");

        public static Error SobreCantidad(int idPartida) => Error.Validation(
            "Comprobante.SobreCantidad", $"La cantidad asignada excede la cantidad pendiente en la partida {idPartida}");

        public static Error SobreImporte(int idPartida) => Error.Validation(
            "Comprobante.SobreImporte", $"El importe asignado excede el importe pendiente en la partida {idPartida}");

        public static Error SobreConcepto(int idConcepto) => Error.Validation(
            "Comprobante.SobreConcepto", $"La cantidad asignada excede la cantidad pendiente del concepto {idConcepto}");

        public static Error ConceptoNotFound(int idConcepto) => Error.NotFound(
            "Comprobante.ConceptoNotFound", $"El concepto {idConcepto} no pertenece a este comprobante");

        public static Error PartidaNotFound(int idPartida) => Error.NotFound(
            "Comprobante.PartidaNotFound", $"La partida {idPartida} no fue encontrada");
    }
}
