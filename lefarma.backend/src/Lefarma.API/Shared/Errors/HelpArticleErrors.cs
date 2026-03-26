using ErrorOr;

namespace Lefarma.API.Shared.Errors;

public static partial class Errors
{
    public static class HelpArticle
    {
        public static readonly Error NotFound = Error.NotFound(
            code: "HelpArticle.NotFound",
            description: "El artículo de ayuda no existe"
        );
    }

    public static class HelpImage
    {
        public static readonly Error InvalidContentType = Error.Validation(
            code: "HelpImage.InvalidContentType",
            description: "El tipo de archivo no es válido. Solo se permiten imágenes PNG, JPEG, GIF y WebP."
        );

        public static readonly Error FileTooLarge = Error.Validation(
            code: "HelpImage.FileTooLarge",
            description: "El archivo es demasiado grande. El tamaño máximo permitido es 5 MB."
        );

        public static readonly Error NotFound = Error.NotFound(
            code: "HelpImage.NotFound",
            description: "La imagen de ayuda no existe."
        );
    }
}
