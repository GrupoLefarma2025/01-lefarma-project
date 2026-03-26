# Types - Frontend Documentation

## Índice

- [API Types](#api-types)
- [Auth Types](#auth-types)
- [Permiso Types](#permiso-types)
- [Rol Types](#rol-types)
- [Help Types](#help-types)

---

## API Types

**Archivo:** `src/types/api.types.ts`

Tipos genéricos para respuestas de la API.

### ApiResponse<T>

Respuesta estándar de todos los endpoints.

```typescript
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: ErrorDetail[];
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `success` | `boolean` | Indica si la operación fue exitosa |
| `message` | `string` | Mensaje descriptivo |
| `data` | `T` | Datos de la respuesta |
| `errors` | `ErrorDetail[]` | Errores de validación (opcional) |

### ErrorDetail

```typescript
export interface ErrorDetail {
  field: string;
  message: string;
}
```

### ApiError

Error estandarizado de la API.

```typescript
export interface ApiError {
  message: string;
  errors?: ErrorDetail[];
  statusCode: number;
}
```

### PaginatedResponse<T>

Respuesta paginada para listados.

```typescript
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `data` | `T[]` | Items de la página actual |
| `total` | `number` | Total de items |
| `page` | `number` | Página actual |
| `pageSize` | `number` | Items por página |
| `totalPages` | `number` | Total de páginas |

---

## Auth Types

**Archivo:** `src/types/auth.types.ts`

Tipos relacionados con autenticación y usuarios.

### User

```typescript
export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `string` | ID único del usuario |
| `username` | `string` | Nombre de usuario |
| `email` | `string` | Correo electrónico |
| `firstName` | `string` | Nombre |
| `lastName` | `string` | Apellido |
| `roles` | `string[]` | Roles asignados |

### Empresa

```typescript
export interface Empresa {
  id: number;
  nombre: string;
  codigo: string;
  activo: boolean;
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `number` | ID de la empresa |
| `nombre` | `string` | Nombre comercial |
| `codigo` | `string` | Código corto |
| `activo` | `boolean` | Estado activo |

### Sucursal

```typescript
export interface Sucursal {
  id: number;
  empresaId: number;
  nombre: string;
  codigo: string;
  direccion?: string;
  telefono?: string;
  activo: boolean;
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `number` | ID de la sucursal |
| `empresaId` | `number` | ID de la empresa padre |
| `nombre` | `string` | Nombre de la sucursal |
| `codigo` | `string` | Código corto |
| `direccion` | `string` | Dirección física |
| `telefono` | `string` | Teléfono |
| `activo` | `boolean` | Estado activo |

### LoginCredentials

```typescript
export interface LoginCredentials {
  username: string;
  password: string;
}
```

### LoginResponse

```typescript
export interface LoginResponse {
  token: string;
  user: User;
  empresas: Empresa[];
}
```

### AuthState

Estado completo del store de autenticación.

```typescript
export interface AuthState {
  user: User | null;
  token: string | null;
  empresa: Empresa | null;
  sucursal: Sucursal | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
```

### AuthActions

Acciones disponibles en el auth store.

```typescript
export interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  setEmpresa: (empresa: Empresa | null) => void;
  setSucursal: (sucursal: Sucursal | null) => void;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  initialize: () => void;
}
```

---

## Permiso Types

**Archivo:** `src/types/permiso.types.ts`

Tipos para gestión de permisos.

### Permiso

```typescript
export interface Permiso {
  id: number;
  nombre: string;
  codigo: string;
  descripcion?: string;
  activo: boolean;
  fechaCreacion: string;
  fechaModificacion?: string;
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `number` | ID del permiso |
| `nombre` | `string` | Nombre descriptivo |
| `codigo` | `string` | Código único |
| `descripcion` | `string` | Descripción opcional |
| `activo` | `boolean` | Estado activo |
| `fechaCreacion` | `string` | Fecha ISO de creación |
| `fechaModificacion` | `string` | Fecha ISO de modificación |

### CreatePermisoDto

```typescript
export interface CreatePermisoDto {
  nombre: string;
  codigo: string;
  descripcion?: string;
  activo?: boolean;
}
```

### UpdatePermisoDto

```typescript
export interface UpdatePermisoDto {
  id: number;
  nombre: string;
  codigo: string;
  descripcion?: string;
  activo: boolean;
}
```

---

## Rol Types

**Archivo:** `src/types/rol.types.ts`

Tipos para gestión de roles.

### Rol

```typescript
export interface Rol {
  id: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  permisos: Permiso[];
  fechaCreacion: string;
  fechaModificacion?: string;
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `number` | ID del rol |
| `nombre` | `string` | Nombre del rol |
| `descripcion` | `string` | Descripción opcional |
| `activo` | `boolean` | Estado activo |
| `permisos` | `Permiso[]` | Permisos asignados |
| `fechaCreacion` | `string` | Fecha ISO de creación |
| `fechaModificacion` | `string` | Fecha ISO de modificación |

### CreateRolDto

```typescript
export interface CreateRolDto {
  nombre: string;
  descripcion?: string;
  activo?: boolean;
  permisoIds?: number[];
}
```

### UpdateRolDto

```typescript
export interface UpdateRolDto {
  id: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  permisoIds?: number[];
}
```

---

## Help Types

**Archivo:** `src/types/help.types.ts`

Tipos para el modulo de ayuda.

### HelpArticle

```typescript
export interface HelpArticle {
  id: number;
  titulo: string;
  contenido: string; // Lexical JSON
  resumen?: string;
  modulo: 'Catalogos' | 'Auth' | 'Notificaciones' | 'Profile' | 'Admin' | 'SystemConfig' | 'General';
  tipo: 'usuario' | 'desarrollador' | 'ambos';
  categoria?: string;
  orden: number;
  activo: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;
  creadoPor?: string;
  actualizadoPor?: string;
}
```

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | `number` | ID del articulo |
| `titulo` | `string` | Titulo del articulo |
| `contenido` | `string` | Contenido serializado como JSON de Lexical |
| `resumen` | `string` | Resumen opcional |
| `modulo` | `string` | Modulo al que pertenece |
| `tipo` | `string` | Audiencia: usuario, desarrollador, ambos |
| `categoria` | `string` | Categoria opcional para agrupar |
| `orden` | `number` | Orden de visualizacion |
| `activo` | `boolean` | Estado activo/inactivo |

### HelpImageUploadResponse

```typescript
export interface HelpImageUploadResponse {
  id: number;
  nombreOriginal: string;
  nombreArchivo: string;
  rutaRelativa: string;
  tamanhoBytes: number;
  mimeType: string;
  ancho?: number;
  alto?: number;
  fechaSubida: string;
}
```

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | `number` | ID de la imagen |
| `nombreOriginal` | `string` | Nombre original del archivo subido |
| `nombreArchivo` | `string` | Nombre generado en el servidor |
| `rutaRelativa` | `string` | URL relativa para acceder a la imagen (ej: `/media/help/2026/03/img.png`) |
| `tamanhoBytes` | `number` | Tamaño en bytes |
| `mimeType` | `string` | Tipo MIME (ej: `image/png`) |
| `ancho` | `number` | Ancho en pixels (opcional) |
| `alto` | `number` | Alto en pixels (opcional) |
| `fechaSubida` | `string` | Fecha ISO de subida |

### CreateHelpArticleRequest

```typescript
export interface CreateHelpArticleRequest {
  titulo: string;
  contenido: string;
  resumen?: string;
  modulo: string;
  tipo: string;
  categoria?: string;
  orden: number;
}
```

### UpdateHelpArticleRequest

```typescript
export interface UpdateHelpArticleRequest extends CreateHelpArticleRequest {
  id: number;
  activo: boolean;
}
```

### HelpImage

```typescript
export interface HelpImage {
  id: number;
  nombreOriginal: string;
  nombreArchivo: string;
  rutaRelativa: string;
  tamanhoBytes: number;
  mimeType: string;
  fechaSubida: string;
  subidoPor?: string;
}
```

---

## Convenciones

### Nomenclatura

| Tipo | Convención | Ejemplo |
|------|------------|---------|
| Interfaces | PascalCase | `ApiResponse` |
| Props | camelCase | `firstName` |
| DTOs | Sufijo `Dto` | `CreateUserDto` |
| Opcionales | `?` | `descripcion?: string` |

### Fechas

Todas las fechas vienen del backend como strings ISO 8601:

```typescript
const fecha: string = "2026-02-24T10:30:00Z";

// Parsear con date-fns
import { parseISO, format } from 'date-fns';
const date = parseISO(fecha);
const formatted = format(date, 'dd/MM/yyyy');
```

### IDs

- **Usuario**: `string` (UUID)
- **Entidades de negocio**: `number` (int)

### Estados Booleanos

En este proyecto usamos nombres de propiedades en **español** para mantener consistencia con el resto del modelo de datos (`nombre`, `descripcion`, etc.).

```typescript
// Convención de nombres en este proyecto (español)
activo: boolean;        // ✅ correcto en este proyecto
esActivo: boolean;      // ❌ evitar prefijo "es"
isActive: boolean;      // ❌ evitar inglés en nombres de propiedades
```
