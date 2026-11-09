using Lefarma.API.Domain.Entities.Config;
using Lefarma.API.Domain.Entities.EducacionMedica;

namespace Lefarma.API.Features.EducacionMedica.Services;

public static class SeleccionEditablePolicy
{
    public static bool EsEditable(SeleccionMensual seleccion, WorkflowPaso? paso) =>
        EsEditable(
            seleccion,
            paso?.Activo,
            paso?.PermiteEditar,
            paso?.EsFinal);

    public static bool EsEditable(
        SeleccionMensual seleccion,
        bool? pasoActivo,
        bool? permiteEditar,
        bool? esFinal)
    {
        if (!seleccion.Activo
            || seleccion.Estado is SeleccionMensual.EstadoCerrada
                or SeleccionMensual.EstadoCancelada
                or SeleccionMensual.EstadoRechazada)
        {
            return false;
        }

        if (!seleccion.IdPasoActual.HasValue)
        {
            return seleccion.Estado == SeleccionMensual.EstadoCreada;
        }

        return pasoActivo == true
            && permiteEditar == true
            && esFinal != true;
    }
}
