namespace Lefarma.API.Features.Viaticos;

public sealed class DeteccionPrecioPreviewGate
{
    private readonly SemaphoreSlim _slots = new(2, 2);

    public bool TryEntrar() => _slots.Wait(0);

    public void Salir() => _slots.Release();
}
