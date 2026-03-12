import { useState } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxCreateNew,
} from "@/components/kibo-ui/combobox";
import {
  CalendarBody,
  CalendarDate,
  CalendarDatePagination,
  CalendarDatePicker,
  CalendarHeader,
  CalendarItem,
  CalendarMonthPicker,
  CalendarProvider,
  CalendarYearPicker,
} from "@/components/kibo-ui/calendar";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  ListGroup,
  ListHeader,
  ListItem,
  ListItems,
  ListProvider,
} from "@/components/kibo-ui/list";
import type { ColumnDef } from "@/components/kibo-ui/table";
import {
  TableBody,
  TableCell,
  TableColumnHeader,
  TableHead,
  TableHeader,
  TableHeaderGroup,
  TableProvider,
  TableRow,
} from "@/components/kibo-ui/table";
import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from "@/components/kibo-ui/kanban";
import {
  GanttCreateMarkerTrigger,
  GanttFeatureItem,
  GanttFeatureList,
  GanttFeatureListGroup,
  GanttHeader,
  GanttMarker,
  GanttProvider,
  GanttSidebar,
  GanttSidebarGroup,
  GanttSidebarItem,
  GanttTimeline,
  GanttToday,
} from "@/components/kibo-ui/gantt";
import {
  CodeBlock,
  CodeBlockBody,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockFiles,
  CodeBlockHeader,
  CodeBlockItem,
  CodeBlockSelect,
  CodeBlockSelectContent,
  CodeBlockSelectItem,
  CodeBlockSelectTrigger,
  CodeBlockSelectValue,
} from "@/components/kibo-ui/code-block";
import type { BundledLanguage } from "@/components/kibo-ui/code-block";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  CalendarIcon,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  Copy,
  EyeIcon,
  GanttChartSquareIcon,
  Layers,
  LinkIcon,
  ListIcon,
  MoreHorizontal,
  Search,
  TableIcon,
  Terminal,
  TrashIcon,
  Zap,
} from "lucide-react";

// ==========================================
// DATOS DE EJEMPLO
// ==========================================
const frameworks = [
  { value: "next.js", label: "Next.js", description: "Framework React para producción" },
  { value: "sveltekit", label: "SvelteKit", description: "Desarrollo web simplificado" },
  { value: "nuxt.js", label: "Nuxt.js", description: "El framework intuitivo de Vue" },
  { value: "remix", label: "Remix", description: "Framework web full stack" },
  { value: "astro", label: "Astro", description: "Construye sitios más rápidos" },
  { value: "vite", label: "Vite", description: "Tooling frontend de nueva generación" },
];

const medicamentos = [
  { value: "paracetamol", label: "Paracetamol 500mg", categoria: "Analgésico" },
  { value: "ibuprofeno", label: "Ibuprofeno 400mg", categoria: "Antiinflamatorio" },
  { value: "amoxicilina", label: "Amoxicilina 500mg", categoria: "Antibiótico" },
  { value: "omeprazol", label: "Omeprazol 20mg", categoria: "Gastroprotector" },
  { value: "loratadina", label: "Loratadina 10mg", categoria: "Antihistamínico" },
  { value: "metformina", label: "Metformina 850mg", categoria: "Antidiabético" },
];

// Datos de tareas para Roadmap
const hoy = new Date();
const estados = [
  { id: "1", name: "Pendiente", color: "#f59e0b" },
  { id: "2", name: "En Progreso", color: "#3b82f6" },
  { id: "3", name: "Completado", color: "#22c55e" },
];

const usuarios = [
  { id: "1", nombre: "Ana García", iniciales: "AG", imagen: "" },
  { id: "2", nombre: "Carlos López", iniciales: "CL", imagen: "" },
  { id: "3", nombre: "María Rodríguez", iniciales: "MR", imagen: "" },
  { id: "4", nombre: "Juan Martínez", iniciales: "JM", imagen: "" },
];

const grupos = [
  { id: "1", nombre: "Sistema de Inventario" },
  { id: "2", nombre: "Módulo de Ventas" },
  { id: "3", nombre: "Reportes y Análisis" },
];

// Fechas cercanas a hoy para mejor visualización en el Gantt
const crearFechaCercana = (diasOffset: number) => {
  const fecha = new Date(hoy);
  fecha.setDate(hoy.getDate() + diasOffset);
  return fecha;
};

const tareasDemo = [
  {
    id: "tarea-1",
    nombre: "Diseñar interfaz de usuario",
    inicio: crearFechaCercana(-3),
    fin: crearFechaCercana(2),
    estado: estados[1], // En Progreso
    usuario: usuarios[0],
    grupo: grupos[0],
  },
  {
    id: "tarea-2",
    nombre: "Implementar API REST",
    inicio: crearFechaCercana(-1),
    fin: crearFechaCercana(4),
    estado: estados[1], // En Progreso
    usuario: usuarios[1],
    grupo: grupos[0],
  },
  {
    id: "tarea-3",
    nombre: "Configurar base de datos",
    inicio: crearFechaCercana(-5),
    fin: crearFechaCercana(-1),
    estado: estados[2], // Completado
    usuario: usuarios[2],
    grupo: grupos[0],
  },
  {
    id: "tarea-4",
    nombre: "Crear módulo de autenticación",
    inicio: crearFechaCercana(1),
    fin: crearFechaCercana(6),
    estado: estados[0], // Pendiente
    usuario: usuarios[3],
    grupo: grupos[1],
  },
  {
    id: "tarea-5",
    nombre: "Desarrollar reportes de ventas",
    inicio: crearFechaCercana(3),
    fin: crearFechaCercana(8),
    estado: estados[0], // Pendiente
    usuario: usuarios[0],
    grupo: grupos[1],
  },
  {
    id: "tarea-6",
    nombre: "Integrar pasarela de pagos",
    inicio: crearFechaCercana(0),
    fin: crearFechaCercana(5),
    estado: estados[1], // En Progreso
    usuario: usuarios[1],
    grupo: grupos[1],
  },
  {
    id: "tarea-7",
    nombre: "Optimizar consultas SQL",
    inicio: crearFechaCercana(-2),
    fin: crearFechaCercana(1),
    estado: estados[2], // Completado
    usuario: usuarios[2],
    grupo: grupos[2],
  },
  {
    id: "tarea-8",
    nombre: "Documentar API endpoints",
    inicio: crearFechaCercana(5),
    fin: crearFechaCercana(10),
    estado: estados[0], // Pendiente
    usuario: usuarios[3],
    grupo: grupos[2],
  },
];

// Código de ejemplo para CodeBlock - solo TSX
const ejemplosCodigo = [
  {
    language: "tsx",
    filename: "Combobox.tsx",
    code: `import { useState } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxItem,
  ComboboxTrigger,
} from "@/components/kibo-ui/combobox";

interface Opcion {
  value: string;
  label: string;
}

interface EjemploComboboxProps {
  opciones: Opcion[];
}

export function EjemploCombobox({ opciones }: EjemploComboboxProps) {
  const [valor, setValor] = useState<string>("");

  return (
    <Combobox
      data={opciones}
      value={valor}
      onValueChange={setValor}
      type="framework"
    >
      <ComboboxTrigger placeholder="Seleccionar..." />
      <ComboboxContent>
        {opciones.map((opcion) => (
          <ComboboxItem key={opcion.value} value={opcion.value}>
            {opcion.label}
          </ComboboxItem>
        ))}
      </ComboboxContent>
    </Combobox>
  );
}`,
  },
];

// ==========================================
// COMPONENTES DE EJEMPLO
// ==========================================
const EjemploComboboxBasico = () => (
  <div className="space-y-4">
    <p className="text-sm text-muted-foreground">
      Selección con búsqueda integrada. Ideal para listas extensas.
    </p>
    <Combobox data={frameworks} type="framework">
      <ComboboxTrigger className="w-full" />
      <ComboboxContent className="w-[320px]">
        <ComboboxInput placeholder="Buscar framework..." />
        <ComboboxEmpty className="py-4 text-sm text-center">
          <Search className="mx-auto h-5 w-5 text-muted-foreground/50 mb-2" />
          No se encontró el framework.
        </ComboboxEmpty>
        <ComboboxList>
          <ComboboxGroup>
            {frameworks.map((fw) => (
              <ComboboxItem key={fw.value} value={fw.value}>
                <div className="flex flex-col">
                  <span>{fw.label}</span>
                  <span className="text-xs text-muted-foreground">{fw.description}</span>
                </div>
              </ComboboxItem>
            ))}
          </ComboboxGroup>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  </div>
);

const EjemploComboboxControlado = () => {
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState(medicamentos[0].value);
  const medicamentoSeleccionado = medicamentos.find((m) => m.value === valor);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Seleccionado:</span>
        <Badge variant="secondary" className="font-mono">{valor}</Badge>
      </div>
      <Combobox
        data={medicamentos}
        open={abierto}
        onOpenChange={setAbierto}
        value={valor}
        onValueChange={setValor}
        type="medication"
      >
        <ComboboxTrigger className="w-full" />
        <ComboboxContent className="w-[320px]">
          <ComboboxInput placeholder="Buscar medicamento..." />
          <ComboboxEmpty>No se encontró el medicamento.</ComboboxEmpty>
          <ComboboxList>
            <ComboboxGroup>
              {medicamentos.map((med) => (
                <ComboboxItem key={med.value} value={med.value}>
                  <div className="flex items-center justify-between w-full">
                    <span>{med.label}</span>
                    <Badge variant="outline" className="text-xs">{med.categoria}</Badge>
                  </div>
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {medicamentoSeleccionado && (
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="font-medium">{medicamentoSeleccionado.label}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 ml-6">{medicamentoSeleccionado.categoria}</p>
        </div>
      )}
    </div>
  );
};

const EjemploComboboxCrear = () => {
  const [items, setItems] = useState(frameworks);
  const [valor, setValor] = useState("");

  const handleCrearNuevo = (nuevoValor: string) => {
    const nuevoItem = {
      value: nuevoValor.toLowerCase().replace(/\s+/g, "-"),
      label: nuevoValor,
      description: "Framework personalizado",
    };
    setItems((prev) => [...prev, nuevoItem]);
    setValor(nuevoItem.value);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Permite crear nuevos items si no existe la opción deseada.
      </p>
      <Combobox data={items} value={valor} onValueChange={setValor} type="framework">
        <ComboboxTrigger className="w-full" />
        <ComboboxContent className="w-[320px]">
          <ComboboxInput placeholder="Buscar o crear..." />
          <ComboboxEmpty>
            <ComboboxCreateNew onCreateNew={handleCrearNuevo} />
          </ComboboxEmpty>
          <ComboboxList>
            <ComboboxGroup>
              {items.map((item) => (
                <ComboboxItem key={item.value} value={item.value}>
                  {item.label}
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
};

// Ejemplos de Roadmap
const EjemploCalendario = () => {
  const anioInicio = hoy.getFullYear();
  const anioFin = anioInicio + 1;

  return (
    <div className="h-[420px] border rounded-xl overflow-hidden bg-card p-6">
      <CalendarProvider>
        <CalendarDate>
          <CalendarDatePicker>
            <CalendarMonthPicker />
            <CalendarYearPicker start={anioInicio} end={anioFin} />
          </CalendarDatePicker>
          <CalendarDatePagination />
        </CalendarDate>
        <CalendarHeader />
        <CalendarBody
          features={tareasDemo.map((t) => ({
            id: t.id,
            name: t.nombre,
            startAt: t.inicio,
            endAt: t.fin,
            status: t.estado,
          }))}
        >
          {({ feature }) => <CalendarItem feature={feature} key={feature.id} />}
        </CalendarBody>
      </CalendarProvider>
    </div>
  );
};

const EjemploLista = () => {
  const [tareas, setTareas] = useState(tareasDemo);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const estado = estados.find((s) => s.name === over.id);
    if (!estado) return;
    setTareas(tareas.map((t) => (t.id === active.id ? { ...t, estado } : t)));
  };

  return (
    <div className="h-[420px] border rounded-xl overflow-hidden bg-card p-6">
      <ListProvider className="h-full overflow-auto" onDragEnd={handleDragEnd}>
        {estados.map((estado) => (
          <ListGroup id={estado.name} key={estado.name}>
            <ListHeader color={estado.color} name={estado.name} />
            <ListItems>
              {tareas
                .filter((t) => t.estado.name === estado.name)
                .map((tarea, index) => (
                  <ListItem
                    id={tarea.id}
                    index={index}
                    key={tarea.id}
                    name={tarea.nombre}
                    parent={tarea.estado.name}
                  >
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background"
                      style={{ backgroundColor: tarea.estado.color }}
                    />
                    <p className="m-0 flex-1 font-medium text-sm">{tarea.nombre}</p>
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarImage src={tarea.usuario.imagen} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {tarea.usuario.iniciales}
                      </AvatarFallback>
                    </Avatar>
                  </ListItem>
                ))}
            </ListItems>
          </ListGroup>
        ))}
      </ListProvider>
    </div>
  );
};

const formatoCortoFecha = new Intl.DateTimeFormat("es-ES", {
  month: "short",
  day: "numeric",
});

const formatoFechaCompleta = new Intl.DateTimeFormat("es-ES", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const EjemploGantt = () => {
  const [tareas, setTareas] = useState(tareasDemo);

  const tareasPorGrupo = tareas.reduce((acc, tarea) => {
    const grupo = tarea.grupo.nombre;
    if (!acc[grupo]) acc[grupo] = [];
    acc[grupo].push(tarea);
    return acc;
  }, {} as Record<string, typeof tareas>);

  const handleVerTarea = (id: string) => console.log(`Ver tarea: ${id}`);
  const handleCopiarEnlace = (id: string) => console.log(`Copiar enlace: ${id}`);
  const handleEliminarTarea = (id: string) =>
    setTareas((prev) => prev.filter((t) => t.id !== id));
  const handleEliminarMarcador = (id: string) => console.log(`Eliminar marcador: ${id}`);
  const handleCrearMarcador = (fecha: Date) =>
    console.log(`Crear marcador: ${fecha.toISOString()}`);
  const handleMoverTarea = (id: string, inicio: Date, fin: Date | null) => {
    if (!fin) return;
    setTareas((prev) =>
      prev.map((t) => (t.id === id ? { ...t, inicio, fin } : t))
    );
    console.log(`Mover tarea: ${id} de ${inicio} a ${fin}`);
  };
  const handleAgregarTarea = (fecha: Date) =>
    console.log(`Agregar tarea: ${fecha.toISOString()}`);

  const marcadoresDemo = [
    { id: "m1", fecha: new Date(hoy.getTime() + 2 * 24 * 60 * 60 * 1000), etiqueta: "Lanzamiento v1.0" },
    { id: "m2", fecha: new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000), etiqueta: "Revisión" },
    { id: "m3", fecha: new Date(hoy.getTime() + 14 * 24 * 60 * 60 * 1000), etiqueta: "Entrega" },
  ];

  return (
    <div className="h-[500px] rounded-xl overflow-hidden bg-card border shadow-sm">
      <GanttProvider
        className="rounded-none h-full"
        onAddItem={handleAgregarTarea}
        range="monthly"
        zoom={100}
      >
        <GanttSidebar>
          {Object.entries(tareasPorGrupo).map(([grupo, lista]) => (
            <GanttSidebarGroup key={grupo} name={grupo}>
              {lista.map((tarea) => (
                <GanttSidebarItem
                  feature={{
                    id: tarea.id,
                    name: tarea.nombre,
                    startAt: tarea.inicio,
                    endAt: tarea.fin,
                    status: tarea.estado,
                  }}
                  key={tarea.id}
                  onSelectItem={handleVerTarea}
                />
              ))}
            </GanttSidebarGroup>
          ))}
        </GanttSidebar>
        <GanttTimeline>
          <GanttHeader />
          <GanttFeatureList>
            {Object.entries(tareasPorGrupo).map(([grupo, lista]) => (
              <GanttFeatureListGroup key={grupo}>
                {lista.map((tarea) => (
                  <div className="flex" key={tarea.id}>
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <button
                          onClick={() => handleVerTarea(tarea.id)}
                          type="button"
                          className="flex-1"
                        >
                          <GanttFeatureItem
                            onMove={handleMoverTarea}
                            id={tarea.id}
                            name={tarea.nombre}
                            startAt={tarea.inicio}
                            endAt={tarea.fin}
                            status={tarea.estado}
                          >
                            <p className="flex-1 truncate text-xs">{tarea.nombre}</p>
                            <Avatar className="h-4 w-4">
                              <AvatarImage src={tarea.usuario.imagen} />
                              <AvatarFallback className="text-[8px]">
                                {tarea.usuario.iniciales}
                              </AvatarFallback>
                            </Avatar>
                          </GanttFeatureItem>
                        </button>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem
                          className="flex items-center gap-2"
                          onClick={() => handleVerTarea(tarea.id)}
                        >
                          <EyeIcon className="text-muted-foreground" size={16} />
                          Ver tarea
                        </ContextMenuItem>
                        <ContextMenuItem
                          className="flex items-center gap-2"
                          onClick={() => handleCopiarEnlace(tarea.id)}
                        >
                          <LinkIcon className="text-muted-foreground" size={16} />
                          Copiar enlace
                        </ContextMenuItem>
                        <ContextMenuItem
                          className="flex items-center gap-2 text-destructive"
                          onClick={() => handleEliminarTarea(tarea.id)}
                        >
                          <TrashIcon size={16} />
                          Eliminar del roadmap
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  </div>
                ))}
              </GanttFeatureListGroup>
            ))}
          </GanttFeatureList>
          {marcadoresDemo.map((marcador) => (
            <GanttMarker
              key={marcador.id}
              id={marcador.id}
              date={marcador.fecha}
              label={marcador.etiqueta}
              className="bg-primary/20 text-primary border-primary/30"
              onRemove={handleEliminarMarcador}
            />
          ))}
          <GanttToday />
          <GanttCreateMarkerTrigger onCreateMarker={handleCrearMarcador} />
        </GanttTimeline>
      </GanttProvider>
    </div>
  );
};

const EjemploKanban = () => {
  const [tareas, setTareas] = useState(
    tareasDemo.map((t) => ({ ...t, column: t.estado.name, name: t.nombre }))
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const idDestino = over.id as string;
    const idActivo = active.id as string;

    const columnaDestino = estados.find((s) => s.name === idDestino);
    const tareaDestino = tareas.find((t) => t.id === idDestino);

    let columnaTarget: string | null = null;
    if (columnaDestino) columnaTarget = columnaDestino.name;
    else if (tareaDestino) columnaTarget = tareaDestino.column;

    if (!columnaTarget) return;

    setTareas((prev) =>
      prev.map((t) =>
        t.id === idActivo
          ? { ...t, column: columnaTarget, estado: estados.find((s) => s.name === columnaTarget) || t.estado }
          : t
      )
    );
  };

  const columnasKanban = estados.map((s) => ({ id: s.name, name: s.name }));

  return (
    <div className="h-[500px] rounded-xl overflow-hidden bg-background border shadow-sm">
      <KanbanProvider
        className="p-4 gap-4 h-full overflow-x-auto bg-muted/10"
        columns={columnasKanban}
        data={tareas}
        onDragEnd={handleDragEnd}
      >
        {(columna) => {
          const tareasColumna = tareas.filter((t) => t.column === columna.name);
          const estado = estados.find((s) => s.name === columna.name);

          return (
            <KanbanBoard
              id={columna.name}
              key={columna.name}
              className="w-[300px] shrink-0 rounded-xl border border-border/60 flex flex-col h-full max-h-full overflow-hidden bg-card"
            >
              <KanbanHeader className="flex items-center justify-between px-4 py-3.5 border-b border-border/50 shrink-0 bg-muted/30">
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-2.5 w-2.5 rounded-full ring-2 ring-background"
                    style={{ backgroundColor: estado?.color }}
                  />
                  <span className="font-semibold text-sm">{columna.name}</span>
                  <Badge variant="secondary" className="text-xs font-medium px-2 py-0 h-5 bg-primary/10 text-primary border-0">
                    {tareasColumna.length}
                  </Badge>
                </div>
                <button
                  type="button"
                  title="Más opciones"
                  className="text-muted-foreground/70 hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </KanbanHeader>
              <div className="flex-1 overflow-hidden p-3 bg-muted/10">
                <KanbanCards id={columna.name} className="h-full overflow-y-auto space-y-2.5">
                  {(tarea: (typeof tareas)[number]) => (
                    <KanbanCard
                      column={tarea.column}
                      id={tarea.id}
                      key={tarea.id}
                      name={tarea.nombre}
                      className="rounded-xl p-3.5 group cursor-grab active:cursor-grabbing border border-border/40 hover:border-primary/40 hover:shadow-lg transition-all duration-200 bg-background"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <p className="m-0 flex-1 font-medium text-sm leading-relaxed line-clamp-2 text-foreground">
                          {tarea.nombre}
                        </p>
                        <Avatar className="h-6 w-6 shrink-0 ring-2 ring-background">
                          <AvatarImage src={tarea.usuario.imagen} />
                          <AvatarFallback className="text-[10px] font-medium bg-primary/10 text-primary">
                            {tarea.usuario.iniciales}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 font-normal border-border/50 text-muted-foreground mb-3">
                        {tarea.grupo.nombre}
                      </Badge>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatoCortoFecha.format(tarea.fin)}</span>
                        </div>
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: tarea.estado.color }}
                        />
                      </div>
                    </KanbanCard>
                  )}
                </KanbanCards>
              </div>
            </KanbanBoard>
          );
        }}
      </KanbanProvider>
    </div>
  );
};

const EjemploTabla = () => {
  const columnas: ColumnDef<(typeof tareasDemo)[number]>[] = [
    {
      accessorKey: "nombre",
      header: ({ column }) => <TableColumnHeader column={column} title="Nombre" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-8 w-8">
              <AvatarImage src={row.original.usuario.imagen} />
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {row.original.usuario.iniciales}
              </AvatarFallback>
            </Avatar>
            <div
              className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full ring-2 ring-background"
              style={{ backgroundColor: row.original.estado.color }}
            />
          </div>
          <div className="flex flex-col">
            <span className="font-medium text-sm">{row.original.nombre}</span>
            <span className="text-xs text-muted-foreground">{row.original.grupo.nombre}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "inicio",
      header: ({ column }) => <TableColumnHeader column={column} title="Inicio" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.inicio.toLocaleDateString("es-ES")}
        </span>
      ),
    },
    {
      accessorKey: "fin",
      header: ({ column }) => <TableColumnHeader column={column} title="Fin" />,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.fin.toLocaleDateString("es-ES")}
        </span>
      ),
    },
    {
      accessorKey: "estado",
      header: ({ column }) => <TableColumnHeader column={column} title="Estado" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: row.original.estado.color }}
          />
          <span className="text-sm">{row.original.estado.name}</span>
        </div>
      ),
    },
  ];

  return (
    <div className="h-[420px] border rounded-xl overflow-hidden bg-card p-6">
      <TableProvider columns={columnas} data={tareasDemo}>
        <TableHeader>
          {({ headerGroup }) => (
            <TableHeaderGroup headerGroup={headerGroup} key={headerGroup.id}>
              {({ header }) => <TableHead header={header} key={header.id} />}
            </TableHeaderGroup>
          )}
        </TableHeader>
        <TableBody>
          {({ row }) => (
            <TableRow key={row.id} row={row}>
              {({ cell }) => <TableCell cell={cell} key={cell.id} />}
            </TableRow>
          )}
        </TableBody>
      </TableProvider>
    </div>
  );
};

// ==========================================
// PÁGINA PRINCIPAL
// ==========================================
export default function DemoComponents() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative border-b bg-gradient-to-br from-background via-background to-muted/30">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="relative max-w-7xl mx-auto px-6 py-16">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <Zap className="h-3.5 w-3.5" />
              <span>Biblioteca Kibo UI</span>
            </div>
            <Badge variant="outline" className="text-xs">v1.0</Badge>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            Galería de Componentes
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Colección de componentes avanzados para construir interfaces modernas.
            Cada componente está diseñado con atención al detalle.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">
            {[
              { icon: Layers, label: "Componentes", value: "7+" },
              { icon: Terminal, label: "TypeScript", value: "100%" },
              { icon: Code2, label: "Ejemplos", value: "20+" },
              { icon: CheckCircle2, label: "Accesible", value: "WCAG" },
            ].map((stat, i) => (
              <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-card border shadow-sm">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-16">
        {/* Code Block */}
        <section className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-primary text-primary-foreground">Nuevo</Badge>
                <h2 className="text-2xl font-semibold tracking-tight">Bloque de Código</h2>
              </div>
              <p className="text-muted-foreground max-w-2xl">
                Resaltado de sintaxis con números de línea, selección de archivos y copiado al portapapeles.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
              <CodeBlock
                data={ejemplosCodigo}
                defaultValue={ejemplosCodigo[0].language}
              >
                <CodeBlockHeader className="bg-muted/50 border-b px-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Terminal className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Combobox.tsx</span>
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5">TSX</Badge>
                  </div>
                  <CodeBlockCopyButton
                    className="h-8 w-8 ml-auto"
                    onCopy={() => console.log("Copiado")}
                    onError={() => console.error("Error al copiar")}
                  />
                </CodeBlockHeader>
                <CodeBlockBody>
                  {(item) => (
                    <CodeBlockItem key={item.language} value={item.language}>
                      <CodeBlockContent language={item.language as BundledLanguage}>
                        {item.code}
                      </CodeBlockContent>
                    </CodeBlockItem>
                  )}
                </CodeBlockBody>
              </CodeBlock>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Code2, title: "Syntax Highlighting", desc: "Múltiples lenguajes soportados" },
                  { icon: Copy, title: "Copiar al Portapapeles", desc: "Botón integrado para copiar" },
                  { icon: Layers, title: "Pestañas de Archivos", desc: "Navegación entre archivos" },
                  { icon: Terminal, title: "Números de Línea", desc: "Referencia de líneas opcional" },
                ].map((feat, i) => (
                  <div key={i} className="p-4 rounded-xl border bg-card">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{feat.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{feat.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Combobox */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight mb-2">Combobox</h2>
            <p className="text-muted-foreground max-w-2xl">
              Input de autocompletado avanzado con búsqueda, selección y creación de items.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-muted/30">
                <h3 className="font-semibold flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  Básico
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Selección simple con búsqueda</p>
              </div>
              <div className="p-4">
                <EjemploComboboxBasico />
              </div>
            </div>

            <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-muted/30">
                <h3 className="font-semibold flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                  Controlado
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Estado externo con useState</p>
              </div>
              <div className="p-4">
                <EjemploComboboxControlado />
              </div>
            </div>

            <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-muted/30">
                <h3 className="font-semibold flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary/70" />
                  Crear Nuevo
                </h3>
                <p className="text-sm text-muted-foreground mt-1">Agregar items dinámicamente</p>
              </div>
              <div className="p-4">
                <EjemploComboboxCrear />
              </div>
            </div>
          </div>
        </section>

        {/* Roadmap - Múltiples Vistas */}
        <section className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">Roadmap</Badge>
                <h2 className="text-2xl font-semibold tracking-tight">Gestión de Proyectos</h2>
              </div>
              <p className="text-muted-foreground max-w-2xl">
                Sistema completo con 5 vistas diferentes. Cada vista está optimizada para diferentes contextos de uso.
              </p>
            </div>
          </div>

          <Tabs defaultValue="gantt" className="w-full">
            <TabsList className="w-full lg:w-auto grid grid-cols-5 gap-1 p-1 bg-muted/50 rounded-xl">
              <TabsTrigger value="gantt" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <GanttChartSquareIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Gantt</span>
              </TabsTrigger>
              <TabsTrigger value="calendario" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <CalendarIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Calendario</span>
              </TabsTrigger>
              <TabsTrigger value="lista" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <ListIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Lista</span>
              </TabsTrigger>
              <TabsTrigger value="kanban" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Layers className="h-4 w-4" />
                <span className="hidden sm:inline">Kanban</span>
              </TabsTrigger>
              <TabsTrigger value="tabla" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <TableIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Tabla</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="gantt" className="mt-6 space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ChevronRight className="h-4 w-4" />
                <span>Vista de diagrama de Gantt con timeline interactivo y marcadores.</span>
              </div>
              <EjemploGantt />
            </TabsContent>

            <TabsContent value="calendario" className="mt-6 space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ChevronRight className="h-4 w-4" />
                <span>Vista mensual con navegación por mes y año.</span>
              </div>
              <EjemploCalendario />
            </TabsContent>

            <TabsContent value="lista" className="mt-6 space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ChevronRight className="h-4 w-4" />
                <span>Lista organizada por estados con drag and drop.</span>
              </div>
              <EjemploLista />
            </TabsContent>

            <TabsContent value="kanban" className="mt-6 space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ChevronRight className="h-4 w-4" />
                <span>Tablero Kanban con columnas configurables. Arrastra tarjetas entre columnas.</span>
              </div>
              <EjemploKanban />
            </TabsContent>

            <TabsContent value="tabla" className="mt-6 space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ChevronRight className="h-4 w-4" />
                <span>Tabla ordenable con todas las propiedades.</span>
              </div>
              <EjemploTabla />
            </TabsContent>
          </Tabs>
        </section>

        {/* Grid de Componentes */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight">Todos los Componentes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: "Combobox", description: "Input de autocompletado con lista de sugerencias", icon: Search, status: "stable" },
              { name: "Code Block", description: "Bloques de código con syntax highlighting", icon: Code2, status: "new" },
              { name: "Calendar", description: "Vista de calendario con navegación mensual", icon: CalendarIcon, status: "stable" },
              { name: "Gantt", description: "Diagrama de Gantt con timeline interactivo", icon: GanttChartSquareIcon, status: "stable" },
              { name: "Kanban", description: "Tablero tipo Trello con drag and drop", icon: Layers, status: "stable" },
              { name: "List", description: "Lista organizada con agrupación", icon: ListIcon, status: "stable" },
              { name: "Table", description: "Tabla avanzada con ordenamiento", icon: TableIcon, status: "stable" },
            ].map((component) => (
              <div
                key={component.name}
                className="group p-4 rounded-xl border bg-card hover:border-primary/50 hover:shadow-md transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <component.icon className="h-5 w-5 text-primary" />
                  </div>
                  {component.status === "new" && (
                    <Badge className="bg-primary text-primary-foreground text-[10px]">Nuevo</Badge>
                  )}
                </div>
                <h3 className="font-semibold mb-1">{component.name}</h3>
                <p className="text-sm text-muted-foreground">{component.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
