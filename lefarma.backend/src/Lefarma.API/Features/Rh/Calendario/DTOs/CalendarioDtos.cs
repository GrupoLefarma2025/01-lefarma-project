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

    public class DiasJornadaRequest
    {
        public int Anio { get; set; }
        public int Mes { get; set; }
    }

    public class DiasJornadaResponse
    {
        public bool Lunes { get; set; }
        public bool Martes { get; set; }
        public bool Miercoles { get; set; }
        public bool Jueves { get; set; }
        public bool Viernes { get; set; }
        public bool Sabado { get; set; }
        public bool Domingo { get; set; }
    }
}
