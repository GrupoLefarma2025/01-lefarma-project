namespace Lefarma.API.Features.Viaticos.DTOs;

/// <summary>
/// Fila del concentrado macro de viáticos. Se materializa directo desde
/// <c>dbo.infoMacroViaticos</c> con <c>Database.SqlQuery</c>, por eso las
/// propiedades son mutables y con tipos nullable en las columnas que lo son.
/// </summary>
public class MacroViaticoResponse
{
    public string Folio { get; set; } = string.Empty;
    public string? Nombre { get; set; }
    public string? Gerencia { get; set; }
    public DateTime? Fecha { get; set; }
    public int? Renglon { get; set; }
    public string? Solicitante { get; set; }
    public DateTime? FechInicio { get; set; }
    public DateTime? FechaFin { get; set; }
    public string? Origen { get; set; }
    public string? Destino { get; set; }
    public decimal? CostoAutobus { get; set; }
    public decimal? CostoAvion { get; set; }
    public decimal? CostoGasolina { get; set; }
    public decimal? CostoCasetas { get; set; }
    public decimal? CostoHospedaje { get; set; }
    public decimal? CostoComida { get; set; }
    public decimal? CostoTaxi { get; set; }
    public int? DiasHospedaje { get; set; }
    public int? NumeroComidas { get; set; }
}

/// <summary>
/// Envío del concentrado de viáticos a autorización. El PDF lo genera el
/// cliente y aquí solo se persiste en <c>app.Documentos</c>, igual que el
/// envío normal del concentrado de órdenes de compra.
/// </summary>
public class MacroConcentradoEnvioRequest
{
    public List<string> Folios { get; set; } = new();
    public string? Nombre { get; set; }
    public string? Gerencia { get; set; }
    public string? Fecha { get; set; }
    public string? Comentario { get; set; }
    public string? Usuario { get; set; }
    public string? Correo { get; set; }
    public string? CorreoCC { get; set; }
    public IFormFile? Archivo { get; set; }
}

public class MacroConcentradoEnvioResponse
{
    public Guid IdDocumento { get; set; }
    public string NombreArchivo { get; set; } = string.Empty;
    public int TotalFolios { get; set; }
}
