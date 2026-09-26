namespace Lefarma.API.Domain.Firmas;

/// <summary>
/// Regla de negocio del control de cambios de firma digital.
/// Solo la subida inicial es libre; reemplazos requieren habilitación RH (un solo uso).
/// La habilitación se consume implícitamente: al registrar una subida/eliminación
/// en el historial (FirmaControl), el estado derivado vuelve a bloquear.
/// </summary>
public static class FirmaCambioPolicy
{
    /// <summary>
    /// Puede guardar (subir/reemplazar/eliminar) la firma.
    /// Permitido si nunca ha registrado firma (subidasEfectivas == 0) o si RH habilitó un cambio.
    /// </summary>
    public static bool PuedeGuardar(int subidasEfectivas, bool cambioHabilitado) =>
        subidasEfectivas == 0 || cambioHabilitado;
}
