import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/apps/sigma/components/app-sidebar";
import { Navbar } from "@/apps/sigma/components/navbar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Loader2, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import { useSigmaAuth } from "@/apps/sigma/store/sigmaAuth";
import {
  SigmaHttpError,
  get,
  getBlob,
  post,
} from "@/apps/sigma/lib/httpClient";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  type Document,
  type RawDocumentoApi,
} from "@/apps/sigma/lib/documents";
import { DataTable } from "@/apps/sigma/components/documents/data-table";
import { createBandejaColumns } from "@/apps/sigma/components/documents/bandeja-columns";
import { PDFPreviewDialog } from "@/apps/sigma/components/documents/pdf-preview-dialog";
import { toast } from "sonner";
import { auth } from "@/apps/sigma/lib/auth";
import {
  fetchBandejaUsers,
  type BandejaUserOption,
} from "@/apps/sigma/lib/users";

const ALL_USERS_VALUE = "__all__";

const APPROVE_WITHOUT_COMMENT_KEY = "bandeja.allowApproveWithoutComment";

const createDefaultStartDate = () => {
  const today = new Date();
  const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  firstDayLastMonth.setHours(0, 0, 0, 0);
  return firstDayLastMonth;
};

const createDefaultEndDate = () => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
};

const toDateInputValue = (date?: Date) =>
  date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
      ).padStart(2, "0")}`
    : null;

type BandejaViewMode = "pending" | "authorizedRejected";

interface BandejaPageProps {
  mode: BandejaViewMode;
  pageTitle: string;
  pageDescription: string;
}

function shouldFilterDocumentByMode(document: Document, mode: BandejaViewMode) {
  if (mode === "pending") {
    return document.status === "pending";
  }

  return document.status === "approved" || document.status === "rejected";
}

export function BandejaView({
  mode,
  pageTitle,
  pageDescription,
}: BandejaPageProps) {
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useSigmaAuth();
  const isPendingView = mode === "pending";
  const isAuthorizedRejectedView = mode === "authorizedRejected";
  const [documents, setDocuments] = useState<Document[]>([]);
  const [mounted, setMounted] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingDocumentId, setLoadingDocumentId] = useState<string | null>(
    null
  );
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(
    null
  );
  const [approveComment, setApproveComment] = useState("");
  const [rejectComment, setRejectComment] = useState("");
  const [allowApproveWithoutComment, setAllowApproveWithoutComment] =
    useState(true);
  const isFirstRenderRef = useRef(true);
  const previewUrlRef = useRef<string | null>(null);
  const lastRequestIdRef = useRef(0);

  const [nameFilter, setNameFilter] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(createDefaultStartDate);
  const [endDate, setEndDate] = useState<Date | undefined>(createDefaultEndDate);
  const [userFilter, setUserFilter] = useState<string | undefined>(undefined);
  const [userOptions, setUserOptions] = useState<BandejaUserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const loadUserOptions = async () => {
    setLoadingUsers(true);
    try {
      const users = await fetchBandejaUsers();
      setUserOptions(users);
    } catch (error) {
      console.error("bandeja loadUserOptions: Error loading users:", error);
      toast.error("Error al cargar usuarios para el filtro");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadUserOptions();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const usuarioParam = searchParams.get("usuario");
    if (usuarioParam && userOptions.length > 0) {
      const userExists = userOptions.find(
        (option) =>
          option.value === usuarioParam ||
          option.value.split("@")[0].toLowerCase() ===
            usuarioParam.toLowerCase()
      );
      if (userExists) {
        setUserFilter(userExists.value);
      }
    }
  }, [searchParams, userOptions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedPreference = window.localStorage.getItem(
      APPROVE_WITHOUT_COMMENT_KEY
    );
    if (storedPreference === null) {
      window.localStorage.setItem(APPROVE_WITHOUT_COMMENT_KEY, "true");
      setAllowApproveWithoutComment(true);
      return;
    }
    setAllowApproveWithoutComment(storedPreference === "true");
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;

    if (!isPendingView) {
      isFirstRenderRef.current = false;
      return;
    }

    window.localStorage.setItem(
      APPROVE_WITHOUT_COMMENT_KEY,
      allowApproveWithoutComment ? "true" : "false"
    );

    if (!isFirstRenderRef.current) {
      if (allowApproveWithoutComment) {
        toast.info("Autorización rápida activada", {
          description: "Ahora se puede autorizar sin comentar",
          duration: 3000,
        });
      } else {
        toast.info("Comentarios requeridos", {
          description: "Necesitará dejar comentarios al autorizar",
          duration: 3000,
        });
      }
    } else {
      isFirstRenderRef.current = false;
    }
  }, [allowApproveWithoutComment, isPendingView, mounted]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!showPreview && previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
      setPreviewDocument(null);
    }
  }, [showPreview]);

  const loadDocuments = useCallback(async () => {
    const requestId = ++lastRequestIdRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        soloActivos: "true",
      });

      if (isAuthorizedRejectedView) {
        params.append("estatus", "4");
      }

      if (nameFilter) {
        params.append("nombreDocumento", nameFilter);
      }

      if (userFilter) {
        params.append("subidoPorUsuario", userFilter);
      }

      if (startDate) {
        params.append("fechaSubidaDesde", startDate.toISOString());
      }

      if (endDate) {
        params.append("fechaSubidaHasta", endDate.toISOString());
      }

      const path = `/sigma/pdf-signature/listar-documento?${params}`;

      const result = await get<{ data?: RawDocumentoApi[] }>(path);

      const docs: Document[] = (result.data || [])
        .map((doc: RawDocumentoApi): Document => ({
        id: String(doc.Id ?? doc.id ?? ""),
        name: doc.NombreArchivo || doc.nombreArchivo || "",
        type: doc.MimeType || doc.mimeType || "application/pdf",
        size: doc.TamanoBytes || doc.tamanoBytes || 0,
        uploadedBy: doc.SubidoPorUsuario || doc.subidoPorUsuario || "",
        uploadDate: new Date(
          doc.FechaSubida ?? doc.fechaSubida ?? ""
        ),
        status:
          (doc.Estatus ?? doc.estatus) === 2
            ? "approved"
            : (doc.Estatus ?? doc.estatus) === 3
              ? "rejected"
              : "pending",
        customName: doc.NombreArchivo || doc.nombreArchivo,
        observations: doc.ComentariosSubida || doc.comentariosSubida || "",
        attentionComments: doc.ComentariosDecision || doc.comentariosDecision || "",
        attentionDate: doc.FechaAutorizacion ?? doc.fechaAutorizacion
          ? new Date((doc.FechaAutorizacion ?? doc.fechaAutorizacion) as string)
          : undefined,
        fileUrl: "",
        tieneDocumentoLigado: doc.TieneDocumentoLigado || doc.tieneDocumentoLigado || false,
      }))
        .filter((doc: Document) => shouldFilterDocumentByMode(doc, mode));

      if (requestId !== lastRequestIdRef.current) {
        return;
      }

      setDocuments(docs);
    } catch (error) {
      console.error("bandeja loadDocuments: Error loading documents:", error);
      if (requestId === lastRequestIdRef.current) {
        toast.error("Error al cargar los documentos");
      }
    } finally {
      if (requestId === lastRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    isAuthorizedRejectedView,
    nameFilter,
    userFilter,
    startDate,
    endDate,
    mode,
  ]);

  useEffect(() => {
    if (!mounted || !isAuthenticated) return;
    loadDocuments();
  }, [mounted, isAuthenticated, loadDocuments]);

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

  const sendEmailNotificationInBackground = (documentId: string) => {
    post(`/email/documentos/notificar/${documentId}`).catch((error: unknown) => {
      console.error("Error enviando notificación de email en segundo plano:", error);
    });
  };

  const handlePreview = async (document: Document, mostrarDocumentoSoporte?: boolean) => {
    const showSupport = mostrarDocumentoSoporte !== undefined 
      ? mostrarDocumentoSoporte 
      : false;
    
    setLoadingDocumentId(document.id);
    try {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }

      const path = `/sigma/pdf-signature/pdf/${document.id}?descargar=true&mostrarDocumentoSoporte=${showSupport}`;

      const blob = await getBlob(path);
      if (!blob || blob.size === 0) {
        throw new Error("El documento está vacío");
      }

      const fileName = `${document.id}.pdf`;
      const file = new File([blob], fileName, {
        type: blob.type || document.type || "application/pdf",
        lastModified: Date.now(),
      });

      const blobUrl = URL.createObjectURL(file);
      previewUrlRef.current = blobUrl;

      const doc: Document = {
        ...document,
        type: blob.type || document.type || "application/pdf",
        size: blob.size || document.size,
        fileUrl: blobUrl,
      };

      setPreviewDocument(doc);
      setShowPreview(true);
    } catch (error) {
      console.error("Error loading document:", error);
      alert("Error al cargar el documento");
    } finally {
      setLoadingDocumentId(null);
    }
  };

  const handleDocumentLoad = async (documentId: string, mostrarDocumentoSoporte: boolean) => {
    const document = documents.find(doc => doc.id === documentId);
    if (document) {
      await handlePreview(document, mostrarDocumentoSoporte);
    }
  };

  const handleApprove = async (document: Document) => {
    setSelectedDocument(document);
    setApproveComment("");

    if (allowApproveWithoutComment) {
      setLoadingDocumentId(document.id);
      toast.info("Procesando autorización...", {
        duration: 2000,
      });
      try {
        await approveDocumentAPI(document, "");
      } finally {
        setLoadingDocumentId(null);
      }
      return;
    }

    setShowApproveDialog(true);
  };

  const confirmApprove = async () => {
    if (!selectedDocument) return;

    const comment = approveComment.trim();
    setLoadingDocumentId(selectedDocument.id);
    try {
      await approveDocumentAPI(selectedDocument, comment);
    } finally {
      setLoadingDocumentId(null);
    }
  };

  const approveDocumentAPI = async (document: Document, comment: string) => {
    setIsApproving(true);
    try {
      const user =
        auth.getUserWithDomain() || auth.getUser() || "sistemas";

      try {
        await post("/sigma/pdf-signature/autorizar-documento", {
          idDocumento: document.id,
          usuario: user,
          motivo: comment || null,
        });
      } catch (error) {
        const errorCode =
          error instanceof SigmaHttpError
            ? (error.body as { errorCode?: string } | undefined)?.errorCode
            : undefined;

        if (errorCode === "KEYWORD_NOT_FOUND") {
          const palabraClave =
            import.meta.env.VITE_DOCUMENTOS_PALABRA_REEMPLAZAR ||
            "firmad";
          toast.error("Palabra clave no encontrada", {
            description: `El PDF no contiene la palabra clave requerida: "${palabraClave}". Por favor, verifica que el documento contenga esta palabra antes de intentar autorizarlo.`,
            duration: 6000,
          });
          setShowApproveDialog(false);
          return;
        }

        throw error;
      }

      sendEmailNotificationInBackground(document.id);

      await loadDocuments();
      setShowApproveDialog(false);
      setSelectedDocument(null);
      setApproveComment("");
      toast.success("Documento aprobado exitosamente", {
        description: `El documento "${document?.customName || document?.name}" ha sido aprobado.`,
      });
    } catch (error) {
      console.error("Error approving document:", error);
      toast.error(
        error instanceof Error ? error.message : "Error al aprobar el documento"
      );
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = (document: Document) => {
    setSelectedDocument(document);
    setRejectComment("");
    setShowRejectDialog(true);
  };

  const confirmReject = async () => {
    if (!selectedDocument) return;

    if (!rejectComment.trim()) {
      toast.error("El motivo del rechazo es obligatorio");
      return;
    }

    setIsRejecting(true);
    setLoadingDocumentId(selectedDocument.id);
    try {
      const user =
        auth.getUserWithDomain() || auth.getUser() || "sistemas";

      await post("/sigma/pdf-signature/rechazar-documento", {
        idDocumento: selectedDocument.id,
        usuario: user,
        motivo: rejectComment,
      });

      sendEmailNotificationInBackground(selectedDocument.id);

      await loadDocuments();
      setShowRejectDialog(false);
      setSelectedDocument(null);
      setRejectComment("");
      toast.success("Documento rechazado", {
        description: `El documento "${selectedDocument?.customName || selectedDocument?.name}" ha sido rechazado.`,
      });
    } catch (error) {
      console.error("Error rejecting document:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Error al rechazar el documento"
      );
    } finally {
      setIsRejecting(false);
      setLoadingDocumentId(null);
    }
  };

  const handleExportToExcel = () => {
    if (documents.length === 0) {
      alert("No hay documentos para exportar");
      return;
    }

    const excelData = documents.map((doc) => ({
      Nombre: doc.customName || doc.name,
      "Nombre Original": doc.name,
      Tipo: doc.type,
      "Tamaño (bytes)": doc.size,
      "Subido por": doc.uploadedBy,
      "Fecha de Subida": new Date(doc.uploadDate).toLocaleString("es-ES"),
      Estado:
        doc.status === "pending"
          ? "Pendiente"
          : doc.status === "approved"
            ? "Aprobado"
            : doc.status === "rejected"
              ? "Rechazado"
              : doc.status,
      Observaciones: doc.observations || "",
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Documentos");

    const colWidths = [
      { wch: 30 }, 
      { wch: 30 }, 
      { wch: 20 }, 
      { wch: 15 }, 
      { wch: 20 }, 
      { wch: 20 }, 
      { wch: 15 }, 
      { wch: 40 }, 
    ];
    ws["!cols"] = colWidths;

    const fileName = `bandeja_${mode === "pending" ? "pendientes" : "autorizados_rechazados"}_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const columns = createBandejaColumns(
    {
      onPreview: handlePreview,
      onApprove: handleApprove,
      onReject: handleReject,
      loadingDocumentId: loadingDocumentId,
      showAttentionComments: isAuthorizedRejectedView,
    },
    { includeActions: isPendingView }
  );

  const isPreviewDocumentLoading =
    previewDocument && loadingDocumentId === previewDocument.id;
  const isPreviewDocumentApproving =
    !!previewDocument &&
    !!selectedDocument &&
    previewDocument.id === selectedDocument.id &&
    isApproving;
  const isPreviewDocumentRejecting =
    !!previewDocument &&
    !!selectedDocument &&
    previewDocument.id === selectedDocument.id &&
    isRejecting;

  return (
    <SidebarProvider>
        <div className={showPreview ? "invisible" : ""}>
          <AppSidebar />
        </div>
        <SidebarInset className={showPreview ? "invisible" : ""}>
          <Navbar />
          <main className="flex-1 p-3">
            <div className="space-y-1">
              <div className="py-0.5">
                <h1 className="text-base font-bold leading-tight">{pageTitle}</h1>
                <p className="text-muted-foreground text-xs mt-0 leading-tight">
                  {pageDescription}
                </p>
              </div>

              <Card className="w-full">
                <CardHeader className="py-1 pb-0.5 px-3">
                  <CardTitle className="text-xs font-semibold">Filtros</CardTitle>
                </CardHeader>
              <CardContent className="pb-1 pt-0.5 px-3">
                <div className="grid grid-cols-1 gap-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="userFilter" className="text-xs">Usuario</Label>
                    <Select
                      value={userFilter ?? ALL_USERS_VALUE}
                      onValueChange={(value) =>
                        setUserFilter(value === ALL_USERS_VALUE ? undefined : value)
                      }
                      disabled={loadingUsers}
                    >
                      <SelectTrigger id="userFilter" className="w-full h-7 text-xs">
                        <SelectValue
                          placeholder={
                            loadingUsers
                              ? "Cargando usuarios..."
                              : "Todos los usuarios"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_USERS_VALUE}>
                          Todos los usuarios
                        </SelectItem>
                        {userOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-0.5">
                    <Label htmlFor="startDate" className="text-xs">Desde</Label>
                    <DatePicker
                      value={toDateInputValue(startDate)}
                      onChange={(value) =>
                        setStartDate(value ? new Date(`${value}T00:00:00`) : undefined)
                      }
                      placeholder="Fecha inicio"
                      className="h-7 text-xs"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <Label htmlFor="endDate" className="text-xs">Hasta</Label>
                    <DatePicker
                      value={toDateInputValue(endDate)}
                      onChange={(value) =>
                        setEndDate(value ? new Date(`${value}T23:59:59.999`) : undefined)
                      }
                      placeholder="Fecha fin"
                      className="h-7 text-xs"
                    />
                  </div>
                   <div className="space-y-0.5">
                    <Label htmlFor="nameFilter" className="text-xs ">ID</Label>
                    <Input
                      id="nameFilter"
                      placeholder="ID del documento..."
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>

                {(nameFilter || startDate || endDate || userFilter) && (
                  <Badge
                    variant="outline"
                    className="btn-limpiar-filtros inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium text-primary border-primary/30 shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setNameFilter("");
                        setUserFilter(undefined);
                        setStartDate(createDefaultStartDate());
                        setEndDate(createDefaultEndDate());
                      }}
                      className="inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      Limpiar filtros
                    </button>
                  </Badge>
                )}
              </CardContent>
            </Card>

            <div className="space-y-1">
              <div className="flex items-center gap-3 py-0.5">
                <div>
                  <h2 className="text-xs font-semibold inline mr-1">  {loading
                      ? "0"
                      : `${documents.length} documentos`} </h2>
                   <span className="text-muted-foreground text-xs leading-tight">
                    encontrado(s)
                  </span>
                </div>
                {isPendingView && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label
                        htmlFor="allowApproveWithoutComment"
                        className="hover:bg-accent/50 flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium leading-tight cursor-pointer transition-colors has-[[aria-checked=true]]:border-primary has-[[aria-checked=true]]:bg-primary/10 dark:has-[[aria-checked=true]]:bg-primary/20"
                      >
                        <Checkbox
                          id="allowApproveWithoutComment"
                          checked={allowApproveWithoutComment}
                          onCheckedChange={(checked) =>
                            setAllowApproveWithoutComment(checked as boolean)
                          }
                          className="size-4 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                        />
                        <span>Aprobar sin comentarios</span>
                      </Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Permite aprobar documentos sin requerir comentarios</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className={loading ? "pointer-events-none opacity-60" : ""}>
                {loading && (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-xs text-muted-foreground">Cargando documentos...</span>
                  </div>
                )}
                <DataTable
                  columns={columns}
                  data={documents}
                  bottomActions={
                    <Button
                      onClick={handleExportToExcel}
                      variant="outline"
                      className="h-7 text-xs gap-1.5"
                      disabled={documents.length === 0}
                    >
                      <FileSpreadsheet className="h-3 w-3" />
                      Exportar a Excel
                    </Button>
                  }
                />
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>

      {}
      <PDFPreviewDialog
        document={previewDocument}
        open={showPreview}
        onOpenChange={setShowPreview}
        onApprove={handleApprove}
        onReject={handleReject}
        isApproving={isPreviewDocumentApproving}
        isRejecting={isPreviewDocumentRejecting}
        isDocumentBusy={!!isPreviewDocumentLoading}
        onDocumentLoad={handleDocumentLoad}
      />

      {}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Aprobar Documento</DialogTitle>
            <DialogDescription>
              ¿Está seguro de aprobar el documento "
              {selectedDocument?.customName || selectedDocument?.name}"?
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-1">
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="approveComment">Comentario (Opcional)</Label>
                <Textarea
                  id="approveComment"
                  value={approveComment}
                  onChange={(e) => setApproveComment(e.target.value)}
                  placeholder="Agregar comentario sobre la aprobación..."
                  rows={4}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isApproving}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={confirmApprove}
              disabled={isApproving || !isPendingView}
            >
              {isApproving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isApproving ? "Aprobando..." : "Aprobar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Rechazar Documento</DialogTitle>
            <DialogDescription>
              ¿Está seguro de rechazar el documento "
              {selectedDocument?.customName || selectedDocument?.name}"?
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-1">
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="rejectComment">
                  Motivo del Rechazo <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="rejectComment"
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  placeholder="Explique el motivo del rechazo..."
                  rows={4}
                  required
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isRejecting}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmReject}
              disabled={!rejectComment.trim() || isRejecting}
            >
              {isRejecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isRejecting ? "Rechazando..." : "Rechazar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

export default function Bandeja() {
  return (
    <BandejaView
      mode="pending"
      pageTitle="Documentos pendientes por firmar"
      pageDescription="Gestiona y autoriza los documentos que requieren firma"
    />
  );
}

export function BandejaAutorizadosRechazados() {
  return (
    <BandejaView
      mode="authorizedRejected"
      pageTitle="Documentos autorizados / rechazados"
      pageDescription="Consulta el historial de documentos ya atendidos"
    />
  );
}
