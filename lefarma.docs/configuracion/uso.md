# Uso del módulo Configuración

Este documento explica cómo consumir las variables globales desde frontend, backend, SQL y sistemas externos.

## Reglas generales

- Cada variable tiene una clave estable con formato `namespace.nombre`, por ejemplo `viaticos.diasLimite`.
- La clave y el tipo de dato raíz no se pueden cambiar después de crear la variable.
- Una variable debe marcarse explícitamente para cada destino:
  - Backend
  - Frontend
  - SQL
  - Integraciones externas
- Las variables de Backend, SQL o Integraciones nunca se envían al navegador.
- Todo cambio genera una entrada de bitácora y una nueva revisión.
- Restaurar una versión crea un cambio nuevo; nunca borra el historial posterior.

## Frontend

### Uso básico

```tsx
import { useConfig } from '@/shared/configuracion/useConfig';

export function MiPantalla() {
  const diasLimite = useConfig<number>('viaticos.diasLimite', 30);

  return <span>{diasLimite} días</span>;
}
```

Al montar la pantalla, el hook:

1. Registra la clave.
2. Muestra inmediatamente el valor de `localStorage` si existe.
3. Confirma contra el servidor el valor vigente.
4. Se vuelve a renderizar cuando otro usuario cambia la variable.

El segundo argumento es opcional y se usa mientras no existe un valor.

### Con estado de carga o error

```tsx
import { useConfigState } from '@/shared/configuracion/useConfig';

const { valor, loading, error, revision, refresh } =
  useConfigState<number>('viaticos.diasLimite');
```

- `loading` solo es `true` si no existe valor cacheado.
- `error` no borra el último valor conocido.
- `refresh()` fuerza una consulta.

### Objetos y listas

```tsx
interface TerminalPago {
  moneda: string;
  habilitado: boolean;
}

const terminal = useConfig<TerminalPago>('pagos.terminal');
```

Las variables frontend se conservan en `localStorage` bajo `lefarma.configuracion.v1`. Si la clave está corrupta o el almacenamiento está lleno, la aplicación continúa con la copia en memoria.

## Backend

Inyecta `IConfiguracionRuntimeService`:

```csharp
using Lefarma.API.Features.Configuracion;

public sealed class MiServicio
{
    private readonly IConfiguracionRuntimeService _configuracion;

    public MiServicio(IConfiguracionRuntimeService configuracion)
    {
        _configuracion = configuracion;
    }

    public async Task<int> ObtenerDiasLimiteAsync(CancellationToken ct)
    {
        var resultado = await _configuracion.GetAsync<int>(
            "viaticos.diasLimite",
            ct);

        if (resultado.IsError)
        {
            // Aplicar el valor predeterminado o fallar según la regla de negocio.
            return 30;
        }

        return resultado.Value;
    }
}
```

Para valores textuales:

```csharp
var nombre = await _configuracion.GetTextAsync(
    "general.nombreComercial",
    cancellationToken);
```

Comportamiento:

- Solo devuelve variables activas y marcadas como Backend.
- Usa caché en memoria para evitar consultar la base en cada operación.
- La API invalida la caché después de confirmar un cambio.
- Si la base falla, devuelve el último valor conocido mientras exista en caché.
- Si no hay valor previo, devuelve un error `ErrorOr`; no inventa un valor.

## SQL Server

La función de solo lectura es:

```sql
config.fn_obtener_variable(@clave)
```

Ejemplos:

```sql
-- Entero
DECLARE @dias int =
    TRY_CONVERT(int, config.fn_obtener_variable(N'viaticos.diasLimite'));

-- Texto
SELECT config.fn_obtener_variable(N'general.nombreComercial');

-- Booleano (1/0)
DECLARE @habilitado bit =
    TRY_CONVERT(bit, config.fn_obtener_variable(N'pagos.habilitado'));

-- Objeto
SELECT *
FROM OPENJSON(config.fn_obtener_variable(N'pagos.terminal'))
WITH (
    moneda nvarchar(3) '$.moneda',
    habilitado bit '$.habilitado'
);

-- Arreglo
SELECT [key], [value], [type]
FROM OPENJSON(config.fn_obtener_variable(N'pagos.opciones'));
```

Contrato:

- Devuelve `NULL` si la clave no existe, está inactiva o no está disponible para SQL.
- Los tipos escalares se devuelven como texto sin comillas JSON.
- Los booleanos se devuelven como `1` o `0`.
- Objetos, arreglos y JSON libre se devuelven como JSON completo.
- En consultas masivas, lee la variable una vez en una variable T-SQL o usa un JOIN; no invoques la función por cada fila.

## API para otros sistemas

Primero se crea un cliente en la pestaña **Integraciones** del módulo. La llave completa se muestra una sola vez y debe guardarse en el sistema consumidor.

La variable debe tener activado el destino **Integraciones**.

### Una variable

```http
GET /api/configuracion/integraciones/variables/viaticos.diasLimite
X-API-Key: cfg_...
```

Respuesta:

```json
{
  "clave": "viaticos.diasLimite",
  "tipoDato": "integer",
  "valor": 45,
  "revision": 12
}
```

### Varias variables

```http
POST /api/configuracion/integraciones/variables/consultar
X-API-Key: cfg_...
Content-Type: application/json

{
  "claves": [
    "viaticos.diasLimite",
    "general.moneda"
  ]
}
```

Los clientes de integración pueden limitarse a claves exactas o prefijos terminados en `*`, por ejemplo `viaticos.*`.

## Permisos

El módulo está oculto y protegido por permisos:

| Permiso | Uso |
|---|---|
| `configuracion.view` | Ver el módulo, el listado y los valores |
| `configuracion.create` | Crear variables |
| `configuracion.update` | Editar, desactivar y reactivar |
| `configuracion.history` | Consultar la bitácora |
| `configuracion.restore` | Restaurar versiones |
| `configuracion.api_keys` | Administrar clientes de integración |

La instalación crea los permisos, pero **no los asigna a nadie**. Deben asignarse explícitamente desde la administración de usuarios o roles.

## Sincronización

- SSE notifica que existe una revisión nueva; no transporta valores.
- Cada pantalla confirma sus claves al entrar.
- Las claves ya conocidas por esa computadora se mantienen sincronizadas incluso fuera del módulo.
- Hay polling de respaldo cada 10 minutos.
- También se sincroniza al recuperar internet, al volver a la pestaña y después de una reconexión SSE.
- Las respuestas fuera de orden se descartan por revisión.
