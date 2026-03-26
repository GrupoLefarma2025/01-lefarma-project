# Pages - Frontend Documentation

## Índice

- [Auth](#auth)
- [Dashboard](#dashboard)
- [Catálogos](#catálogos)
- [Configuración](#configuración)
- [Perfil](#perfil)
- [Centro de Ayuda](#centro-de-ayuda)
- [NotFound](#notfound)

---

## Auth

### Login

**Archivo:** `src/pages/auth/Login.tsx`

Página de inicio de sesión con diseño centrado y gradiente de fondo.

#### Props

| Prop | Tipo | Descripción |
|------|------|-------------|
| - | - | No recibe props (usa estado global) |

#### Estado Local

| Estado | Tipo | Descripción |
|--------|------|-------------|
| `username` | `string` | Nombre de usuario |
| `password` | `string` | Contraseña |
| `error` | `string \| null` | Mensaje de error |
| `isLoading` | `boolean` | Estado de carga |

#### Funcionalidad

```tsx
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  setError(null);

  try {
    await login({ username, password });
    // Redirige automáticamente vía authStore
  } catch (err) {
    setError('Credenciales inválidas');
  } finally {
    setIsLoading(false);
  }
};
```

#### UI Components

- `Building2` - Icono de empresa
- `Lock`, `Mail`, `AlertCircle` - Iconos de formulario
- `Input` - Campo de texto
- `Button` - Botón de submit

#### Diseño

- Fondo: Gradiente de slate-50 a blue-50
- Card centrada con sombra
- Versión de app mostrada en esquina

---

## Dashboard

**Archivo:** `src/pages/Dashboard.tsx`

Página principal del sistema con estadísticas y resumen.

#### Secciones

##### 1. Header
- Título: "Dashboard"
- Descripción: "Bienvenido al sistema de gestión"

##### 2. Tarjetas de Estadísticas

| Métrica | Icono | Valor |
|---------|-------|-------|
| Empresas | `Building2` | 3 |
| Usuarios | `Users` | 12 |
| Roles | `Shield` | 5 |
| Productos | `Package` | 148 |

##### 3. Actividad Reciente

Lista de eventos:
- Usuario creado (hace 2 horas)
- Empresa actualizada (hace 3 horas)
- Nueva sucursal agregada (hace 5 horas)

##### 4. Estadísticas del Mes

| Métrica | Valor | Cambio |
|---------|-------|--------|
| Ventas | $124,500 | +12% |
| Pedidos | 48 | +8% |
| Clientes | 156 | +5% |

#### UI Components

- `Card`, `CardHeader`, `CardContent` - Contenedores
- Iconos: `Building2`, `Users`, `Shield`, `Package`, `TrendingUp`, `ShoppingCart`, `UserPlus`

---

## Catálogos

### RolesList

**Archivo:** `src/pages/catalogos/Roles/RolesList.tsx`

Página de gestión de roles (en construcción).

```tsx
export function RolesList() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Roles</h1>
      <p className="text-gray-600">Gestión de roles del sistema</p>
      <div className="mt-4 p-8 text-center text-gray-500">
        Módulo en construcción
      </div>
    </div>
  );
}
```

#### Tipos Relacionados

- `Rol` - Entidad
- `CreateRolDto` - DTO de creación
- `UpdateRolDto` - DTO de actualización

### PermisosList

**Archivo:** `src/pages/catalogos/Permisos/PermisosList.tsx`

Página de gestión de permisos (en construcción).

```tsx
export function PermisosList() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Permisos</h1>
      <p className="text-gray-600">Gestión de permisos del sistema</p>
      <div className="mt-4 p-8 text-center text-gray-500">
        Módulo en construcción
      </div>
    </div>
  );
}
```

#### Tipos Relacionados

- `Permiso` - Entidad
- `CreatePermisoDto` - DTO de creación
- `UpdatePermisoDto` - DTO de actualización

---

## Configuración

### ConfiguracionGeneral

**Archivo:** `src/pages/configuracion/ConfiguracionGeneral.tsx`

Página de configuración general del sistema (en construcción).

```tsx
export function ConfiguracionGeneral() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Configuración General</h1>
      <p className="text-gray-600">Configuración del sistema</p>
    </div>
  );
}
```

---

## Perfil

**Archivo:** `src/pages/Perfil.tsx`

Página de perfil de usuario con información personal.

#### Secciones

##### 1. Información Personal

| Campo | Fuente |
|-------|--------|
| Nombre | `user?.firstName + ' ' + user?.lastName` |
| Username | `user?.username` |
| Email | `user?.email` |
| Rol | `user?.roles?.join(', ')` |

##### 2. Ubicación Actual

| Campo | Fuente |
|-------|--------|
| Empresa | `empresa?.nombre` |
| Sucursal | `sucursal?.nombre` |

##### 3. Acciones

- Cambiar Ubicación (placeholder)

#### UI Components

- `Card`, `CardHeader`, `CardContent` - Contenedores
- `Button` - Acciones
- Iconos: `User`, `Mail`, `Shield`, `Building2`, `MapPin`, `Edit3`

#### Estado Global

```tsx
const { user, empresa, sucursal } = useAuthStore();
```

---

## Centro de Ayuda

### HelpList

**Archivo:** `src/pages/help/HelpList.tsx`

Listado de articulos del centro de ayuda con acceso rapido a lectura y edicion.

- Incluye un switch para conmutar el tipo de documento: `Usuario` vs `Sistemas` (basado en `tipo`).
- Muestra tarjetas de articulos por modulo/tipo.
- Reemplaza la accion principal de "Nuevo Articulo" por "Editar / Guardar" para abrir la vista editable del primer articulo disponible.
- Cuando no hay articulos, mantiene la accion para crear el primero.

### HelpView

**Archivo:** `src/pages/help/HelpView.tsx`

Vista de detalle de articulo con modo lectura y modo edicion rich text.

- Lectura: renderiza contenido Lexical JSON mediante `LexicalRenderer`.
- Edicion: usa `LexicalEditor` (editor visual rich text) en lugar de editar JSON crudo.
- Acciones: flujo `Editar` -> `Guardar` / `Cancelar` y guardado via endpoint de actualizacion.

---

## NotFound

**Archivo:** `src/pages/NotFound.tsx`

Página 404 personalizada.

#### UI

- Icono grande: `FileX` (72x72)
- Título: "Página no encontrada"
- Descripción: "La página que buscas no existe"
- Botón: "Volver al Dashboard"

#### Diseño

- Fondo: Gradiente de slate-50 a blue-50
- Contenido centrado vertical y horizontalmente

```tsx
export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="text-center">
        <FileX className="mx-auto h-20 w-20 text-gray-400" />
        <h1 className="mt-4 text-3xl font-bold text-gray-900">404</h1>
        <p className="mt-2 text-gray-600">Página no encontrada</p>
        <Link to="/">
          <Button>Volver al Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
```

---

## Páginas Futuras

Basado en los catálogos del backend:

| Página | Ruta | Estado |
|--------|------|--------|
| EmpresasList | `/empresas` | Por implementar |
| SucursalesList | `/sucursales` | Por implementar |
| AreasList | `/areas` | Por implementar |
| TiposGastoList | `/tipos-gasto` | Por implementar |
| TiposMedidaList | `/tipos-medida` | Por implementar |
| UnidadesMedidaList | `/unidades-medida` | Por implementar |

---

## Patrones Comunes

### Estructura de Página

```tsx
export function NombrePagina() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Título</h1>
        <p className="text-gray-600">Descripción</p>
      </div>

      {/* Contenido */}
      <div className="space-y-4">
        {/* ... */}
      </div>
    </div>
  );
}
```

### Uso de Estado

```tsx
// Estado local
const [data, setData] = useState<DataType[]>([]);
const [loading, setLoading] = useState(false);

// Estado global
const { user, isAuthenticated } = useAuthStore();

// Efectos
useEffect(() => {
  fetchData();
}, []);
```

### Manejo de Errores

```tsx
try {
  setLoading(true);
  const response = await api.get('/endpoint');
  setData(response.data.data);
} catch (error) {
  toast({
    title: 'Error',
    description: 'No se pudo cargar la información',
    variant: 'destructive'
  });
} finally {
  setLoading(false);
}
```
