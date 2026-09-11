namespace Lefarma.API.Features.EducacionMedica.DTOs;

public class ParametroAnestesiaItemRequest
{
    public string Clave { get; set; } = string.Empty;
    public decimal Valor { get; set; }
}

public class UpsertParametrosAnestesiasRequest
{
    public List<ParametroAnestesiaItemRequest> Parametros { get; set; } = new();
}
