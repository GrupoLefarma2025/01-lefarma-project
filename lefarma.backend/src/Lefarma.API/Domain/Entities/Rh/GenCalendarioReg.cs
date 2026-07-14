namespace Lefarma.API.Domain.Entities.Rh
{
    public class GenCalendarioReg
    {
        public DateTime Fecha { get; set; }
        public int? AñoMes { get; set; }
        public int? Año { get; set; }
        public int? Mes { get; set; }
        public int? Dia { get; set; }
        public int? SemanaRetail { get; set; }
        public int? SemanaAsokam { get; set; }
        public byte? Laborable { get; set; }
        public int? DiaSemana { get; set; }
        public byte? EntreSemana { get; set; }
        public byte? FinDeSemana { get; set; }
        public byte? AparicionDiaSemanaEnMes { get; set; }
        public string? NombreDiaSemana { get; set; }
        public string? NombreMes { get; set; }
        public byte? SemanasAsokamEnMes { get; set; }
        public int? AñoSemana { get; set; }
    }
}
