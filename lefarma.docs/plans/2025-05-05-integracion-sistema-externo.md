# Plan: Integración Envío Concentrado con Tabla Intermedia

## Contexto

El usuario propone crear una tabla intermedia para rastrear los envíos de concentrado. Esto mejora el diseño porque:
1. Agrupa órdenes enviadas en un mismo concentrado
2. Simplifica la API con el sistema externo (solo envía ID de concentrado)
3. Permite trazabilidad completa (quién envió, cuándo, estado del concentrado)
4. Facilita auditoría de qué órdenes fueron aprobadas/devueltas en lote

## Nueva tabla: `operaciones.envios_concentrado`

```sql
CREATE TABLE operaciones.envios_concentrado (
    id_envio_concentrado INT IDENTITY(1,1) PRIMARY KEY,
    folio VARCHAR(50) NOT NULL UNIQUE,              -- CONC-20250505-001
    id_usuario_envio INT NOT NULL,                  -- Quién envió desde GAF
    fecha_envio DATETIME2 NOT NULL DEFAULT GETDATE(),
    
    -- Estado del concentrado en el sistema externo
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, APROBADO, DEVUELTO
    
    -- Respuesta del sistema externo
    fecha_respuesta DATETIME2 NULL,
    id_usuario_respuesta INT NULL,                  -- Opcional: si el sistema externo envía quién respondió
    comentario_respuesta NVARCHAR(500) NULL,
    
    -- Token de seguridad para validar respuesta del sistema externo
    token_seguridad VARCHAR(100) NOT NULL UNIQUE,
    
    -- Datos del concentrado para el sistema externo
    total DECIMAL(18,2) NOT NULL DEFAULT 0,
    cantidad_ordenes INT NOT NULL DEFAULT 0,
    
    activo BIT NOT NULL DEFAULT 1
);

-- Relación muchos a muchos: concentrado <-> ordenes
CREATE TABLE operaciones.envios_concentrado_ordenes (
    id_envio_concentrado INT NOT NULL,
    id_orden INT NOT NULL,
    PRIMARY KEY (id_envio_concentrado, id_orden),
    FOREIGN KEY (id_envio_concentrado) REFERENCES operaciones.envios_concentrado(id_envio_concentrado),
    FOREIGN KEY (id_orden) REFERENCES operaciones.ordenes_compra(id_orden)
);
```

## Flujo completo

### 1. Enviar concentrado (GAF → Sistema Externo)

```
Usuario selecciona órdenes en EnvioConcentrado.tsx
  ↓
POST /ordenes/envio-concentrado
  ↓
Backend:
  1. Valida órdenes (mismo estado PREPARACION_GAF)
  2. Firma cada orden → avanza al paso del Director
  3. Crea registro en envios_concentrado (estado: PENDIENTE)
  4. Inserta relación en envios_concentrado_ordenes
  5. Llama al endpoint del sistema externo:
     
     POST https://sistema-externo.com/api/concentrados
     {
       "idConcentrado": "CONC-20250505-001",
       "tokenSeguridad": "abc123...",
       "idsOrdenes": [1, 2, 3],
       "total": 150000.00,
       "urlPdf": "https://.../concentrados/CONC-20250505-001.pdf"
     }
  6. Si el sistema externo responde éxito:
     - EnvioConcentradoResponse exitoso
     - Órdenes ahora están en estado del Director
  7. Si el sistema externo no responde:
     - El concentrado queda en PENDIENTE
     - Se puede reintentar manualmente o automáticamente
```

### 2. Recibir respuesta (Sistema Externo → Nuestro Backend)

```
Director aprueba/devuelve concentrado en sistema externo
  ↓
Sistema externo llama a nuestro endpoint:
  
  POST /api/ordenes/envio-concentrado/respuesta
  {
    "idConcentrado": "CONC-20250505-001",
    "tokenSeguridad": "abc123...",
    "accion": "APROBAR"  // o "DEVOLVER"
  }
  
  ↓
Backend:
  1. Valida token de seguridad
  2. Busca concentrado por folio
  3. Verifica que esté en estado PENDIENTE
  4. Obtiene órdenes relacionadas
  5. Ejecuta acción APROBAR o DEVOLVER en cada orden (bypass participantes)
  6. Actualiza envios_concentrado:
     - estado = APROBADO / DEVUELTO
     - fecha_respuesta = NOW()
     - comentario_respuesta = ...
  7. Retorna resultado
```

## Ventajas de la tabla intermedia

| Aspecto | Sin tabla | Con tabla |
|---------|-----------|-----------|
| **Trazabilidad** | Difícil saber qué órdenes fueron enviadas juntas | Fácil: consultar `envios_concentrado_ordenes` |
| **Reintentos** | Si falla el envío al sistema externo, no se sabe qué se intentó | El concentrado queda en PENDIENTE, se puede reenviar |
| **Auditoría** | Bitácora de cada orden por separado | Bitácora del concentrado + bitácora de cada orden |
| **API Externa** | Debe enviar lista de IDs de ordenes | Solo envía ID del concentrado + token |
| **Rollback** | Complejo: buscar órdenes una por una | Fácil: buscar por `id_envio_concentrado` |

## Cambios necesarios

### 1. Base de datos

**Archivo:** `lefarma.database/017_create_envios_concentrado.sql`

```sql
-- Tabla maestra de envíos de concentrado
CREATE TABLE IF NOT EXISTS operaciones.envios_concentrado (
    id_envio_concentrado INT IDENTITY(1,1) PRIMARY KEY,
    folio VARCHAR(50) NOT NULL UNIQUE,
    id_usuario_envio INT NOT NULL,
    fecha_envio DATETIME2 NOT NULL DEFAULT GETDATE(),
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' 
        CHECK (estado IN ('PENDIENTE', 'APROBADO', 'DEVUELTO')),
    fecha_respuesta DATETIME2 NULL,
    id_usuario_respuesta INT NULL,
    comentario_respuesta NVARCHAR(500) NULL,
    token_seguridad VARCHAR(100) NOT NULL UNIQUE,
    total DECIMAL(18,2) NOT NULL DEFAULT 0,
    cantidad_ordenes INT NOT NULL DEFAULT 0,
    activo BIT NOT NULL DEFAULT 1
);

-- Tabla de relación: concentrado <-> ordenes
CREATE TABLE IF NOT EXISTS operaciones.envios_concentrado_ordenes (
    id_envio_concentrado INT NOT NULL,
    id_orden INT NOT NULL,
    PRIMARY KEY (id_envio_concentrado, id_orden),
    FOREIGN KEY (id_envio_concentrado) 
        REFERENCES operaciones.envios_concentrado(id_envio_concentrado),
    FOREIGN KEY (id_orden) 
        REFERENCES operaciones.ordenes_compra(id_orden)
);

-- Índices
CREATE INDEX IX_envios_concentrado_estado 
    ON operaciones.envios_concentrado(estado) 
    WHERE estado = 'PENDIENTE';

CREATE INDEX IX_envios_concentrado_ordenes_orden 
    ON operaciones.envios_concentrado_ordenes(id_orden);
```

### 2. Backend - Entity

**Archivo:** `Domain/Entities/Operaciones/EnvioConcentrado.cs`
```csharp
public class EnvioConcentrado
{
    public int IdEnvioConcentrado { get; set; }
    public string Folio { get; set; } = string.Empty;
    public int IdUsuarioEnvio { get; set; }
    public DateTime FechaEnvio { get; set; }
    public string Estado { get; set; } = "PENDIENTE";
    public DateTime? FechaRespuesta { get; set; }
    public int? IdUsuarioRespuesta { get; set; }
    public string? ComentarioRespuesta { get; set; }
    public string TokenSeguridad { get; set; } = string.Empty;
    public decimal Total { get; set; }
    public int CantidadOrdenes { get; set; }
    public bool Activo { get; set; } = true;
    
    public virtual ICollection<OrdenCompra> Ordenes { get; set; } = new List<OrdenCompra>();
}
```

### 3. Backend - Refactorizar EnvioConcentradoAsync

**Archivo:** `Features/OrdenesCompra/Firmas/FirmasService.cs`

```csharp
public async Task<ErrorOr<EnvioConcentradoResponse>> EnvioConcentradoAsync(
    EnvioConcentradoRequest request, int idUsuario)
{
    using var transaction = await _context.Database.BeginTransactionAsync();
    
    try
    {
        // 1. Validar que todas las órdenes estén en el mismo estado
        var ordenes = await _context.OrdenesCompra
            .Where(o => request.IdsOrdenes.Contains(o.IdOrden))
            .ToListAsync();
            
        var estados = ordenes.Select(o => o.IdEstado).Distinct().ToList();
        if (estados.Count != 1)
            return CommonErrors.Conflict("ordenes", "Las órdenes deben estar en el mismo estado.");
        
        // 2. Firmar cada orden (avanza al paso del Director)
        var resultados = new List<EnvioConcentradoItemResult>();
        foreach (var idOrden in request.IdsOrdenes)
        {
            var resultado = await FirmarOrdenEnvioConcentradoAsync(idOrden, idUsuario);
            resultados.Add(resultado);
        }
        
        var exitosas = resultados.Count(r => r.Exitoso);
        if (exitosas == 0)
        {
            await transaction.RollbackAsync();
            return new EnvioConcentradoResponse 
            { 
                Total = request.IdsOrdenes.Count, 
                Exitosas = 0, 
                Fallidas = request.IdsOrdenes.Count,
                Resultados = resultados 
            };
        }
        
        // 3. Crear registro de concentrado
        var idsExitosas = resultados.Where(r => r.Exitoso).Select(r => r.IdOrden).ToList();
        var ordenesExitosas = ordenes.Where(o => idsExitosas.Contains(o.IdOrden)).ToList();
        var total = ordenesExitosas.Sum(o => o.Total);
        
        var folio = GenerarFolioConcentrado();
        var token = GenerarTokenSeguridad();
        
        var envioConcentrado = new EnvioConcentrado
        {
            Folio = folio,
            IdUsuarioEnvio = idUsuario,
            Estado = "PENDIENTE",
            TokenSeguridad = token,
            Total = total,
            CantidadOrdenes = ordenesExitosas.Count,
            Ordenes = ordenesExitosas
        };
        
        _context.EnviosConcentrado.Add(envioConcentrado);
        await _context.SaveChangesAsync();
        
        // 4. Enviar al sistema externo
        try
        {
            await _httpClient.PostAsJsonAsync(
                _config["Integraciones:EnvioConcentrado:EndpointExterno"],
                new 
                {
                    IdConcentrado = folio,
                    TokenSeguridad = token,
                    IdsOrdenes = idsExitosas,
                    Total = total,
                    CantidadOrdenes = ordenesExitosas.Count,
                    FechaEnvio = envioConcentrado.FechaEnvio
                });
        }
        catch (HttpRequestException)
        {
            // El concentrado queda en PENDIENTE, se puede reintentar
            // Loggear error pero no fallar la operación
        }
        
        await transaction.CommitAsync();
        
        return new EnvioConcentradoResponse
        {
            Total = request.IdsOrdenes.Count,
            Exitosas = exitosas,
            Fallidas = request.IdsOrdenes.Count - exitosas,
            Resultados = resultados,
            FolioConcentrado = folio  // Agregar al DTO si es necesario
        };
    }
    catch (Exception ex)
    {
        await transaction.RollbackAsync();
        return CommonErrors.InternalServerError($"Error en envío concentrado: {ex.Message}");
    }
}
```

### 4. Backend - Endpoint de respuesta

**Archivo:** `Features/OrdenesCompra/Integraciones/EnvioConcentradoExternoController.cs`

```csharp
[HttpPost("respuesta")]
public async Task<IActionResult> RecibirRespuesta(
    [FromBody] RespuestaConcentradoExternoRequest request)
{
    // 1. Buscar concentrado
    var concentrado = await _context.EnviosConcentrado
        .Include(e => e.Ordenes)
        .FirstOrDefaultAsync(e => e.Folio == request.IdConcentrado 
            && e.TokenSeguridad == request.TokenSeguridad);
    
    if (concentrado == null)
        return NotFound("Concentrado no encontrado o token inválido.");
    
    if (concentrado.Estado != "PENDIENTE")
        return Conflict($"El concentrado ya fue {concentrado.Estado}.");
    
    // 2. Procesar respuesta
    var resultados = new List<EnvioConcentradoItemResult>();
    var esAprobar = request.Accion.ToUpper() == "APROBAR";
    
    foreach (var orden in concentrado.Ordenes)
    {
        var accionesPaso = await _workflowRepo.GetAccionesDisponiblesAsync(orden.IdPasoActual.Value);
        var accion = esAprobar
            ? accionesPaso.FirstOrDefault(a => a.TipoAccion?.Codigo == "APROBAR" && a.Activo)
            : accionesPaso.FirstOrDefault(a => a.TipoAccion?.Codigo == "DEVOLVER" && a.Activo);
        
        if (accion == null)
        {
            resultados.Add(new EnvioConcentradoItemResult 
            { 
                IdOrden = orden.IdOrden, 
                Exitoso = false, 
                Error = $"Acción {request.Accion} no disponible" 
            });
            continue;
        }
        
        var resultado = await _engine.EjecutarAccionAsync(new WorkflowContext(
            orden.IdOrden, accion.IdAccion, idUsuario: 0, // 0 = sistema externo
            comentario: request.Comentario
        ));
        
        resultados.Add(new EnvioConcentradoItemResult
        {
            IdOrden = orden.IdOrden,
            Exitoso = resultado.Exitoso,
            Error = resultado.Error
        });
    }
    
    // 3. Actualizar concentrado
    concentrado.Estado = esAprobar ? "APROBADO" : "DEVUELTO";
    concentrado.FechaRespuesta = DateTime.UtcNow;
    concentrado.ComentarioRespuesta = request.Comentario;
    await _context.SaveChangesAsync();
    
    return Ok(new 
    {
        Exitoso = resultados.All(r => r.Exitoso),
        Resultados = resultados
    });
}
```

## Tareas actualizadas

| Orden | Tarea | Archivos | Esfuerzo |
|-------|-------|----------|----------|
| 1 | Crear migration SQL | `017_create_envios_concentrado.sql` | 15 min |
| 2 | Crear Entity y Config | `EnvioConcentrado.cs`, config | 15 min |
| 3 | Actualizar DbContext | `ApplicationDbContext.cs` | 5 min |
| 4 | Refactorizar EnvioConcentradoAsync (crear registro + enviar) | `FirmasService.cs` | 30 min |
| 5 | Crear endpoint de respuesta | `EnvioConcentradoExternoController.cs` | 20 min |
| 6 | Modificar WorkflowEngine (bypass usuario 0) | `WorkflowEngine.cs` | 15 min |
| 7 | Agregar HttpClient al DI | `Program.cs` | 5 min |
| 8 | Build + probar | — | 15 min |

**Tiempo estimado total:** ~2 horas

## Ventajas clave de esta aproximación

1. **El sistema externo solo necesita 2 datos:** `idConcentrado` + `tokenSeguridad` + `accion`
2. **Reintentos:** Si falla el envío al sistema externo, el concentrado queda en PENDIENTE y se puede reenviar
3. **Trazabilidad completa:** Se sabe exactamente qué órdenes fueron enviadas juntas, cuándo, y qué pasó después
4. **Rollback:** Si el Director devuelve, todas las órdenes vuelven al paso anterior
5. **Concurrencia:** No hay problema si varios usuarios envían concentrados simultáneamente

## Notas importantes

- El `token_seguridad` es generado automáticamente (GUID o hash). Es único por concentrado.
- El sistema externo DEBE almacenar el `token_seguridad` junto con el `idConcentrado` para poder responder.
- Si una orden del concentrado ya fue procesada individualmente (fuera del concentrado), el endpoint de respuesta debería manejar ese caso (ignorarla o reportarla).
- Para reenviar un concentrado que falló, se puede crear un endpoint `POST /ordenes/envio-concentrado/{folio}/reenviar`.

