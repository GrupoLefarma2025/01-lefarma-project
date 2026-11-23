namespace Lefarma.API.Domain.Firmas;

public static class FirmaCambioPolicy
{
    public static bool PuedeGuardar(int subidasEfectivas, bool cambioHabilitado) =>
        subidasEfectivas == 0 || cambioHabilitado;
}
