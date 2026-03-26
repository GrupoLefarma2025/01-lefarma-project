# Components - Frontend Documentation

## Índice

- [Layout Components](#layout-components)
- [UI Components](#ui-components)
- [Help Components](#help-components)

---

## Layout Components

### MainLayout

**Archivo:** `src/components/layout/MainLayout.tsx`

Layout principal de la aplicación para rutas protegidas.

#### Estructura

```
┌─────────────────────────────────────┐
│  Sidebar  │      Header             │
│  (fijo)   ├─────────────────────────┤
│           │                         │
│           │      Content            │
│           │      <Outlet />         │
│           │                         │
└─────────────────────────────────────┘
```

#### Implementación

```tsx
export function MainLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="lg:pl-64">
        <Header />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

#### Props

| Prop | Tipo | Descripción |
|------|------|-------------|
| - | - | No recibe props |

---

### Header

**Archivo:** `src/components/layout/Header.tsx`

Header superior con información de ubicación y menú de usuario.

#### Secciones

##### 1. Ubicación Actual
- Empresa seleccionada
- Sucursal seleccionada

##### 2. Menú de Usuario (Dropdown)
- Perfil
- Cambiar Ubicación
- Separador
- Cerrar Sesión

#### Estado Global

```tsx
const { user, empresa, sucursal, logout } = useAuthStore();
```

#### UI Components

- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`
- `DropdownMenuItem`, `DropdownMenuSeparator`
- Iconos: `Building2`, `MapPin`, `User`, `Settings`, `LogOut`, `ChevronDown`

---

### Sidebar

**Archivo:** `src/components/layout/Sidebar.tsx`

Barra lateral de navegación fija.

#### Items de Menú

| Ruta | Label | Icono |
|------|-------|-------|
| `/` | Dashboard | `LayoutDashboard` |
| `/roles` | Roles | `Shield` |
| `/permisos` | Permisos | `Key` |
| `/perfil` | Perfil | `User` |
| `/configuracion` | Configuración | `Settings` |

#### Logo

- Texto: "LeFarma"
- Badge: "v{version}"

#### Responsive

- Desktop: Visible (`lg:block`)
- Mobile: Oculto (`hidden`)

#### Implementación

```tsx
const menuItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/roles', label: 'Roles', icon: Shield },
  { path: '/permisos', label: 'Permisos', icon: Key },
  { path: '/perfil', label: 'Perfil', icon: User },
  { path: '/configuracion', label: 'Configuración', icon: Settings },
];
```

---

## UI Components

Basados en [Radix UI](https://www.radix-ui.com/) y estilizados con TailwindCSS.

### Button

**Archivo:** `src/components/ui/button.tsx`

Botón con múltiples variantes y tamaños.

#### Variantes

| Variante | Descripción |
|----------|-------------|
| `default` | Fondo primario, texto blanco |
| `destructive` | Fondo rojo, texto blanco |
| `outline` | Borde primario, fondo transparente |
| `secondary` | Fondo secundario, texto secundario |
| `ghost` | Sin fondo, hover suave |
| `link` | Apariencia de enlace |

#### Tamaños

| Tamaño | Clases |
|--------|--------|
| `default` | `h-10 px-4 py-2` |
| `sm` | `h-9 px-3` |
| `lg` | `h-11 px-8` |
| `icon` | `h-10 w-10` |

#### Uso

```tsx
<Button>Default</Button>
<Button variant="destructive">Eliminar</Button>
<Button variant="outline" size="sm">Cancelar</Button>
<Button disabled>Cargando...</Button>
```

---

## Help Components

Componentes para el modulo de ayuda con editor rich text basado en Lexical.

> **Nota:** El componente `HelpCard` ha sido ELIMINADO y no debe usarse.

### LexicalEditor

**Archivo:** `src/components/help/LexicalEditor.tsx`

Editor rich text basado en Lexical para contenido de articulos de ayuda.

#### Props

| Prop | Tipo | Requerido | Descripcion |
|------|------|-----------|-------------|
| `initialContent` | `string` | Si | Estado inicial serializado como JSON de Lexical |
| `onChange` | `(serializedState: string) => void` | Si | Callback emitido en cada cambio con el estado serializado |

#### Caracteristicas

- Carga estado inicial desde JSON serializado
- Emite cambios en cada edicion como JSON serializado
- Incluye historial (`HistoryPlugin`) para undo/redo
- Editor enriquecido (`RichTextPlugin` + `ContentEditable`)
- Placeholder: "Escribe el contenido del articulo aqui..."
- Altura minima: 340px

#### Uso

```tsx
import LexicalEditor from '@/components/help/LexicalEditor';

<LexicalEditor
  initialContent={article.contenido}
  onChange={(json) => setContenido(json)}
/>
```

---

### LexicalViewer

**Archivo:** `src/components/help/LexicalViewer.tsx`

Visor de solo lectura para contenido rich text de articulos de ayuda.

#### Props

| Prop | Tipo | Requerido | Descripcion |
|------|------|-----------|-------------|
| `contenido` | `string` | Si | Estado serializado como JSON de Lexical |

#### Caracteristicas

- Modo de solo lectura (`editable: false`)
- Renderiza contenido sin permitir edicion
- Altura minima: 300px

#### Uso

```tsx
import LexicalViewer from '@/components/help/LexicalViewer';

<LexicalViewer contenido={article.contenido} />
```

---

### RichTextToolbar

**Archivo:** `src/components/help/RichTextToolbar.tsx`

Barra de herramientas para formateo de texto en el editor Lexical.

#### Caracteristicas

| Grupo | Funciones |
|-------|-----------|
| **Historial** | Deshacer, Rehacer |
| **Tipo de bloque** | Parrafo, Titulo 1, Titulo 2, Cita, Codigo |
| **Formato de texto** | Negrita, Cursiva, Subrayado, Tachado, Codigo inline |
| **Listas** | Lista con viñetas, Lista numerada |
| **Insercion** | Enlace, Imagen |

#### Dependencias

- `ToolbarButton` - Boton individual con tooltip
- `ImageUploadDialog` - Dialogo para subir imagenes
- Lexical plugins: `@lexical/list`, `@lexical/rich-text`, `@lexical/link`

#### Uso

```tsx
import { RichTextToolbar } from '@/components/help/RichTextToolbar';

// Debe estar dentro de un LexicalComposer
<LexicalComposer initialConfig={...}>
  <RichTextToolbar />
  <RichTextPlugin ... />
</LexicalComposer>
```

---

### ImageUploadDialog

**Archivo:** `src/components/help/ui/ImageUploadDialog.tsx`

Dialogo modal para subir imagenes al servidor.

#### Props

| Prop | Tipo | Requerido | Descripcion |
|------|------|-----------|-------------|
| `open` | `boolean` | Si | Estado de visibilidad del dialogo |
| `onOpenChange` | `(open: boolean) => void` | Si | Callback para cambiar visibilidad |
| `onImageInserted` | `(response: HelpImageUploadResponse) => void` | Si | Callback con la respuesta del upload |

#### Restricciones de Archivo

| Restriccion | Valor |
|-------------|-------|
| Formatos permitidos | JPG, PNG, GIF, WebP |
| Tamaño maximo | 5MB |
| Tipo MIME | `image/*` |

#### Caracteristicas

- Vista previa de imagen antes de subir
- Muestra nombre y tamaño del archivo
- Estados de carga con indicador spinner
- Manejo de errores con toast notifications

#### Uso

```tsx
import { ImageUploadDialog } from '@/components/help/ui/ImageUploadDialog';

<ImageUploadDialog
  open={isDialogOpen}
  onOpenChange={setIsDialogOpen}
  onImageInserted={(response) => {
    // Insertar imagen en el editor
    console.log(response.rutaRelativa);
  }}
/>
```

---

### ImageNode

**Archivo:** `src/components/help/nodes/ImageNode.tsx`

Nodo decorativo de Lexical para renderizar imagenes en el contenido.

#### Estructura JSON

```json
{
  "type": "image",
  "version": 1,
  "src": "/media/help/2026/03/img_abc123.png",
  "altText": "Descripcion de la imagen",
  "width": 800,
  "height": 600
}
```

#### Propiedades

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `src` | `string` | URL relativa de la imagen |
| `altText` | `string` | Texto alternativo para accesibilidad |
| `width` | `number` | Ancho en pixels (opcional) |
| `height` | `number` | Alto en pixels (opcional) |

#### Funciones de Utilidad

```tsx
import { $createImageNode, $isImageNode } from '@/components/help/nodes/ImageNode';

// Crear nodo de imagen
const imageNode = $createImageNode({
  src: '/media/help/2026/03/img.png',
  altText: 'Screenshot',
  width: 800,
  height: 600,
});

// Verificar tipo de nodo
if ($isImageNode(node)) {
  console.log(node.getSrc());
}
```

---

### ToolbarButton

**Archivo:** `src/components/help/ui/ToolbarButton.tsx`

Boton reutilizable para la barra de herramientas con soporte de tooltip.

#### Props

| Prop | Tipo | Requerido | Descripcion |
|------|------|-----------|-------------|
| `onClick` | `() => void` | Si | Handler de click |
| `isActive` | `boolean` | No | Estado activo (estilo resaltado) |
| `disabled` | `boolean` | No | Estado deshabilitado |
| `children` | `ReactNode` | Si | Icono o contenido del boton |
| `tooltip` | `string` | No | Texto del tooltip |
| `className` | `string` | No | Clases adicionales |

#### Uso

```tsx
import { ToolbarButton } from '@/components/help/ui/ToolbarButton';

<ToolbarButton onClick={handleBold} isActive={isBold} tooltip="Negrita">
  <Bold className="h-4 w-4" />
</ToolbarButton>
```

### Card

**Archivo:** `src/components/ui/card.tsx`

Contenedor con estilo de tarjeta.

#### Subcomponentes

| Componente | Descripción |
|------------|-------------|
| `Card` | Contenedor principal |
| `CardHeader` | Encabezado de la tarjeta |
| `CardTitle` | Título del encabezado |
| `CardDescription` | Descripción del encabezado |
| `CardContent` | Contenido principal |
| `CardFooter` | Pie de la tarjeta |

#### Uso

```tsx
<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descripción</CardDescription>
  </CardHeader>
  <CardContent>
    Contenido
  </CardContent>
  <CardFooter>
    <Button>Acción</Button>
  </CardFooter>
</Card>
```

---

### Dialog

**Archivo:** `src/components/ui/dialog.tsx`

Modal/Popup para contenido superpuesto.

#### Subcomponentes

| Componente | Descripción |
|------------|-------------|
| `Dialog` | Contenedor principal |
| `DialogTrigger` | Elemento que abre el diálogo |
| `DialogContent` | Contenido del diálogo |
| `DialogHeader` | Encabezado |
| `DialogTitle` | Título |
| `DialogDescription` | Descripción |
| `DialogFooter` | Pie con acciones |

#### Uso

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Abrir</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Título del Modal</DialogTitle>
      <DialogDescription>Descripción del modal</DialogDescription>
    </DialogHeader>
    {/* Contenido */}
    <DialogFooter>
      <Button type="submit">Guardar</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### Input

**Archivo:** `src/components/ui/input.tsx`

Campo de texto estilizado.

#### Props

| Prop | Tipo | Descripción |
|------|------|-------------|
| `type` | `string` | Tipo de input (text, password, email, etc.) |
| `placeholder` | `string` | Texto placeholder |
| `disabled` | `boolean` | Estado deshabilitado |

#### Uso

```tsx
<Input type="text" placeholder="Nombre completo" />
<Input type="password" placeholder="Contraseña" />
<Input disabled value="No editable" />
```

---

### Label

**Archivo:** `src/components/ui/label.tsx`

Etiqueta para formularios.

#### Uso

```tsx
<Label htmlFor="email">Email</Label>
<Input id="email" type="email" />
```

---

### Select

**Archivo:** `src/components/ui/select.tsx`

Selector desplegable.

#### Subcomponentes

| Componente | Descripción |
|------------|-------------|
| `Select` | Contenedor principal |
| `SelectTrigger` | Botón que abre el select |
| `SelectValue` | Valor seleccionado |
| `SelectContent` | Lista de opciones |
| `SelectItem` | Opción individual |
| `SelectGroup` | Grupo de opciones |
| `SelectLabel` | Label de grupo |
| `SelectSeparator` | Separador |

#### Uso

```tsx
<Select>
  <SelectTrigger>
    <SelectValue placeholder="Selecciona una opción" />
  </SelectTrigger>
  <SelectContent>
    <SelectGroup>
      <SelectLabel>Grupo</SelectLabel>
      <SelectItem value="1">Opción 1</SelectItem>
      <SelectItem value="2">Opción 2</SelectItem>
    </SelectGroup>
  </SelectContent>
</Select>
```

---

### Table

**Archivo:** `src/components/ui/table.tsx`

Tabla para mostrar datos.

#### Subcomponentes

| Componente | Descripción |
|------------|-------------|
| `Table` | Contenedor principal |
| `TableHeader` | Encabezado de tabla |
| `TableBody` | Cuerpo de tabla |
| `TableFooter` | Pie de tabla |
| `TableRow` | Fila |
| `TableHead` | Celda de encabezado |
| `TableCell` | Celda de datos |
| `TableCaption` | Caption de tabla |

#### Uso

```tsx
<Table>
  <TableCaption>Lista de usuarios</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead>Nombre</TableHead>
      <TableHead>Email</TableHead>
      <TableHead>Rol</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Juan Pérez</TableCell>
      <TableCell>juan@example.com</TableCell>
      <TableCell>Admin</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

---

### DropdownMenu

**Archivo:** `src/components/ui/dropdown-menu.tsx`

Menú desplegable con opciones.

#### Subcomponentes

| Componente | Descripción |
|------------|-------------|
| `DropdownMenu` | Contenedor principal |
| `DropdownMenuTrigger` | Elemento que abre el menú |
| `DropdownMenuContent` | Contenido del menú |
| `DropdownMenuItem` | Item seleccionable |
| `DropdownMenuCheckboxItem` | Item con checkbox |
| `DropdownMenuRadioItem` | Item con radio |
| `DropdownMenuLabel` | Label no seleccionable |
| `DropdownMenuSeparator` | Separador |
| `DropdownMenuShortcut` | Atajo de teclado |
| `DropdownMenuGroup` | Grupo de items |
| `DropdownMenuSub` | Submenú |

#### Uso

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button>Menú</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Perfil</DropdownMenuItem>
    <DropdownMenuItem>Configuración</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Cerrar Sesión</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

### Form

**Archivo:** `src/components/ui/form.tsx`

Integración de React Hook Form con componentes UI.

#### Contextos y Hooks

| Nombre | Descripción |
|--------|-------------|
| `Form` | Contenedor de formulario |
| `FormField` | Campo de formulario con contexto |
| `FormItem` | Item de formulario |
| `FormLabel` | Label del campo |
| `FormControl` | Control del input |
| `FormDescription` | Descripción del campo |
| `FormMessage` | Mensaje de error |
| `useFormField` | Hook para acceder al contexto |

#### Uso

```tsx
const form = useForm({
  resolver: zodResolver(formSchema),
});

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="username"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Username</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormDescription>Tu nombre de usuario</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
    <Button type="submit">Submit</Button>
  </form>
</Form>
```

---

### Toast / Toaster

**Archivos:**
- `src/components/ui/toast.tsx`
- `src/components/ui/toaster.tsx`

Sistema de notificaciones.

#### Hook

```tsx
const { toast } = useToast();
```

#### Uso

```tsx
toast({
  title: "Éxito",
  description: "Operación completada",
});

toast({
  title: "Error",
  description: "Algo salió mal",
  variant: "destructive",
});
```

#### Variantes

| Variante | Uso |
|----------|-----|
| `default` | Notificación normal |
| `destructive` | Errores o acciones críticas |

---

### Tooltip

**Archivo:** `src/components/ui/tooltip.tsx`

Tooltip informativo al hacer hover.

#### Uso

```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button>Hover me</Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Información adicional</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

## Utilidades

### cn() - Class Name Utils

**Archivo:** `src/lib/utils.ts`

Función para combinar clases CSS condicionalmente.

```tsx
import { cn } from "@/lib/utils";

// Uso básico
className={cn("base-class", conditional && "conditional-class")}

// Con variantes
className={cn(
  "btn",
  variant === "primary" && "btn-primary",
  variant === "secondary" && "btn-secondary",
  isLoading && "btn-loading"
)}
```

Combina:
- `clsx` - Condicionales de clases
- `tailwind-merge` - Resolución de conflictos Tailwind
