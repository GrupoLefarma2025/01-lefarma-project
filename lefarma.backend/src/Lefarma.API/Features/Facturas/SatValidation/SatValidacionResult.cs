namespace Lefarma.API.Features.Facturas.SatValidation;

public record SatValidacionResult(
    bool    Contactado,           
    string? Estado,               
    string? CodigoEstatus,        
    string? EstatusCancelacion,   
    bool    PermitirAvanzar = false  
)
{
    public bool EsVigente => Contactado && Estado == "Vigente";
}
