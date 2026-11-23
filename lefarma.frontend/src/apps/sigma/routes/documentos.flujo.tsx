import React, { useCallback, useEffect, useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/apps/sigma/components/app-sidebar";
import { Navbar } from "@/apps/sigma/components/navbar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from "@/apps/sigma/components/ui/kanban";
import {
  Upload,
  FileText,
  UploadCloud,
  Files,
  X,
  FileSpreadsheet,
  Eye,
  Send,
  Users,
  CheckCircle,
  Clock,
  RefreshCw,
  Loader2,
  Check,
  Workflow as WorkflowIcon,
  MessageSquare,
} from "lucide-react";
import * as XLSX from "xlsx";
import { auth } from "@/apps/sigma/lib/auth";
import { sigmaAuth, useSigmaAuth } from "@/apps/sigma/store/sigmaAuth";
import { DataTable } from "@/apps/sigma/components/documents/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Spinner } from "@/apps/sigma/components/ui/spinner";
import { PDFPreviewDialog } from "@/apps/sigma/components/documents/pdf-preview-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  TooltipProvider,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  MarkerType,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Position,
  type Connection,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
} from "reactflow";
import "reactflow/dist/style.css";
import { Dropzone, DropzoneContent, DropzoneEmptyState } from "@/apps/sigma/components/ui/shadcn-io/dropzone";
import { API_BASE_URL, del, get, post, postForm } from "@/apps/sigma/lib/httpClient";
import { type Document } from "@/apps/sigma/lib/documents";

interface Usuario {
  usuario: string;
  nombreCompleto: string;
  tieneFirma: boolean;
  identificadorFirma?: string;
  pathFirma?: string;
}

interface DocumentoAdjunto {
  idDocumento: string;
  nombreArchivo: string;
  rutaArchivoInicial?: string;
  rutaArchivoFirmado?: string | null;
  tipoDocumento: "Principal" | "Complemento" | string;
  esPrincipal?: boolean;
  tamanoBytes?: number | null;
  hashSHA256?: string | null;
}

interface DocumentoFlujo {
  idGrupo: string;
  idDocumento: string;
  nombreArchivo: string;
  creadoPor: string;
  nombreCreadoPor?: string;
  fechaSubida: string;
  fechaUltimaInteraccion?: string | null;
  estatusFlujo: "EnProgreso" | "Completado" | "Rechazado";
  pasoActual: number;
  totalPasos: number;
  nombrePasoActual?: string | null;
  nombreUsuarioActual?: string | null;
  diasSinFirmar: number;
  alertaColor: "ninguna" | "amarilla" | "roja";
  documentos: DocumentoAdjunto[];
}

interface PasoFlujo {
  orden: number;
  usuarioAprobador: string;
  estatus: "Pendiente" | "Aprobado" | "Rechazado";
  fechaFirma: string | null;
  motivoRechazo: string | null;
}

interface RawDocumentoAdjunto {
  IdDocumento?: string;
  idDocumento?: string;
  NombreArchivo?: string;
  nombreArchivo?: string;
  RutaArchivoInicial?: string;
  rutaArchivoInicial?: string;
  RutaArchivoFirmado?: string | null;
  rutaArchivoFirmado?: string | null;
  TipoDocumento?: string;
  tipoDocumento?: string;
  EsPrincipal?: boolean | string;
  esPrincipal?: boolean | string;
  TamanoBytes?: number | null;
  tamanoBytes?: number | null;
  HashSHA256?: string | null;
  hashSHA256?: string | null;
}

interface RawDocumentoGrupo {
  idGrupo?: string;
  IdGrupo?: string;
  idDocumento?: string;
  IdDocumento?: string;
  nombreArchivo?: string;
  NombreArchivo?: string;
  creadoPor?: string;
  CreadoPor?: string;
  nombreCreadoPor?: string;
  NombreCreadoPor?: string;
  fechaSubida?: string;
  FechaSubida?: string;
  fechaCreacion?: string;
  FechaCreacion?: string;
  fechaUltimaInteraccion?: string | null;
  FechaUltimaInteraccion?: string | null;
  estatusFlujo?: string;
  EstatusFlujo?: string;
  pasosCompletados?: number;
  PasosCompletados?: number;
  pasoActual?: number;
  PasoActual?: number;
  orden?: number;
  totalPasos?: number;
  TotalPasos?: number;
  nombrePasoActual?: string | null;
  NombrePasoActual?: string | null;
  nombreUsuarioActual?: string | null;
  NombreUsuarioActual?: string | null;
  diasSinFirmar?: number;
  DiasSinFirmar?: number;
  alertaColor?: string;
  AlertaColor?: string;
  colorAlerta?: string;
  Documentos?: unknown;
  documentos?: unknown;
  documentosGrupo?: unknown;
}

interface RawUsuario {
  usuario?: string;
  Usuario?: string;
  Value?: string;
  nombreCompleto?: string;
  NombreCompleto?: string;
  Label?: string;
  tieneFirma?: boolean;
  TieneFirma?: boolean;
  identificadorFirma?: string;
  IdentificadorFirma?: string;
  pathFirma?: string;
  PathFirma?: string;
}

interface RawComentario {
  fecha?: string;
  Fecha?: string;
  usuario?: string;
  Usuario?: string;
  estatus?: string;
  Estatus?: string;
  comentario?: string;
  Comentario?: string;
}

export default function DocumentosFlujo() {
  const { isAuthenticated } = useSigmaAuth();
  const accessToken = sigmaAuth.getToken();
  const [mounted, setMounted] = useState(false);

  const [misDocumentos, setMisDocumentos] = useState<DocumentoFlujo[]>([]);
  const [pendientes, setPendientes] = useState<DocumentoFlujo[]>([]);
  const [firmados, setFirmados] = useState<DocumentoFlujo[]>([]);
  const [todosDocumentos, setTodosDocumentos] = useState<DocumentoFlujo[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

interface WizardFile {
  id: string;
  file: File;
  column: 'Principal' | 'Complemento';
}

const [showUploadDialog, setShowUploadDialog] = useState(false);
const [uploadFiles, setUploadFiles] = useState<WizardFile[]>([]);
const [uploadReason, setUploadReason] = useState("");
const [usuarios, setUsuarios] = useState<Usuario[]>([]);
const [userSearch, setUserSearch] = useState("");
const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
const [wizardStep, setWizardStep] = useState(1);
const [flowBuilderNodes, setFlowBuilderNodes] = useState<Node[]>([]);
const [flowBuilderEdges, setFlowBuilderEdges] = useState<Edge[]>([]);
const [uploadingDocument, setUploadingDocument] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);

const allowMultipleFiles = import.meta.env.VITE_DOCUMENTOS_FLUJO_MODO === 'multiple';

  const [showFlowDialog, setShowFlowDialog] = useState(false);
  const [flowNodes, setFlowNodes] = useNodesState<Node>([]);
  const [flowEdges, setFlowEdges] = useEdgesState<Edge>([]);
  const [flowDocument, setFlowDocument] = useState<DocumentoFlujo | null>(null);
  const [flowSteps, setFlowSteps] = useState<PasoFlujo[]>([]);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [groupDocs, setGroupDocs] = useState<DocumentoAdjunto[]>([]);
  const [groupTitle, setGroupTitle] = useState<string>("");

  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentoFlujo | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveComment, setApproveComment] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
const [showPreview, setShowPreview] = useState(false);
const [loadingDocumentId, setLoadingDocumentId] = useState<string | null>(null);
const [showCommentsDialog, setShowCommentsDialog] = useState(false);
const [commentsHistory, setCommentsHistory] = useState<
  { fecha: string; usuario: string; estatus: string; comentario: string }[]
>([]);
const [loadingComments, setLoadingComments] = useState(false);
const [activeTab, setActiveTab] = useState<"subidos" | "pendientes" | "firmados" | "todos">(
  "pendientes"
);
const [previewDocsGroup, setPreviewDocsGroup] = useState<DocumentoAdjunto[]>([]);
const [previewParentDoc, setPreviewParentDoc] = useState<DocumentoFlujo | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (showUploadDialog) {
      setWizardStep(1);
      setSelectedUsers([]);
      setUploadFiles([]);
      setUploadReason("");
      setFlowBuilderNodes([]);
      setFlowBuilderEdges([]);
      setFlowError(null);
    }
  }, [showUploadDialog]);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const [misDocs, pendientesDocs, firmadosDocs, todosDocs] = await Promise.all([
        get<{ data?: RawDocumentoGrupo[] }>("/v2/documentos/mis-documentos"),
        get<{ data?: RawDocumentoGrupo[] }>("/v2/documentos/pendientes-firmar"),
        get<{ data?: RawDocumentoGrupo[] }>("/v2/documentos/firmados-por-mi"),
        get<{ data?: RawDocumentoGrupo[] }>("/v2/documentos/todos"),
      ]);
      const parseDocumentos = (doc: RawDocumentoGrupo): DocumentoAdjunto[] => {
        const raw = doc?.Documentos ?? doc?.documentos ?? doc?.documentosGrupo;
        if (!raw) return [];
        try {
          const parsed: unknown =
            typeof raw === "string" ? JSON.parse(raw) : raw;
          if (!Array.isArray(parsed)) return [];
          return parsed.map((d: RawDocumentoAdjunto) => ({
            idDocumento: d?.IdDocumento ?? d?.idDocumento ?? "",
            nombreArchivo: d?.NombreArchivo ?? d?.nombreArchivo ?? "",
            rutaArchivoInicial: d?.RutaArchivoInicial ?? d?.rutaArchivoInicial,
            rutaArchivoFirmado: d?.RutaArchivoFirmado ?? d?.rutaArchivoFirmado ?? null,
            tipoDocumento: d?.TipoDocumento ?? d?.tipoDocumento ?? "Principal",
            esPrincipal: Boolean(d?.EsPrincipal ?? d?.esPrincipal ?? d?.esPrincipal === "true"),
            tamanoBytes: d?.TamanoBytes ?? d?.tamanoBytes ?? null,
            hashSHA256: d?.HashSHA256 ?? d?.hashSHA256 ?? null,
          }));
        } catch {
          return [];
        }
      };

      const normalizeDocumento = (doc: RawDocumentoGrupo): DocumentoFlujo => ({
        idGrupo: doc?.idGrupo ?? doc?.IdGrupo ?? "",
        idDocumento: doc?.idDocumento ?? doc?.IdDocumento ?? "",
        nombreArchivo: doc?.nombreArchivo ?? doc?.NombreArchivo ?? "",
        creadoPor: doc?.creadoPor ?? doc?.CreadoPor ?? "",
        nombreCreadoPor: doc?.nombreCreadoPor ?? doc?.NombreCreadoPor ?? doc?.creadoPor ?? "",
        fechaSubida:
          doc?.fechaSubida ??
          doc?.FechaSubida ??
          doc?.fechaCreacion ??
          doc?.FechaCreacion ??
          new Date().toISOString(),
        fechaUltimaInteraccion:
          doc?.fechaUltimaInteraccion ??
          doc?.FechaUltimaInteraccion ??
          null,
        estatusFlujo:
          (doc?.estatusFlujo ??
            doc?.EstatusFlujo ??
            "EnProgreso") as DocumentoFlujo["estatusFlujo"],
        pasoActual:
          doc?.pasosCompletados ??
          doc?.PasosCompletados ??
          doc?.pasoActual ??
          doc?.PasoActual ??
          doc?.orden ??
          0,
        totalPasos:
          doc?.totalPasos ??
          doc?.TotalPasos ??
          doc?.orden ??
          1,
        nombrePasoActual:
          doc?.nombrePasoActual ??
          doc?.NombrePasoActual ??
          doc?.nombreUsuarioActual ??
          doc?.NombreUsuarioActual ??
          null,
        nombreUsuarioActual:
          doc?.nombreUsuarioActual ?? doc?.NombreUsuarioActual ?? null,
        diasSinFirmar: doc?.diasSinFirmar ?? doc?.DiasSinFirmar ?? 0,
        alertaColor:
          (doc?.alertaColor ??
            doc?.AlertaColor ??
            doc?.colorAlerta ??
            "ninguna") as DocumentoFlujo["alertaColor"],
        documentos: parseDocumentos(doc),
      });

      setMisDocumentos(Array.isArray(misDocs?.data) ? misDocs.data.map(normalizeDocumento) : []);
      setPendientes(
        Array.isArray(pendientesDocs?.data) ? pendientesDocs.data.map(normalizeDocumento) : []
      );
      setFirmados(Array.isArray(firmadosDocs?.data) ? firmadosDocs.data.map(normalizeDocumento) : []);
      setTodosDocumentos(
        Array.isArray(todosDocs?.data) ? todosDocs.data.map(normalizeDocumento) : []
      );
    } catch (error) {
      console.error("Error loading documents:", error);
      toast.error("Error al cargar los documentos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadDocuments();
    }
  }, [isAuthenticated, loadDocuments]);

  const loadUsuarios = async () => {
    try {
      const data = await get<{ data?: RawUsuario[] }>(
        "/v2/documentos/usuarios-para-flujo"
      );
      const rawUsers = Array.isArray(data?.data) ? data.data : [];

      const mapped = rawUsers
        .map((u: RawUsuario) => ({
          usuario: u?.usuario ?? u?.Usuario ?? u?.Value ?? "",
          nombreCompleto:
            u?.nombreCompleto ?? u?.NombreCompleto ?? u?.Label ?? u?.usuario ?? "",
          tieneFirma: Boolean(u?.tieneFirma ?? u?.TieneFirma),
          identificadorFirma: u?.identificadorFirma ?? u?.IdentificadorFirma ?? "",
          pathFirma: u?.pathFirma ?? u?.PathFirma ?? "",
        }))
        .filter((u: Usuario) => Boolean(u.usuario));

      setUsuarios(mapped);
    } catch (error) {
      console.error("Error loading usuarios:", error);
      toast.error("Error al cargar la lista de usuarios");
    }
  };

  const toggleUserSelection = (usuario: string) => {
    const user = usuarios.find((u) => u.usuario === usuario);
    if (user && !user.tieneFirma) {
      toast.error(
        "No se puede escoger a este usuario porque aún no ha cargado su firma. Pídele que la suba para continuar."
      );
      return;
    }
    setSelectedUsers((prev) =>
      prev.includes(usuario) ? prev.filter((u) => u !== usuario) : [...prev, usuario]
    );
  };

  const handleWizardNext = () => {
    if (wizardStep === 1) {
      if (uploadFiles.length === 0) {
        toast.error("Selecciona al menos un PDF para continuar");
        return;
      }
      if (!uploadReason.trim()) {
        toast.error("Debes ingresar el motivo de la solicitud");
        return;
      }
      const principalFiles = uploadFiles.filter(f => f.column === 'Principal');
      if (principalFiles.length === 0) {
        toast.error("Debe haber al menos un archivo marcado como 'Principal'");
        return;
      }
      if (!allowMultipleFiles && principalFiles.length > 1) {
        toast.error("En modo simple solo puedes tener un archivo principal (los demás como anexos)");
        return;
      }
    }
    if (wizardStep === 2) {
      if (selectedUsers.length === 0) {
        toast.error("Selecciona al menos un usuario");
        return;
      }
    }
    setWizardStep((step) => Math.min(3, step + 1));
  };

  const handleWizardBack = () => {
    setWizardStep((step) => Math.max(1, step - 1));
  };

  useEffect(() => {
    if (showUploadDialog) {
      setWizardStep(1);
      setSelectedUsers([]);
      setUploadFiles([]);
      setUploadReason("");
      setFlowBuilderNodes([]);
      setFlowBuilderEdges([]);
      setFlowError(null);
    }
  }, [showUploadDialog]);

  useEffect(() => {
    if (wizardStep !== 3) return;
    const nodes: Node[] = selectedUsers.map((usuario, idx) => ({
      id: usuario,
      position: { x: idx * 240, y: 0 },
      data: { label: usuarios.find((u) => u.usuario === usuario)?.nombreCompleto || usuario },
      style: { width: 180 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }));
    const validIds = new Set(nodes.map((n) => n.id));
    setFlowBuilderNodes(nodes);
    setFlowBuilderEdges((eds) =>
      eds.filter((e) => validIds.has(e.source) && validIds.has(e.target))
    );
  }, [wizardStep, selectedUsers, usuarios]);

  const onBuilderConnect = (connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) {
      toast.error("Conexión inválida");
      return;
    }

    if (hasPath(connection.target, connection.source, flowBuilderEdges)) {
      toast.error("No puedes conectar hacia un nodo anterior (evita ciclos)");
      return;
    }

    setFlowError(null);
    setFlowBuilderEdges((eds) =>
      addEdge(
        {
          ...connection,
          markerEnd: { type: MarkerType.ArrowClosed },
        },
        eds
      )
    );
  };

  const onBuilderNodesChange = (changes: NodeChange[]) => {
    setFlowBuilderNodes((nds) => applyNodeChanges(changes, nds));
  };

  const onBuilderEdgesChange = (changes: EdgeChange[]) => {
    setFlowBuilderEdges((eds) => applyEdgeChanges(changes, eds));
  };

  const onEdgeClick = (_: React.MouseEvent, edge: Edge) => {
    setFlowBuilderEdges((eds) => eds.filter((e) => e.id !== edge.id));
  };

  const computeOrdenes = () => {
    const nodes = flowBuilderNodes;
    const edges = flowBuilderEdges;
    if (nodes.length === 0) {
      return selectedUsers.map((u) => ({ Usuario: u, Orden: 1 }));
    }
    const incoming = new Map<string, number>();
    nodes.forEach((n) => incoming.set(n.id, 0));
    edges.forEach((e) => {
      incoming.set(e.target, (incoming.get(e.target) || 0) + 1);
    });
    const queue: string[] = [];
    const ordenMap = new Map<string, number>();
    incoming.forEach((count, nodeId) => {
      if (count === 0) {
        queue.push(nodeId);
        ordenMap.set(nodeId, 1);
      }
    });

    const adj = new Map<string, string[]>();
    edges.forEach((e) => {
      if (!adj.has(e.source)) adj.set(e.source, []);
      adj.get(e.source)!.push(e.target);
    });

    while (queue.length) {
      const current = queue.shift() as string;
      const currentOrden = ordenMap.get(current) || 1;
      const neighbors = adj.get(current) || [];
      neighbors.forEach((n) => {
        incoming.set(n, (incoming.get(n) || 0) - 1);
        const candidateOrden = currentOrden + 1;
        const existingOrden = ordenMap.get(n) || 1;
        ordenMap.set(n, Math.max(existingOrden, candidateOrden));
        if ((incoming.get(n) || 0) === 0) {
          queue.push(n);
        }
      });
    }

    if (Array.from(incoming.values()).some((v) => v && v > 0)) {
      throw new Error("El flujo tiene ciclos. Ajusta las conexiones.");
    }

    return Array.from(ordenMap.entries()).map(([usuario, orden]) => ({ Usuario: usuario, Orden: orden }));
  };

  const hasPath = (start: string, end: string, edges: Edge[]): boolean => {
    const visited = new Set<string>();
    const stack = [start];
    const adj = new Map<string, string[]>();
    edges.forEach((e) => {
      if (!adj.has(e.source)) adj.set(e.source, []);
      adj.get(e.source)!.push(e.target);
    });
    while (stack.length) {
      const node = stack.pop() as string;
      if (node === end) return true;
      if (visited.has(node)) continue;
      visited.add(node);
      const next = adj.get(node) || [];
      next.forEach((n) => {
        if (!visited.has(n)) stack.push(n);
      });
    }
    return false;
  };

  const addFiles = async (files: File[]) => {
    if (!files.length) return;

    const invalidFiles = files.filter(f => f.type !== "application/pdf");
    if (invalidFiles.length > 0) {
      toast.error("Solo se permiten archivos PDF");
      return;
    }

    await loadUsuarios();

    const newFiles: WizardFile[] = files.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      column: 'Principal',
    }));

    setUploadFiles(prev => [...prev, ...newFiles]);
  };

  const handleDropFiles = async (files: File[]) => {
    await addFiles(files);
  };

  const removeUploadFile = (id: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleUploadDocument = async () => {
    if (uploadFiles.length === 0 || selectedUsers.length === 0) {
      toast.error("Selecciona al menos un archivo y un aprobador");
      return;
    }

    if (!uploadReason.trim()) {
      toast.error("Debes ingresar el motivo de la solicitud");
      return;
    }

    const principalFiles = uploadFiles.filter(f => f.column === 'Principal');
    if (principalFiles.length === 0) {
      toast.error("Debe haber al menos un archivo marcado como 'Principal'");
      return;
    }

    let ordenes: { Usuario: string; Orden: number }[] = [];
    try {
      if (flowBuilderNodes.length === 0) {
        const nodes = selectedUsers.map((u) => ({ id: u, data: { label: u }, position: { x: 0, y: 0 } }));
        setFlowBuilderNodes(nodes);
      }
      ordenes = computeOrdenes();
      if (ordenes.length === 0) {
        ordenes = selectedUsers.map((u) => ({ Usuario: u, Orden: 1 }));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al validar el flujo"
      );
      return;
    }

    setUploadingDocument(true);
    try {
      const approverPayload = ordenes
        .map((item) => {
          const info = usuarios.find((u) => u.usuario === item.Usuario);
          return {
            Usuario: info?.usuario ?? item.Usuario,
            Identificador: info?.identificadorFirma || undefined,
            Orden: item.Orden,
          };
        })
        .filter((a) => a.Usuario);

      const formData = new FormData();

      uploadFiles.forEach((wf) => {
        formData.append(`archivos`, wf.file);
        formData.append(`tiposDocumento`, wf.column);
      });

      formData.append("aprobadores", JSON.stringify(approverPayload));
      formData.append("comentarioInicial", uploadReason.trim());

      await postForm("/v2/documentos/crear-grupo-con-flujo", formData);

      toast.success(`${uploadFiles.length} documento(s) subido(s) exitosamente`);
      setShowUploadDialog(false);
      setUploadFiles([]);
      setUploadReason("");
      setFlowBuilderNodes([]);
      setFlowBuilderEdges([]);
      setSelectedUsers([]);
      setWizardStep(1);
      setFlowError(null);
      await loadDocuments();
    } catch (error) {
      console.error("Error uploading documents:", error);
      toast.error("Error al subir los documentos");
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleViewFlow = async (doc: DocumentoFlujo) => {
    try {
      const result = await get<{ data?: { pasos?: PasoFlujo[] } }>(
        `/v2/documentos/${doc.idDocumento}/flujo`
      );
      const steps: PasoFlujo[] = result.data?.pasos || [];
      setFlowSteps(steps);
      setFlowDocument(doc);

      const nodes: Node[] = steps.map((step, index) => ({
        id: `step-${index}`,
        type: "default",
        position: { x: 250, y: index * 150 },
        data: {
          label: (
            <div className="p-2" title={step.motivoRechazo || "Sin comentarios"}>
              <div className="font-semibold text-xs leading-tight truncate max-w-[180px]">
                {step.usuarioAprobador}
              </div>
              <div className="text-[11px] leading-tight">
                {step.estatus === "Aprobado" && (
                  <span className="text-green-600">✓ Aprobado</span>
                )}
                {step.estatus === "Rechazado" && (
                  <span className="text-red-600">✗ Rechazado</span>
                )}
                {step.estatus === "Pendiente" && (
                  <span className="text-yellow-600">⏳ Pendiente</span>
                )}
              </div>
              {step.fechaFirma && (
                <div className="text-[10px] text-gray-500 leading-tight">
                  {new Date(step.fechaFirma).toLocaleDateString()}
                </div>
              )}
              {step.motivoRechazo && (
                <div className="text-[10px] text-gray-700 leading-tight mt-1 italic truncate max-w-[180px]">
                  "{step.motivoRechazo}"
                </div>
              )}
            </div>
          ),
        },
        style: {
          background:
            step.estatus === "Aprobado"
              ? "#dcfce7"
              : step.estatus === "Rechazado"
              ? "#fee2e2"
              : "#fef3c7",
          border: "2px solid",
          borderColor:
            step.estatus === "Aprobado"
              ? "#22c55e"
              : step.estatus === "Rechazado"
              ? "#ef4444"
              : "#eab308",
          cursor: "help",
        },
      }));

      const edges: Edge[] = steps.slice(0, -1).map((_, index) => ({
        id: `edge-${index}`,
        source: `step-${index}`,
        target: `step-${index + 1}`,
        type: "smoothstep",
        animated: true, 
        style: { strokeDasharray: "4 3" },
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      }));

      setFlowNodes(nodes);
      setFlowEdges(edges);
      setShowFlowDialog(true);
    } catch (error) {
      console.error("Error loading flow:", error);
      toast.error("Error al cargar el flujo del documento");
    }
  };

  const handleApprove = (doc: DocumentoFlujo) => {
    setSelectedDocument(doc);
    setApproveComment("");
    setShowApproveDialog(true);
  };

  const confirmApprove = async () => {
    if (!selectedDocument) return;

    setIsApproving(true);
    try {
      await post("/v2/documentos/aprobar", {
        idDocumento: selectedDocument.idDocumento,
        comentarios: approveComment || undefined,
      });
      toast.success("Documento aprobado exitosamente");
      setShowApproveDialog(false);
      await loadDocuments();
    } catch (error) {
      console.error("Error approving document:", error);
      toast.error("Error al aprobar el documento");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = (doc: DocumentoFlujo) => {
    setSelectedDocument(doc);
    setRejectReason("");
    setApproveComment("");
    setShowRejectDialog(true);
  };

  const confirmReject = async () => {
    if (!selectedDocument || !rejectReason.trim()) {
      toast.error("El motivo del rechazo es obligatorio");
      return;
    }

    setIsRejecting(true);
    try {
      await post("/v2/documentos/rechazar", {
        idDocumento: selectedDocument.idDocumento,
        motivo: rejectReason,
      });
      toast.success("Documento rechazado");
      setShowRejectDialog(false);
      await loadDocuments();
    } catch (error) {
      console.error("Error rejecting document:", error);
      toast.error("Error al rechazar el documento");
    } finally {
      setIsRejecting(false);
    }
  };

  const handleResendNotification = async (doc: DocumentoFlujo) => {
    try {
      await post(`/v2/documentos/${doc.idDocumento}/reenviar-notificacion`);

      toast.success("Notificación reenviada");
    } catch (error) {
      console.error("Error resending notification:", error);
      toast.error("Error al reenviar la notificación");
    }
  };

  const handleViewComments = async (doc: DocumentoFlujo) => {
    setCommentsHistory([]);
    setLoadingComments(true);
    try {
      const data = await get<{ data?: RawComentario[] }>(
        `/v2/documentos/${doc.idDocumento}/historial-comentarios`
      );
      const comentarios = Array.isArray(data?.data)
        ? data.data.map((c: RawComentario) => ({
            fecha: c.fecha || c.Fecha || "",
            usuario: c.usuario || c.Usuario || "",
            estatus: c.estatus || c.Estatus || "",
            comentario: c.comentario || c.Comentario || "",
          }))
        : [];
      setCommentsHistory(comentarios);
      setShowCommentsDialog(true);
    } catch (error) {
      console.error("Error loading comments:", error);
      toast.error("No se pudo cargar el historial de comentarios");
    } finally {
      setLoadingComments(false);
    }
  };

  const handleDeleteDocument = async (doc: DocumentoFlujo) => {
    const confirmed = window.confirm(
      `¿Seguro que quieres eliminar "${doc.nombreArchivo}"? Solo se puede eliminar si nadie ha firmado.`
    );
    if (!confirmed) return;

    setDeletingId(doc.idDocumento);
    try {
      await del(`/v2/documentos/${doc.idDocumento}`);

      toast.success("Documento eliminado");
      await loadDocuments();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("No se pudo eliminar el documento");
    } finally {
      setDeletingId(null);
    }
  };

  const handleShowGroup = (doc: DocumentoFlujo) => {
    setGroupDocs(doc.documentos || []);
    setGroupTitle(doc.nombreArchivo || "Grupo de documentos");
    setShowGroupDialog(true);
  };

  const resolvePrincipalDoc = (doc: DocumentoFlujo): DocumentoAdjunto | null => {
    if (doc.documentos?.length) {
      const principal =
        doc.documentos.find((d) => d.esPrincipal || d.tipoDocumento === "Principal") ||
        doc.documentos[0];
      return principal;
    }
    return {
      idDocumento: doc.idDocumento,
      nombreArchivo: doc.nombreArchivo,
      tipoDocumento: "Principal",
      esPrincipal: true,
    };
  };

  const resolveAnexoDoc = (doc: DocumentoFlujo): DocumentoAdjunto | null => {
    if (doc.documentos?.length) {
      return doc.documentos.find((d) => (d.tipoDocumento || "Principal") !== "Principal") || null;
    }
    return null;
  };

  const loadPreviewFile = async (
    targetDoc: DocumentoAdjunto,
    parent: DocumentoFlujo,
    markSupport: boolean
  ) => {
    const response = await fetch(
      `${API_BASE_URL}/v2/documentos/${targetDoc.idDocumento}/descargar`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) throw new Error("Error al cargar documento");

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    setPreviewDocument({
      id: targetDoc.idDocumento,
      name: targetDoc.nombreArchivo || parent.nombreArchivo,
      type: "application/pdf",
      size: blob.size,
      fileUrl: blobUrl,
      uploadDate: new Date(parent.fechaSubida),
      status: parent.estatusFlujo === "Completado" ? "approved" : "pending",
      uploadedBy: parent.creadoPor,
      tieneDocumentoLigado: markSupport,
    });
  };

  const handlePreview = async (doc: DocumentoFlujo) => {
    const principalDoc = resolvePrincipalDoc(doc);
    const anexoDoc = resolveAnexoDoc(doc);
    setPreviewDocsGroup(doc.documentos || []);
    setPreviewParentDoc(doc);
    setLoadingDocumentId(doc.idDocumento);
    try {
      if (!principalDoc) throw new Error("No se encontró documento principal");
      await loadPreviewFile(principalDoc, doc, Boolean(anexoDoc));
      setShowPreview(true);
    } catch (error) {
      console.error("Error loading document:", error);
      toast.error("Error al cargar el documento");
    } finally {
      setLoadingDocumentId(null);
    }
  };

  const handlePreviewVariantLoad = async (_: string, mostrarDocumentoSoporte: boolean) => {
    const current = previewDocument;
    if (!current) return;
    const parentDoc =
      previewParentDoc ||
      todosDocumentos
        .concat(misDocumentos, pendientes, firmados)
        .find((d) => d.documentos?.some((x) => x.idDocumento === current.id) || d.idDocumento === current.id);
    if (!parentDoc) return;

    const principalDoc = resolvePrincipalDoc(parentDoc);
    const anexoDoc = resolveAnexoDoc(parentDoc);
    const target = mostrarDocumentoSoporte && anexoDoc ? anexoDoc : principalDoc;
    if (!target) return;
    try {
      await loadPreviewFile(target, parentDoc, Boolean(anexoDoc));
    } catch (error) {
      console.error("Error loading alternate document:", error);
      toast.error("No se pudo cambiar el documento mostrado");
    }
  };

  const handleSelectAttachment = async (idDocumento: string) => {
    if (!previewParentDoc) return;
    const target = previewDocsGroup.find((d) => d.idDocumento === idDocumento);
    if (!target) return;
    try {
      await loadPreviewFile(target, previewParentDoc, (target.tipoDocumento || "Principal") !== "Principal");
    } catch (error) {
      console.error("Error loading selected attachment:", error);
      toast.error("No se pudo cargar el documento seleccionado");
    }
  };

  const handleExportToExcel = (data: DocumentoFlujo[], fileName: string) => {
    if (data.length === 0) {
      toast.error("No hay documentos para exportar");
      return;
    }

    const excelData = data.map((doc) => ({
      "ID Documento": doc.idDocumento,
      "Nombre Archivo": doc.nombreArchivo,
      "Creado Por": doc.nombreCreadoPor || doc.creadoPor,
      "Fecha Subida": new Date(doc.fechaSubida).toLocaleString("es-ES"),
      "Última Interacción": doc.fechaUltimaInteraccion
        ? new Date(doc.fechaUltimaInteraccion).toLocaleString("es-ES")
        : "-",
      Estatus: doc.estatusFlujo,
      "Paso Actual": `${doc.pasoActual}/${doc.totalPasos}`,
      "Turno Actual": doc.nombrePasoActual || doc.nombreUsuarioActual || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Documentos");
    XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const createColumns = (
    showActions: boolean,
    showResend: boolean = false
  ): ColumnDef<DocumentoFlujo>[] => {
    const cols: ColumnDef<DocumentoFlujo>[] = [
      {
        accessorKey: "nombreArchivo",
        header: "Nombre",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate max-w-[200px]" title={row.original.nombreArchivo}>
              {row.original.nombreArchivo}
            </span>
          </div>
        ),
      },
      {
        id: "nombreCreador",
        header: "Creado Por",
        cell: ({ row }) => {
          const nombre = row.original.nombreCreadoPor || row.original.creadoPor;
          return (
            <span className="text-xs text-muted-foreground truncate max-w-[150px]" title={nombre}>
              {nombre}
            </span>
          );
        },
      },
      {
        accessorKey: "fechaSubida",
        header: "Fecha Creación",
        cell: ({ row }) => (
          <span className="text-xs">
            {new Date(row.original.fechaSubida).toLocaleDateString("es-ES")}
          </span>
        ),
      },
      {
        id: "fechaUltimaInteraccion",
        header: "Última Interacción",
        cell: ({ row }) => {
          const fecha = row.original.fechaUltimaInteraccion;
          if (!fecha) return <span className="text-xs text-muted-foreground">-</span>;
          return (
            <span className="text-xs">
              {new Date(fecha).toLocaleString("es-ES", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          );
        },
      },
      {
        accessorKey: "estatusFlujo",
        header: "Estatus",
        cell: ({ row }) => {
          const estatus = row.original.estatusFlujo;
          const variant =
            estatus === "Completado"
              ? "default"
              : estatus === "Rechazado"
              ? "destructive"
              : "secondary";
          return (
            <Badge variant={variant} className="text-xs">
              {estatus}
            </Badge>
          );
        },
      },
      {
        accessorKey: "pasoActual",
        header: "Progreso",
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.pasoActual}/{row.original.totalPasos}
          </span>
        ),
      },
      {
        id: "turnoActual",
        header: "Turno Actual",
        cell: ({ row }) => {
          const nombreTurno =
            row.original.nombrePasoActual || row.original.nombreUsuarioActual;
          if (!nombreTurno) {
            return <span className="text-xs text-muted-foreground">-</span>;
          }
          return (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3 text-primary shrink-0" />
              <span className="text-xs truncate max-w-[120px]" title={nombreTurno}>
                {nombreTurno}
              </span>
            </div>
          );
        },
      },
      {
        id: "grupo",
        header: "Grupo",
        cell: ({ row }) => {
          const doc = row.original as DocumentoFlujo;
          const principales =
            doc.documentos?.filter((d) => (d.tipoDocumento || "Principal") === "Principal")
              .length || 0;
          const anexos =
            doc.documentos?.filter((d) => (d.tipoDocumento || "Principal") !== "Principal")
              .length || 0;
          return (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-[10px]">
                {principales} para firmar
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {anexos} anexos
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleShowGroup(doc)}
                title="Ver documentos del grupo"
              >
                <Files className="h-3 w-3" />
              </Button>
            </div>
          );
        },
      },
    ];

    cols.push({
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => {
        const doc = row.original;
        const isCreator = auth.getUserWithDomain() === doc.creadoPor;

        return (
          <div className="flex items-center gap-1 justify-start">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => handlePreview(doc)}
              disabled={loadingDocumentId === doc.idDocumento}
              title="Ver documento"
            >
              {loadingDocumentId === doc.idDocumento ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleViewFlow(doc)}
              title="Ver flujo"
            >
              <WorkflowIcon className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleViewComments(doc)}
              title="Historial de comentarios"
            >
              <MessageSquare className="h-3 w-3" />
            </Button>
            {showActions && doc.estatusFlujo === "EnProgreso" && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => handleApprove(doc)}
                  disabled={isApproving || isRejecting}
                  title="Aprobar"
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleReject(doc)}
                  disabled={isApproving || isRejecting}
                  title="Rechazar"
                >
                  <X className="h-3 w-3" />
                </Button>
              </>
            )}
            {}
            {showResend && isCreator && doc.alertaColor !== "ninguna" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleResendNotification(doc)}
                title="Reenviar notificación"
              >
                <Send className="h-3 w-3" />
              </Button>
            )}
            {}
            {showResend && isCreator && doc.estatusFlujo === "EnProgreso" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => handleDeleteDocument(doc)}
                disabled={deletingId === doc.idDocumento}
                title="Eliminar documento (sin firmas)"
              >
                {deletingId === doc.idDocumento ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <X className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        );
      },
    });

    return cols;
  };

  const getRowClassName = (doc: DocumentoFlujo) => {
    if (doc.alertaColor === "roja") {
      return "bg-red-50 hover:bg-red-100";
    }
    if (doc.alertaColor === "amarilla") {
      return "bg-yellow-50 hover:bg-yellow-100";
    }
    return "";
  };

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const columnsWithActions = createColumns(true, false);
  const columnsWithResend = createColumns(false, true);
  const columnsBase = createColumns(false, false);
  const isAnyDialogOpen =
    showPreview ||
    showUploadDialog ||
    showApproveDialog ||
    showRejectDialog ||
    showFlowDialog ||
    showCommentsDialog;

  return (
      <SidebarProvider>
        {!isAnyDialogOpen && (
          <>
            <AppSidebar />
            <SidebarInset>
              <Navbar />
              <main className="flex-1 p-3">
                <div className="space-y-3 max-w-full">
                  {}
                  <div className="py-0.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        <h1 className="text-base font-bold leading-tight">
                          Flujo de Documentos con Firmas
                        </h1>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={loadDocuments}
                          disabled={loading}
                          className="h-7 text-xs gap-1.5"
                        >
                          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                          Actualizar
                        </Button>
                      </div>
                    </div>
                    <p className="text-muted-foreground text-xs mt-0 leading-tight">
                      Gestiona el flujo de aprobación de documentos con firmas digitales
                    </p>
                  </div>

              {}
              <Card>
                <CardContent className="py-3 px-3">
                  <Button
                    onClick={() => setShowUploadDialog(true)}
                    className="h-9 text-xs gap-1.5"
                  >
                    <Upload className="h-4 w-4" />
                    Subir PDF para aprobación
                  </Button>
                </CardContent>
              </Card>

              {}
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Spinner className="h-8 w-8" />
                </div>
              ) : (
                <TooltipProvider>
                  <Tabs
                    value={activeTab}
                    onValueChange={(val) =>
                      setActiveTab(val as "subidos" | "pendientes" | "firmados" | "todos")
                    }
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="subidos" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        Subidos por mí ({misDocumentos.length})
                      </TabsTrigger>
                      <TabsTrigger value="pendientes" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        Pendientes ({pendientes.length})
                      </TabsTrigger>
                      <TabsTrigger value="firmados" className="text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        En progreso ({firmados.length})
                      </TabsTrigger>
                      <TabsTrigger value="todos" className="text-xs">
                        <FileText className="h-3 w-3 mr-1" />
                        Todos ({todosDocumentos.length})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="subidos" className="mt-3">
                      <Card>
                        <CardHeader className="py-2 pb-1 px-3">
                          <CardTitle className="text-sm">Documentos subidos por mí</CardTitle>
                          <CardDescription className="text-xs">
                            Documentos que has creado y están en proceso
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pb-2 pt-1 px-3">
                          <DataTable
                            columns={columnsWithResend}
                            data={misDocumentos}
                            getRowClassName={getRowClassName}
                            bottomActions={
                              <Button
                                onClick={() => handleExportToExcel(misDocumentos, "mis_documentos")}
                                variant="outline"
                                className="h-7 text-xs gap-1.5"
                                disabled={misDocumentos.length === 0}
                              >
                                <FileSpreadsheet className="h-3 w-3" />
                                Exportar
                              </Button>
                            }
                          />
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="pendientes" className="mt-3">
                      <Card>
                        <CardHeader className="py-2 pb-1 px-3">
                          <CardTitle className="text-sm">
                            Pendientes de autorizar
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Documentos que requieren tu firma o aprobación
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pb-2 pt-1 px-3">
                          <DataTable
                            columns={columnsWithActions}
                            data={pendientes}
                            getRowClassName={getRowClassName}
                            bottomActions={
                              <Button
                                onClick={() => handleExportToExcel(pendientes, "pendientes")}
                                variant="outline"
                                className="h-7 text-xs gap-1.5"
                                disabled={pendientes.length === 0}
                              >
                                <FileSpreadsheet className="h-3 w-3" />
                                Exportar
                              </Button>
                            }
                          />
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="firmados" className="mt-3">
                      <Card>
                        <CardHeader className="py-2 pb-1 px-3">
                          <CardTitle className="text-sm">En progreso</CardTitle>
                          <CardDescription className="text-xs">
                            Documentos que he firmado o creé y aún no concluyen el flujo
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pb-2 pt-1 px-3">
                          <DataTable
                            columns={columnsBase}
                            data={firmados}
                            bottomActions={
                              <Button
                                onClick={() => handleExportToExcel(firmados, "firmados")}
                                variant="outline"
                                className="h-7 text-xs gap-1.5"
                                disabled={firmados.length === 0}
                              >
                                <FileSpreadsheet className="h-3 w-3" />
                                Exportar
                              </Button>
                            }
                          />
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="todos" className="mt-3">
                      <Card>
                        <CardHeader className="py-2 pb-1 px-3">
                          <CardTitle className="text-sm">Todos los documentos</CardTitle>
                          <CardDescription className="text-xs">
                            Vista completa de todos los documentos
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pb-2 pt-1 px-3">
                          <DataTable
                            columns={columnsBase}
                            data={todosDocumentos}
                            getRowClassName={getRowClassName}
                            bottomActions={
                              <Button
                                onClick={() =>
                                  handleExportToExcel(todosDocumentos, "todos_documentos")
                                }
                                variant="outline"
                                className="h-7 text-xs gap-1.5"
                                disabled={todosDocumentos.length === 0}
                              >
                                <FileSpreadsheet className="h-3 w-3" />
                                Exportar
                              </Button>
                            }
                          />
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </TooltipProvider>
              )}
                </div>
              </main>
            </SidebarInset>
          </>
        )}

        {}
        <PDFPreviewDialog
          document={previewDocument}
          open={showPreview}
          onOpenChange={setShowPreview}
          onDocumentLoad={handlePreviewVariantLoad}
          attachments={previewDocsGroup}
          onSelectAttachment={handleSelectAttachment}
        />

        {}
        <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Grupo: {groupTitle}</DialogTitle>
              <DialogDescription>
                Documentos que avanzan juntos en el flujo: principales y anexos visuales.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">Para firmar</Badge>
                  <span className="text-xs text-muted-foreground">
                    {groupDocs.filter((d) => (d.tipoDocumento || "Principal") === "Principal").length} archivos
                  </span>
                </div>
                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                  {groupDocs
                    .filter((d) => (d.tipoDocumento || "Principal") === "Principal")
                    .map((doc) => (
                      <div
                        key={doc.idDocumento}
                        className="flex items-start gap-2 rounded border px-2 py-1.5"
                      >
                        <FileText className="h-4 w-4 text-primary mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate" title={doc.nombreArchivo}>
                            {doc.nombreArchivo}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {doc.tamanoBytes ? `${(doc.tamanoBytes / 1024).toFixed(1)} KB` : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  {groupDocs.filter((d) => (d.tipoDocumento || "Principal") === "Principal").length ===
                    0 && (
                    <div className="text-xs text-muted-foreground">Sin archivos para firmar.</div>
                  )}
                </div>
              </div>
              <div className="rounded border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">Anexos</Badge>
                  <span className="text-xs text-muted-foreground">
                    {groupDocs.filter((d) => (d.tipoDocumento || "Principal") !== "Principal").length} archivos
                  </span>
                </div>
                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                  {groupDocs
                    .filter((d) => (d.tipoDocumento || "Principal") !== "Principal")
                    .map((doc) => (
                      <div
                        key={`anexo-${doc.idDocumento}`}
                        className="flex items-start gap-2 rounded border px-2 py-1.5"
                      >
                        <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate" title={doc.nombreArchivo}>
                            {doc.nombreArchivo}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {doc.tamanoBytes ? `${(doc.tamanoBytes / 1024).toFixed(1)} KB` : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  {groupDocs.filter((d) => (d.tipoDocumento || "Principal") !== "Principal").length ===
                    0 && (
                    <div className="text-xs text-muted-foreground">Sin anexos en este grupo.</div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowGroupDialog(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent className="sm:max-w-[90vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configurar Flujo de Aprobación</DialogTitle>
              <DialogDescription>
                Sigue los pasos para subir el documento, elegir usuarios y armar el flujo
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex items-center gap-2 text-xs flex-wrap">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className="flex items-center gap-1 w-full sm:w-fit"
                  >
                    <div className="flex items-center gap-1 w-full">
                      <div
                        className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-semibold ${
                          wizardStep >= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {step}
                      </div>
                      <div className="flex-1 h-2 rounded-full overflow-hidden bg-muted">
                        <div
                          className={`h-full transition-all ${
                            wizardStep >= step ? "bg-primary" : "bg-muted-foreground/30"
                          }`}
                          style={{ width: wizardStep > step ? "100%" : wizardStep === step ? "60%" : "0%" }}
                        />
                      </div>
                      <span className="min-w-[130px] text-muted-foreground text-[12px]">
                        {step === 1 && "Archivo"}
                        {step === 2 && "Seleccionar usuarios"}
                        {step === 3 && "Organizar flujo"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {wizardStep === 1 && (
                <div className="grid gap-3">
                  <div className="flex items-center gap-2">
                    <Dropzone
                      accept={{ "application/pdf": [] }}
                      multiple
                      maxSize={25 * 1024 * 1024} 
                      onDrop={handleDropFiles}
                      onError={(err) => toast.error(err.message)}
                      className="w-full"
                    >
                      <DropzoneContent className="w-full">
                        <DropzoneEmptyState
                          title="Arrastra y suelta tus PDF"
                          description={
                            allowMultipleFiles
                              ? "Puedes cargar varios principales y anexos en un solo paso."
                              : "Solo un archivo principal; los demás como anexos."
                          }
                          icon={<UploadCloud className="h-5 w-5" />}
                        />
                        <div className="text-[11px] text-muted-foreground">
                          Máx 25MB por archivo. Haz clic para abrir el selector de archivos.
                        </div>
                      </DropzoneContent>
                    </Dropzone>
                  </div>

                  {uploadFiles.length > 0 && (
                    <div className="border rounded-lg p-4 bg-muted/20">
                      <div className="mb-2 flex items-center justify-between">
                        <Label className="text-sm font-semibold">
                          Archivos cargados ({uploadFiles.length})
                        </Label>
                        <Badge variant="outline" className="text-xs">
                          Arrastra para organizar
                        </Badge>
                      </div>
                      <KanbanProvider
                        columns={[
                          { id: 'Principal', name: 'Archivos para Firmar', color: '#3b82f6' },
                          { id: 'Complemento', name: 'Archivos Complemento', color: '#8b5cf6' },
                        ]}
                        data={uploadFiles}
                        onDataChange={setUploadFiles}
                      >
                        {(column) => (
                          <KanbanBoard id={column.id} key={column.id}>
                            <KanbanHeader>
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: column.color }}
                                />
                                <span>{column.name}</span>
                                <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                  {uploadFiles.filter(f => f.column === column.id).length}
                                </Badge>
                              </div>
                            </KanbanHeader>
                            <KanbanCards id={column.id}>
                              {(file: WizardFile) => (
                                <KanbanCard
                                  column={column.id}
                                  id={file.id}
                                  key={file.id}
                                  name={file.file.name}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <FileText className="h-4 w-4 text-primary shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate">
                                          {file.file.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {(file.file.size / 1024).toFixed(1)} KB
                                        </p>
                                      </div>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 shrink-0"
                                      onClick={() => removeUploadFile(file.id)}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </KanbanCard>
                              )}
                            </KanbanCards>
                          </KanbanBoard>
                        )}
                      </KanbanProvider>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Label htmlFor="uploadReason">Motivo de la solicitud</Label>
                    <Textarea
                      id="uploadReason"
                      placeholder="Describe brevemente la razón del envío de este grupo de documentos"
                      value={uploadReason}
                      onChange={(e) => setUploadReason(e.target.value)}
                      maxLength={500}
                      rows={3}
                    />
                    <div className="text-xs text-muted-foreground text-right">
                      {uploadReason.length}/500
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label>Selecciona a los usuarios que entrarán al flujo</Label>
                    <Input
                      placeholder="Buscar..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="h-8 text-xs max-w-[200px]"
                    />
                  </div>
                  <div className="border rounded p-3 max-h-[300px] overflow-y-auto space-y-2">
                    {(() => {
                      const filtrar = (u: Usuario) =>
                        u.nombreCompleto.toLowerCase().includes(userSearch.toLowerCase()) ||
                        u.usuario.toLowerCase().includes(userSearch.toLowerCase());

                      const conFirma = (usuarios || []).filter(
                        (u: Usuario) => u.tieneFirma && filtrar(u)
                      );
                      const sinFirma = (usuarios || []).filter(
                        (u: Usuario) => !u.tieneFirma && filtrar(u)
                      );

                      const renderUser = (usuario: Usuario) => {
                        const selected = selectedUsers.includes(usuario.usuario);
                        return (
                          <div
                            key={usuario.usuario}
                            className={`flex items-center justify-between p-2 rounded border ${
                              selected ? "bg-primary/10 border-primary" : "bg-background"
                            } ${usuario.tieneFirma ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                            onClick={() => usuario.tieneFirma && toggleUserSelection(usuario.usuario)}
                            title={
                              usuario.tieneFirma
                                ? "Haz clic para seleccionar"
                                : "No se puede seleccionar hasta que cargue su firma"
                            }
                          >
                            <div className="flex items-center gap-2">
                              <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-muted text-xs font-bold">
                                {usuario.nombreCompleto.charAt(0).toUpperCase()}
                                {usuario.tieneFirma && (
                                  <span className="absolute -right-1 -bottom-1 h-3 w-3 rounded-full bg-green-500 border border-background" />
                                )}
                              </div>
                              <div>
                                <div className="text-sm font-medium">
                                  {usuario.nombreCompleto}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {usuario.usuario}
                                </div>
                              </div>
                            </div>
                            <Badge variant={usuario.tieneFirma ? "default" : "destructive"} className="text-[11px]">
                              {usuario.tieneFirma
                                ? usuario.identificadorFirma
                                  ? `Firma: ${usuario.identificadorFirma}`
                                  : "Con firma"
                                : "Sin firma"}
                            </Badge>
                          </div>
                        );
                      };

                      if (conFirma.length === 0 && sinFirma.length === 0) {
                        return (
                          <div className="text-center text-sm text-muted-foreground py-4">
                            No hay usuarios disponibles
                          </div>
                        );
                      }

                      return (
                        <>
                          {conFirma.length > 0 && (
                            <>
                              <div className="text-[11px] uppercase tracking-wide text-muted-foreground px-1">
                                Con firma
                              </div>
                              {conFirma.map(renderUser)}
                            </>
                          )}
                          {conFirma.length > 0 && sinFirma.length > 0 && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                              <div className="flex-1 border-t" />
                              <span>Sin firma</span>
                              <div className="flex-1 border-t" />
                            </div>
                          )}
                          {sinFirma.length > 0 && (
                            <>
                              <div className="text-[11px] uppercase tracking-wide text-muted-foreground px-1">
                                Sin firma
                              </div>
                              {sinFirma.map(renderUser)}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  {selectedUsers.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Seleccionados: {selectedUsers.length}
                    </div>
                  )}
                </div>
              )}

              {wizardStep === 3 && (
                <div className="grid gap-3">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      Conecta los nodos para indicar dependencias. Sin conexión = inicia en paralelo.
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        setFlowBuilderEdges([]);
    setFlowError(null);
                      }}
                    >
                      Limpiar conexiones
                    </Button>
                  </div>
                  <div className="h-[330px] border rounded bg-background">
                    <ReactFlow
                      nodes={flowBuilderNodes}
                      edges={flowBuilderEdges}
                      onNodesChange={onBuilderNodesChange}
                      onEdgesChange={onBuilderEdgesChange}
                      onConnect={onBuilderConnect}
                      onEdgeClick={onEdgeClick}
                      defaultEdgeOptions={{ type: "smoothstep" }}
                      fitView
                      attributionPosition="bottom-left"
                    >
                      <Controls />
                      <MiniMap />
                      <Background />
                    </ReactFlow>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    El flujo se marca como finalizado cuando todos los nodos hayan firmado.
                    {flowError && <span className="text-destructive font-medium ml-2">{flowError}</span>}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <div className="flex w-full justify-between">
                <DialogClose asChild>
                  <Button variant="outline" disabled={uploadingDocument}>
                    Cancelar
                  </Button>
                </DialogClose>
                <div className="flex gap-2">
                  {wizardStep > 1 && (
                    <Button variant="outline" onClick={handleWizardBack} disabled={uploadingDocument}>
                      Regresar
                    </Button>
                  )}
                  {wizardStep < 3 && (
                    <Button onClick={handleWizardNext} disabled={uploadingDocument}>
                      Siguiente
                    </Button>
                  )}
                  {wizardStep === 3 && (
                    <Button onClick={handleUploadDocument} disabled={uploadingDocument}>
                      {uploadingDocument && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Subir Documento
                    </Button>
                  )}
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {}
        <Dialog open={showFlowDialog} onOpenChange={setShowFlowDialog}>
          <DialogContent className="sm:max-w-[90vw] max-h-[90vh] h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Flujo de Aprobación</DialogTitle>
              <DialogDescription>
                {flowDocument?.nombreArchivo} - Estado actual del flujo
              </DialogDescription>
            </DialogHeader>
            <ReactFlowProvider>
              <div className="flex-1 min-h-[400px] border rounded overflow-hidden bg-background/80">
                <ReactFlow
                  nodes={flowNodes}
                  edges={flowEdges}
                  fitView
                  fitViewOptions={{ padding: 0.25 }}
                  attributionPosition="bottom-left"
                  nodesDraggable={false}
                  nodesConnectable={false}
                  panOnScroll
                  onInit={(instance) => instance.fitView({ padding: 0.25 })}
                >
                  <Controls />
                  <MiniMap />
                  <Background />
                </ReactFlow>
                {flowSteps.length > 0 && (
                  <div className="border-t p-3 grid gap-2 bg-muted/30">
                    {flowSteps.map((step, idx) => (
                      <div
                        key={`${step.usuarioAprobador}-${idx}`}
                        className="flex items-center justify-between rounded border bg-background px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[11px]">
                            Paso {idx + 1}
                          </Badge>
                          <div>
                            <div className="text-xs font-medium leading-tight">
                              {step.usuarioAprobador}
                            </div>
                            <div className="text-[11px] text-muted-foreground leading-tight">
                              {step.motivoRechazo
                                ? `Comentario: ${step.motivoRechazo}`
                                : "Sin comentarios"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              step.estatus === "Aprobado"
                                ? "default"
                                : step.estatus === "Rechazado"
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-[11px]"
                          >
                            {step.estatus}
                          </Badge>
                          {step.fechaFirma && (
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(step.fechaFirma).toLocaleString("es-ES")}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ReactFlowProvider>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cerrar</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {}
        <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aprobar Documento</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que deseas aprobar el documento "
                {selectedDocument?.nombreArchivo}"?
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="approveComment">Comentario (opcional)</Label>
                <Textarea
                  id="approveComment"
                  value={approveComment}
                  onChange={(e) => setApproveComment(e.target.value)}
                  placeholder="Comentario breve (opcional)"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={isApproving}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button onClick={confirmApprove} disabled={isApproving}>
                {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Aprobar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rechazar Documento</DialogTitle>
              <DialogDescription>
                Proporciona un motivo para rechazar el documento "
                {selectedDocument?.nombreArchivo}"
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="rejectReason">
                  Motivo del rechazo <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="rejectReason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explica el motivo del rechazo..."
                  rows={4}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={isRejecting}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={confirmReject}
                disabled={!rejectReason.trim() || isRejecting}
              >
                {isRejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Rechazar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {}
        <Dialog open={showCommentsDialog} onOpenChange={setShowCommentsDialog}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Historial de Comentarios</DialogTitle>
              <DialogDescription>
                Comentarios y observaciones del flujo de aprobación
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[400px] overflow-y-auto">
              {loadingComments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : commentsHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay comentarios registrados
                </div>
              ) : (
                <div className="space-y-3">
                  {commentsHistory.map((comment, idx) => (
                    <div
                      key={idx}
                      className="border rounded-lg p-3 bg-muted/30"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              comment.estatus === "Aprobado"
                                ? "default"
                                : comment.estatus === "Rechazado"
                                ? "destructive"
                                : comment.estatus === "Solicitud"
                                ? "outline"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {comment.estatus}
                          </Badge>
                          <span className="text-sm font-medium">
                            {comment.usuario}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.fecha).toLocaleString("es-ES")}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {comment.comentario}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cerrar</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarProvider>
  );
}
