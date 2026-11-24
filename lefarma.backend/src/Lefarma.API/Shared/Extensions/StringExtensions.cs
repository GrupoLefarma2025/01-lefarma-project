using Serilog;
using System.Globalization;
using System.Text;

namespace Lefarma.API.Shared.Extensions
{
    public static class StringExtensions
    {
        public const string PuestoSinAsignar = "Sin asignar";

        public static string? PuestoVisible(this string? puesto)
        {
            if (string.IsNullOrWhiteSpace(puesto))
                return null;

            var valor = puesto.Trim();
            return string.Equals(valor, PuestoSinAsignar, StringComparison.OrdinalIgnoreCase)
                ? null
                : valor;
        }

        public static string RemoveDiacritics(this string? text)
        {
            if (string.IsNullOrWhiteSpace(text))
                return text ?? string.Empty;

            var normalizedString = text.Normalize(NormalizationForm.FormD);
            var stringBuilder = new StringBuilder();

            foreach (var c in normalizedString)
            {
                var unicodeCategory = CharUnicodeInfo.GetUnicodeCategory(c);
                if (unicodeCategory != UnicodeCategory.NonSpacingMark)
                {
                    stringBuilder.Append(c);
                }
            }

            return stringBuilder.ToString().Normalize(NormalizationForm.FormC);
        }

        private const int NombreArchivoMaxLength = 80;

        public static string SanitizarNombreArchivo(this string? nombreOriginal)
        {
            var baseName = Path.GetFileNameWithoutExtension(nombreOriginal ?? string.Empty).RemoveDiacritics();

            var sb = new StringBuilder(baseName.Length);
            foreach (var c in baseName)
            {
                if (char.IsWhiteSpace(c))
                    sb.Append('-');
                else if (char.IsAsciiLetterOrDigit(c) || c is '.' or '-' or '_')
                    sb.Append(c);
            }

            var limpio = sb.ToString();
            while (limpio.Contains("--"))
                limpio = limpio.Replace("--", "-");
            limpio = limpio.Trim('-', '.');

            if (limpio.Length > NombreArchivoMaxLength)
                limpio = limpio[..NombreArchivoMaxLength].Trim('-', '.');

            return limpio.Length > 0 ? limpio : "documento";
        }

        public static bool IsValidRFC(this string rfc)
        {
            if (string.IsNullOrWhiteSpace(rfc))
                return false;

            return rfc.Length == 12 || rfc.Length == 13;
        }
    }
}