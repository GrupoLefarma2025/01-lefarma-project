using ErrorOr;

namespace Lefarma.API.Shared.Errors;
public static partial class Errors
{
    public static class Archivo
    {
        public static Error NotFound => Error.NotFound(
            "Archivo.NotFound",
            "El archivo no fue encontrado");

        public static Error InvalidContentType => Error.Validation(
            "Archivo.InvalidContentType",
            "El tipo de archivo no está permitido");

        public static Error FileTooLarge => Error.Validation(
            "Archivo.FileTooLarge",
            "El archivo excede el tamaño máximo permitido");

        public static Error ConversionFailed => Error.Failure(
            "Archivo.ConversionFailed",
            "No se pudo convertir el archivo a PDF");

        public static Error PreviewNotSupported => Error.Failure(
            "Archivo.PreviewNotSupported",
            "La previsualización no está disponible para este tipo de archivo");
    }
}
