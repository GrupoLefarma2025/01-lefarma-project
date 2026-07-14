namespace Lefarma.API.Features.Rh.Calendario.DTOs
{
    public class CalendarioLaboralRequest
    {
        public int? Anio { get; set; }
        public int? Mes { get; set; }
        public int? Dia { get; set; }
        public bool? Laborable { get; set; }
        public bool ExcluirSabados { get; set; }
    }

    public class CalendarioLaboralResponse
    {
        public DateTime Fecha { get; set; }
        public string? NombreDiaSemana { get; set; }
        public string? NombreMes { get; set; }
        public bool Laborable { get; set; }
    }
}
