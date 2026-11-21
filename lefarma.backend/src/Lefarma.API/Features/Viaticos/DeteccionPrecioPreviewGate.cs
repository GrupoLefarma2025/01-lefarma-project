namespace Lefarma.API.Features.Viaticos;

/// <summary>
/// Cupo para las vistas previas de precio del wizard. La cola de guardado es
/// secuencial; las vistas previas llegan por HTTP y podrían abrir varios
/// navegadores a la vez. Se permiten dos y, si ambos están ocupados, la vista
/// previa responde "ocupado" en lugar de encolarse: el guardado vuelve a
/// intentar con el presupuesto completo.
/// </summary>
public sealed class DeteccionPrecioPreviewGate
{
    private readonly SemaphoreSlim _slots = new(2, 2);

    public bool TryEntrar() => _slots.Wait(0);

    public void Salir() => _slots.Release();
}
