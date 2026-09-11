using System.Security.Claims;
using Lefarma.API.Features.EducacionMedica.DTOs;
using Lefarma.API.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace Lefarma.API.Features.EducacionMedica;

[ApiController]
[Route("api/educacion-medica/selecciones-mensuales")]
[EndpointGroupName("EducacionMedica")]
[Authorize]
public class SeleccionesMensualesController : ControllerBase
{
    private readonly ISeleccionMensualService _service;

    public SeleccionesMensualesController(ISeleccionMensualService service)
    {
        _service = service;
    }

    [HttpGet]
    [SwaggerOperation(
        Summary = "Obtener selecciones mensuales",
        Description = "Retorna las selecciones mensuales filtradas por año y/o mes de la fecha de selección.")]
    [SwaggerResponse(200, "Selecciones obtenidas", typeof(ApiResponse<List<SeleccionMensualDto>>))]
    public async Task<IActionResult> GetAll([FromQuery] int? anio, [FromQuery] int? mes, CancellationToken ct)
    {
        var selecciones = await _service.GetAllAsync(anio, mes, ct);
        return Ok(new ApiResponse<List<SeleccionMensualDto>>
        {
            Success = true,
            Message = "Selecciones mensuales obtenidas exitosamente.",
            Data = selecciones
        });
    }

    [HttpGet("{idSeleccionMensual:int}")]
    [SwaggerOperation(
        Summary = "Obtener detalle de la selección",
        Description = "Retorna la selección con sus hospitales (snapshot de coordenadas) y regiones calculadas.")]
    [SwaggerResponse(200, "Selección obtenida", typeof(ApiResponse<SeleccionDetalleDto>))]
    [SwaggerResponse(404, "Selección no encontrada")]
    public async Task<IActionResult> GetById(int idSeleccionMensual, CancellationToken ct)
    {
        var seleccion = await _service.GetByIdAsync(idSeleccionMensual, ct);
        if (seleccion is null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = $"Selección {idSeleccionMensual} no encontrada."
            });
        }

        return Ok(new ApiResponse<SeleccionDetalleDto>
        {
            Success = true,
            Message = "Selección obtenida exitosamente.",
            Data = seleccion
        });
    }

    [HttpPost]
    [SwaggerOperation(
        Summary = "Crear selección mensual",
        Description = "Crea la selección en estado Borrador (reunión del día 15, periodo de vigencia ~45 días).")]
    [SwaggerResponse(201, "Selección creada", typeof(ApiResponse<SeleccionMensualDto>))]
    [SwaggerResponse(409, "Periodo traslapado o fechas inválidas")]
    public async Task<IActionResult> Create([FromBody] CrearSeleccionMensualRequest request, CancellationToken ct)
    {
        try
        {
            var seleccion = await _service.CreateAsync(request, GetUserId(), ct);
            return CreatedAtAction(nameof(GetById), new { idSeleccionMensual = seleccion.IdSeleccionMensual },
                new ApiResponse<SeleccionMensualDto>
                {
                    Success = true,
                    Message = "Selección creada exitosamente.",
                    Data = seleccion
                });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("{idSeleccionMensual:int}/hospitales")]
    [SwaggerOperation(
        Summary = "Agregar hospital a la selección",
        Description = "Agrega un hospital con snapshot de coordenadas GPS al momento del alta.")]
    [SwaggerResponse(201, "Hospital agregado", typeof(ApiResponse<SeleccionHospitalDto>))]
    [SwaggerResponse(409, "Selección no editable, hospital duplicado o inexistente")]
    public async Task<IActionResult> AgregarHospital(
        int idSeleccionMensual,
        [FromBody] AgregarHospitalSeleccionRequest request,
        CancellationToken ct)
    {
        try
        {
            var hospital = await _service.AgregarHospitalAsync(idSeleccionMensual, request, GetUserId(), ct);
            return Ok(new ApiResponse<SeleccionHospitalDto>
            {
                Success = true,
                Message = "Hospital agregado exitosamente.",
                Data = hospital
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpDelete("{idSeleccionMensual:int}/hospitales/{idSeleccionHospital:int}")]
    [SwaggerOperation(
        Summary = "Quitar hospital de la selección",
        Description = "Quita el hospital de la selección; la zona que quede vacía se elimina.")]
    [SwaggerResponse(200, "Hospital quitado")]
    [SwaggerResponse(404, "Selección u hospital no encontrado")]
    public async Task<IActionResult> QuitarHospital(int idSeleccionMensual, int idSeleccionHospital, CancellationToken ct)
    {
        try
        {
            await _service.QuitarHospitalAsync(idSeleccionMensual, idSeleccionHospital, ct);
            return Ok(new ApiResponse<object> { Success = true, Message = "Hospital quitado exitosamente." });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("{idSeleccionMensual:int}/agrupar")]
    [SwaggerOperation(
        Summary = "Recalcular regiones por zona del hospital",
        Description = "Agrupa los hospitales por la región asignada en hospital_extension (fallback GPS al centroide más cercano con origen=GPS); persiste las regiones (selecciones_regiones) y avisa si alguna queda con menos de 4 hospitales.")]
    [SwaggerResponse(200, "Regiones calculadas", typeof(ApiResponse<AgruparSeleccionResponse>))]
    [SwaggerResponse(409, "Selección no editable")]
    public async Task<IActionResult> Agrupar(int idSeleccionMensual, CancellationToken ct)
    {
        try
        {
            var resultado = await _service.AgruparAsync(idSeleccionMensual, GetUserId(), ct);
            return Ok(new ApiResponse<AgruparSeleccionResponse>
            {
                Success = true,
                Message = "Regiones calculadas exitosamente.",
                Data = resultado
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("{idSeleccionMensual:int}/regiones/{idRegion:int}/equipo")]
    [SwaggerOperation(
        Summary = "Asignar región a un equipo",
        Description = "Asigna la región completa a un equipo de pareo validando su capacidad en el periodo (3/día, 8/semana, Lun–Vie).")]
    [SwaggerResponse(200, "Región asignada", typeof(ApiResponse<SeleccionRegionDto>))]
    [SwaggerResponse(409, "Capacidad insuficiente, equipo inactivo o selección no editable")]
    public async Task<IActionResult> AsignarEquipo(
        int idSeleccionMensual,
        int idRegion,
        [FromBody] AsignarEquipoRegionRequest request,
        CancellationToken ct)
    {
        try
        {
            var region = await _service.AsignarEquipoAsync(idSeleccionMensual, idRegion, request, GetUserId(), ct);
            return Ok(new ApiResponse<SeleccionRegionDto>
            {
                Success = true,
                Message = "Región asignada al equipo exitosamente.",
                Data = region
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("{idSeleccionMensual:int}/regiones/{idRegion:int}/dividir")]
    [SwaggerOperation(
        Summary = "Dividir región (excepción manual)",
        Description = "Divide la región en dos: la mitad más alejada del centroide forma una región nueva. Requiere motivo (excepción humana de la regla región→equipo).")]
    [SwaggerResponse(200, "Región dividida", typeof(ApiResponse<List<SeleccionRegionDto>>))]
    [SwaggerResponse(409, "Selección no editable o región sin hospitales suficientes")]
    public async Task<IActionResult> DividirRegion(
        int idSeleccionMensual,
        int idRegion,
        [FromBody] DividirRegionRequest request,
        CancellationToken ct)
    {
        try
        {
            var regiones = await _service.DividirRegionAsync(idSeleccionMensual, idRegion, request, GetUserId(), ct);
            return Ok(new ApiResponse<List<SeleccionRegionDto>>
            {
                Success = true,
                Message = "Región dividida exitosamente.",
                Data = regiones
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPut("{idSeleccionMensual:int}/hospitales/{idSeleccionHospital:int}/region")]
    [SwaggerOperation(
        Summary = "Asignar un hospital sin región a una región existente",
        Description = "Mueve un hospital sin región a la región indicada; hereda el equipo de esa región. Solo hospitales sin región (para reagrupar use Recalcular regiones).")]
    [SwaggerResponse(200, "Hospital asignado a la región")]
    [SwaggerResponse(409, "Selección no editable, hospital ya con región o región inválida")]
    public async Task<IActionResult> AsignarRegionHospital(
        int idSeleccionMensual,
        int idSeleccionHospital,
        [FromBody] MoverHospitalARegionRequest request,
        CancellationToken ct)
    {
        try
        {
            await _service.AsignarRegionAHospitalAsync(idSeleccionMensual, idSeleccionHospital, request, GetUserId(), ct);
            return Ok(new ApiResponse<object>
            {
                Success = true,
                Message = "Hospital asignado a la región exitosamente."
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("{idSeleccionMensual:int}/enviar-revision")]
    [SwaggerOperation(
        Summary = "Enviar selección a revisión",
        Description = "Borrador → EnRevision. Requiere al menos una región asignada a un equipo.")]
    [SwaggerResponse(200, "Selección en revisión", typeof(ApiResponse<SeleccionMensualDto>))]
    [SwaggerResponse(409, "Estado inválido o sin regiones asignadas")]
    public async Task<IActionResult> EnviarRevision(int idSeleccionMensual, CancellationToken ct)
    {
        try
        {
            var seleccion = await _service.EnviarRevisionAsync(idSeleccionMensual, GetUserId(), ct);
            return Ok(new ApiResponse<SeleccionMensualDto>
            {
                Success = true,
                Message = "Selección enviada a revisión.",
                Data = seleccion
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("{idSeleccionMensual:int}/autorizar")]
    [SwaggerOperation(
        Summary = "Firmar la selección (doble firma GV → GG)",
        Description = "Primera firma: Gerente de Ventas. Segunda firma: Gerencia General; al completarse ambas la selección pasa a Autorizada.")]
    [SwaggerResponse(200, "Firma registrada", typeof(ApiResponse<SeleccionMensualDto>))]
    [SwaggerResponse(409, "Firma fuera de orden o estado inválido")]
    public async Task<IActionResult> Autorizar(
        int idSeleccionMensual,
        [FromBody] AutorizarSeleccionRequest request,
        CancellationToken ct)
    {
        try
        {
            var seleccion = await _service.AutorizarAsync(idSeleccionMensual, request, GetUserId(), ct);
            return Ok(new ApiResponse<SeleccionMensualDto>
            {
                Success = true,
                Message = "Firma registrada exitosamente.",
                Data = seleccion
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("{idSeleccionMensual:int}/cerrar")]
    [SwaggerOperation(
        Summary = "Cerrar la selección",
        Description = "Autorizada → Cerrada (mes planificado).")]
    [SwaggerResponse(200, "Selección cerrada", typeof(ApiResponse<SeleccionMensualDto>))]
    [SwaggerResponse(409, "Estado inválido")]
    public async Task<IActionResult> Cerrar(int idSeleccionMensual, CancellationToken ct)
    {
        try
        {
            var seleccion = await _service.CerrarAsync(idSeleccionMensual, GetUserId(), ct);
            return Ok(new ApiResponse<SeleccionMensualDto>
            {
                Success = true,
                Message = "Selección cerrada exitosamente.",
                Data = seleccion
            });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    [HttpGet("{idSeleccionMensual:int}/hospitales-cercanos")]
    [SwaggerOperation(
        Summary = "Obtener hospitales cercanos en otras selecciones",
        Description = "Retorna hospitales de otras gerencias con vigencia solapada que están cerca de los hospitales de esta selección (distancia, mismo estado o misma ciudad). Solo informativo, para coordinación de viajes.")]
    [SwaggerResponse(200, "Hospitales cercanos obtenidos", typeof(ApiResponse<List<HospitalCercanoOtraSeleccionDto>>))]
    [SwaggerResponse(404, "Selección no encontrada")]
    public async Task<IActionResult> GetHospitalesCercanos(int idSeleccionMensual, CancellationToken ct)
    {
        try
        {
            var hospitales = await _service.ObtenerHospitalesCercanosAsync(idSeleccionMensual, ct);
            return Ok(new ApiResponse<List<HospitalCercanoOtraSeleccionDto>>
            {
                Success = true,
                Message = "Hospitales cercanos obtenidos exitosamente.",
                Data = hospitales
            });
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new ApiResponse<object> { Success = false, Message = ex.Message });
        }
    }

    private int GetUserId() =>
        int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
}
