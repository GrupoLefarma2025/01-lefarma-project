# Services - Frontend Documentation

## Índice

- [API Client](#api-client)
- [Auth Service](#auth-service)
- [Help Service](#help-service)

---

## API Client

**Archivo:** `src/services/api.ts`

Configuración de Axios para comunicación con el backend.

### Configuración Base

```typescript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

### Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `VITE_API_URL` | URL base del API | `http://localhost:5000/api` |

### Interceptores

#### Request Interceptor

```typescript
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
```

**Funcionalidad:** Agrega automáticamente el token JWT a todas las peticiones.

#### Response Interceptor

```typescript
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    if (error.response?.status === 403) {
      toast({
        title: 'Acceso denegado',
        description: 'No tienes permisos para realizar esta acción',
        variant: 'destructive',
      });
    }
    return Promise.reject(error);
  }
);
```

**Manejo de errores:**
- `401 Unauthorized` → Limpia token y redirige a login
- `403 Forbidden` → Muestra toast de acceso denegado

### Métodos Exportados

```typescript
export const apiClient = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    api.get<ApiResponse<T>>(url, config),

  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    api.post<ApiResponse<T>>(url, data, config),

  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    api.put<ApiResponse<T>>(url, data, config),

  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    api.patch<ApiResponse<T>>(url, data, config),

  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    api.delete<ApiResponse<T>>(url, config),
};
```

### Uso

```typescript
import { apiClient } from '@/services/api';

// GET
const response = await apiClient.get<Empresa[]>('/catalogos/empresas');
const empresas = response.data.data;

// POST
const newEmpresa = await apiClient.post<Empresa>('/catalogos/empresas', {
  nombre: 'Nueva Empresa',
  // ...
});

// PUT
const updated = await apiClient.put<Empresa>(`/catalogos/empresas/${id}`, data);

// DELETE
await apiClient.delete(`/catalogos/empresas/${id}`);
```

---

## Auth Service

**Archivo:** `src/services/authService.ts`

Servicio de autenticación con funciones de login, logout y gestión de sesión.

### Funciones

#### login(credentials)

```typescript
async function login(credentials: LoginCredentials): Promise<LoginResponse>
```

Inicia sesión y guarda token/usuario en localStorage.

**Request:**
```typescript
{
  username: string;
  password: string;
}
```

**Response:**
```typescript
{
  token: string;
  user: User;
  empresas: Empresa[];
}
```

---

#### logout()

```typescript
function logout(): void
```

Cierra sesión y limpia localStorage.

---

#### getCurrentUser()

```typescript
function getCurrentUser(): User | null
```

Obtiene el usuario desde localStorage.

---

#### getToken()

```typescript
function getToken(): string | null
```

Obtiene el token JWT desde localStorage.

---

#### isAuthenticated()

```typescript
function isAuthenticated(): boolean
```

Verifica si hay un token válido.

---

#### setEmpresa(empresa)

```typescript
function setEmpresa(empresa: Empresa): void
```

Guarda la empresa seleccionada en localStorage.

---

#### getEmpresa()

```typescript
function getEmpresa(): Empresa | null
```

Obtiene la empresa seleccionada desde localStorage.

---

#### setSucursal(sucursal)

```typescript
function setSucursal(sucursal: Sucursal): void
```

Guarda la sucursal seleccionada en localStorage.

---

#### getSucursal()

```typescript
function getSucursal(): Sucursal | null
```

Obtiene la sucursal seleccionada desde localStorage.

---

#### getEmpresas()

```typescript
async function getEmpresas(): Promise<Empresa[]>
```

Obtiene las empresas disponibles del usuario autenticado.

**Endpoint:** `GET /api/auth/empresas`

---

#### getSucursales(empresaId)

```typescript
async function getSucursales(empresaId: number): Promise<Sucursal[]>
```

Obtiene las sucursales de una empresa específica.

**Endpoint:** `GET /api/auth/sucursales?empresaId={id}`

---

### Keys de localStorage

| Key | Descripción |
|-----|-------------|
| `lefarma_token` | Token JWT |
| `lefarma_user` | Datos del usuario (JSON) |
| `lefarma_empresa` | Empresa seleccionada (JSON) |
| `lefarma_sucursal` | Sucursal seleccionada (JSON) |

---

## Auth Store (Zustand)

**Archivo:** `src/store/authStore.ts`

Estado global de autenticación.

### Estado

```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  empresa: Empresa | null;
  sucursal: Sucursal | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
```

### Acciones

| Acción | Descripción |
|--------|-------------|
| `login(credentials)` | Autentica usuario y guarda estado |
| `logout()` | Cierra sesión y limpia estado |
| `setEmpresa(empresa)` | Establece empresa seleccionada |
| `setSucursal(sucursal)` | Establece sucursal seleccionada |
| `setToken(token)` | Establece token manualmente |
| `setUser(user)` | Establece usuario manualmente |
| `initialize()` | Inicializa estado desde localStorage |

### Uso

```typescript
import { useAuthStore } from '@/store/authStore';

// En componente
const { user, login, logout, isAuthenticated } = useAuthStore();

// Login
await login({ username: 'admin', password: 'password' });

// Logout
logout();

// Cambiar empresa
setEmpresa(nuevaEmpresa);
```

### Persistencia

El store se sincroniza automáticamente con localStorage:
- Al hacer login → Guarda token, user, empresas
- Al hacer logout → Limpia todo
- Al cambiar empresa/sucursal → Guarda en localStorage
- Al cargar app → Lee de localStorage (`initialize()`)

---

## Help Service

**Archivo:** `src/services/helpService.ts`

Servicio para CRUD de articulos de ayuda.

### Endpoints

| Metodo | Endpoint | Retorno |
|--------|----------|---------|
| `getAll()` | `GET /help/articles` | `HelpArticle[]` |
| `getById(id)` | `GET /help/articles/{id}` | `HelpArticle` |
| `getByModule(modulo)` | `GET /help/articles/by-module/{modulo}` | `HelpArticle[]` |
| `getByType(tipo)` | `GET /help/articles/by-type/{tipo}` | `HelpArticle[]` |
| `create(article)` | `POST /help/articles` | `HelpArticle` |
| `update(article)` | `PUT /help/articles/{id}` | `HelpArticle` |
| `delete(id)` | `DELETE /help/articles/{id}` | `void` |

### Contrato de respuesta

Todos los metodos leen el contrato `ApiResponse<T>` y retornan `response.data.data` para mantener consistencia con el resto del frontend.
