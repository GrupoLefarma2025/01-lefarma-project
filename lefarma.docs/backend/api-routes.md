# API Routes - Backend Documentation

Todos los endpoints están bajo el prefijo `/api`.

## Índice de Controladores

- [Áreas](#áreas)
- [Empresas](#empresas)
- [Sucursales](#sucursales)
- [Tipos de Gasto](#tipos-de-gasto)
- [Tipos de Medida](#tipos-de-medida)
- [Unidades de Medida](#unidades-de-medida)
- [Ayuda (Help)](#ayuda-help)

---

## Áreas

**Base URL:** `/api/catalogos/areas`

| Método | Ruta | Descripción | Respuesta |
|--------|------|-------------|-----------|
| GET | `/` | Obtener todas las áreas | `ApiResponse<IEnumerable<AreaResponse>>` |
| GET | `/{id}` | Obtener área por ID | `ApiResponse<AreaResponse>` |
| POST | `/` | Crear nueva área | `ApiResponse<AreaResponse>` |
| PUT | `/{id}` | Actualizar área | `ApiResponse<AreaResponse>` |
| DELETE | `/{id}` | Eliminar área | `ApiResponse<bool>` |

### CreateAreaRequest
```json
{
  "idEmpresa": 1,
  "idSupervisorResponsable": null,
  "nombre": "Área de Ventas",
  "descripcion": "Departamento de ventas",
  "clave": "VEN",
  "numeroEmpleados": 10,
  "activo": true
}
```

---

## Empresas

**Base URL:** `/api/catalogos/empresas`

| Método | Ruta | Descripción | Respuesta |
|--------|------|-------------|-----------|
| GET | `/` | Obtener todas las empresas | `ApiResponse<IEnumerable<EmpresaResponse>>` |
| GET | `/{id}` | Obtener empresa por ID | `ApiResponse<EmpresaResponse>` |
| POST | `/` | Crear nueva empresa | `ApiResponse<EmpresaResponse>` |
| PUT | `/{id}` | Actualizar empresa | `ApiResponse<EmpresaResponse>` |
| DELETE | `/{id}` | Eliminar empresa | `ApiResponse<bool>` |

### CreateEmpresaRequest
```json
{
  "nombre": "Lefarma S.A. de C.V.",
  "descripcion": "Empresa farmacéutica",
  "clave": "LEF",
  "razonSocial": "Lefarma Sociedad Anónima",
  "rfc": "LEF123456ABC",
  "direccion": "Av. Principal 123",
  "colonia": "Centro",
  "ciudad": "Ciudad de México",
  "estado": "CDMX",
  "codigoPostal": "01000",
  "telefono": "5555555555",
  "email": "contacto@lefarma.com",
  "paginaWeb": "https://lefarma.com",
  "numeroEmpleados": 150,
  "activo": true
}
```

---

## Sucursales

**Base URL:** `/api/catalogos/sucursales`

| Método | Ruta | Descripción | Respuesta |
|--------|------|-------------|-----------|
| GET | `/` | Obtener todas las sucursales | `ApiResponse<IEnumerable<SucursalResponse>>` |
| GET | `/{id}` | Obtener sucursal por ID | `ApiResponse<SucursalResponse>` |
| POST | `/` | Crear nueva sucursal | `ApiResponse<SucursalResponse>` |
| PUT | `/{id}` | Actualizar sucursal | `ApiResponse<SucursalResponse>` |
| DELETE | `/{id}` | Eliminar sucursal | `ApiResponse<bool>` |

### CreateSucursalRequest
```json
{
  "idEmpresa": 1,
  "nombre": "Sucursal Centro",
  "descripcion": "Sucursal principal",
  "clave": "SC01",
  "claveContable": "001",
  "direccion": "Calle Centro 456",
  "codigoPostal": "01000",
  "ciudad": "Ciudad de México",
  "estado": "CDMX",
  "telefono": "5555555556",
  "latitud": 19.4326,
  "longitud": -99.1332,
  "numeroEmpleados": 25,
  "activo": true
}
```

---

## Tipos de Gasto

**Base URL:** `/api/catalogos/tipogasto`

| Método | Ruta | Descripción | Respuesta |
|--------|------|-------------|-----------|
| GET | `/` | Obtener todos los tipos de gasto | `ApiResponse<IEnumerable<TipoGastoResponse>>` |
| GET | `/{id}` | Obtener tipo de gasto por ID | `ApiResponse<TipoGastoResponse>` |
| POST | `/` | Crear nuevo tipo de gasto | `ApiResponse<TipoGastoResponse>` |
| PUT | `/{id}` | Actualizar tipo de gasto | `ApiResponse<TipoGastoResponse>` |
| DELETE | `/{id}` | Eliminar tipo de gasto | `ApiResponse<bool>` |

### CreateTipoGastoRequest
```json
{
  "nombre": "Gastos de Viaje",
  "descripcion": "Gastos relacionados con viajes de negocios",
  "clave": "GV",
  "concepto": "Viajes",
  "cuenta": "600",
  "subCuenta": "10",
  "analitica": "1",
  "integracion": "SIIGO",
  "requiereComprobacionPago": true,
  "requiereComprobacionGasto": true,
  "permiteSinDatosFiscales": false,
  "diasLimiteComprobacion": 15,
  "activo": true
}
```

---

## Tipos de Medida

**Base URL:** `/api/catalogos/tiposmedida`

| Método | Ruta | Descripción | Respuesta |
|--------|------|-------------|-----------|
| GET | `/` | Obtener todos los tipos de medida | `ApiResponse<IEnumerable<TipoMedidaResponse>>` |
| GET | `/{id}` | Obtener tipo de medida por ID | `ApiResponse<TipoMedidaResponse>` |
| POST | `/` | Crear nuevo tipo de medida | `ApiResponse<TipoMedidaResponse>` |
| PUT | `/{id}` | Actualizar tipo de medida | `ApiResponse<TipoMedidaResponse>` |
| DELETE | `/{id}` | Eliminar tipo de medida | `ApiResponse<bool>` |

### CreateTipoMedidaRequest
```json
{
  "nombre": "Longitud",
  "descripcion": "Medidas de longitud",
  "activo": true
}
```

---

## Unidades de Medida

**Base URL:** `/api/catalogos/unidadesmedida`

| Método | Ruta | Descripción | Respuesta |
|--------|------|-------------|-----------|
| GET | `/` | Obtener todas las unidades de medida | `ApiResponse<IEnumerable<UnidadMedidaResponse>>` |
| GET | `/{id}` | Obtener unidad de medida por ID | `ApiResponse<UnidadMedidaResponse>` |
| POST | `/` | Crear nueva unidad de medida | `ApiResponse<UnidadMedidaResponse>` |
| PUT | `/{id}` | Actualizar unidad de medida | `ApiResponse<UnidadMedidaResponse>` |
| DELETE | `/{id}` | Eliminar unidad de medida | `ApiResponse<bool>` |

### CreateUnidadMedidaRequest
```json
{
  "idTipoMedida": 1,
  "nombre": "Metro",
  "descripcion": "Unidad de longitud",
  "abreviatura": "m",
  "activo": true
}
```

---

## Ayuda (Help)

**Base URL:** `/api/help`

| Método | Ruta | Descripción | Respuesta | Auth |
|--------|------|-------------|-----------|------|
| POST | `/images` | Subir imagen para articulo de ayuda | `ApiResponse<HelpImageUploadResponse>` | Administrator, Manager |
| GET | `/articles/for-user` | Obtener articulos para usuario actual | `ApiResponse<IEnumerable<HelpArticleDto>>` | Autenticado |

### POST /api/help/images

Endpoint para subir imagenes utilizadas en articulos de ayuda.

**Request:**
- Content-Type: `multipart/form-data`
- Campo: `file` (tipo archivo)

**Restricciones:**
- Formatos permitidos: JPG, PNG, GIF, WebP
- Tamaño maximo: 5MB

**Response:** `HelpImageUploadResponse`

```json
{
  "success": true,
  "message": "Imagen subida exitosamente",
  "data": {
    "id": 1,
    "nombreOriginal": "screenshot.png",
    "nombreArchivo": "img_abc123.png",
    "rutaRelativa": "/media/help/2026/03/img_abc123.png",
    "tamanhoBytes": 102400,
    "mimeType": "image/png",
    "ancho": 800,
    "alto": 600,
    "fechaSubida": "2026-03-25T10:30:00Z"
  }
}
```

### GET /api/help/articles/for-user

Endpoint para obtener articulos de ayuda visibles para el usuario actual.

**Query Parameters:**

| Parametro | Tipo | Requerido | Descripcion |
|-----------|------|-----------|-------------|
| `modulo` | string | No | Filtrar por modulo (Catalogos, Auth, Notificaciones, Profile, Admin, SystemConfig, General) |

**Response:** Array de `HelpArticleDto`

```json
{
  "success": true,
  "message": "Articulos obtenidos",
  "data": [
    {
      "id": 1,
      "titulo": "Como crear una empresa",
      "contenido": "{...Lexical JSON...}",
      "resumen": "Guia paso a paso...",
      "modulo": "Catalogos",
      "tipo": "usuario",
      "categoria": "Empresas",
      "orden": 1,
      "activo": true,
      "fechaCreacion": "2026-03-25T10:00:00Z",
      "fechaActualizacion": "2026-03-25T10:00:00Z"
    }
  ]
}
```

**Nota:** Este endpoint retorna articulos donde `tipo` es `'usuario'` o `'ambos'`.

### Archivos Estaticos

Las imagenes de ayuda se sirven como archivos estaticos:

**URL Pattern:** `/media/help/{year}/{month}/{filename}`

**Ejemplo:** `http://localhost:5000/media/help/2026/03/img_abc123.png`

**Headers de Cache:**
- `Cache-Control: public, max-age=31536000` (1 año)
- Optimizado para assets inmutables

---

## Formato de Respuesta

Todas las respuestas siguen el formato `ApiResponse<T>`:

```json
{
  "success": true,
  "message": "Operación exitosa",
  "data": { ... },
  "errors": null
}
```

En caso de error:

```json
{
  "success": false,
  "message": "Error de validación",
  "data": null,
  "errors": [
    { "field": "nombre", "message": "El nombre es requerido" }
  ]
}
```

---

## Códigos de Estado HTTP

| Código | Significado |
|--------|-------------|
| 200 | Éxito |
| 201 | Creado |
| 400 | Bad Request (validación) |
| 401 | No autorizado |
| 403 | Prohibido |
| 404 | No encontrado |
| 409 | Conflicto (duplicado) |
| 500 | Error interno del servidor |
