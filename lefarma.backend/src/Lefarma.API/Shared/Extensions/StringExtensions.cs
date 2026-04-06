using Serilog;
using System.Globalization;
using System.Text;

namespace Lefarma.API.Shared.Extensions
{
/// <summary>
    /// Extensiones para manipulaci�n de cadenas de texto
    /// </summary>
    public static class StringExtensions
    {
        /// <summary>
        /// Remueve diacr�ticos (acentos) de una cadena de texto
        /// </summary>
        /// <param name="text">Texto a normalizar</param>
        /// <returns>Texto sin acentos</returns>
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

        /// <summary>
        /// Valida si un RFC tiene formato v�lido
        /// </summary>
        public static bool IsValidRFC(this string rfc)
        {
            if (string.IsNullOrWhiteSpace(rfc))
                return false;

            return rfc.Length == 12 || rfc.Length == 13;
        }
    }
}