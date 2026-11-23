import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Upload,
  FileText,
  X,
  FileSpreadsheet,
  AlertCircle,
  FileCheck,
  Info,
  Trash2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { auth } from "@/apps/sigma/lib/auth";
import {
  SigmaHttpError,
  del,
  get,
  getBlob,
  post,
  postForm,
} from "@/apps/sigma/lib/httpClient";
import { type Document, type RawDocumentoApi } from "@/apps/sigma/lib/documents";
import { DataTable } from "@/apps/sigma/components/documents/data-table";
import { createSubidaColumns } from "@/apps/sigma/components/documents/subida-columns";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";

const toDateInputValue = (date?: Date) =>
  date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate()
      ).padStart(2, "0")}`
    : null;

interface FileWithMetadata {
  file: File;
  customName: string;
  observations: string;
  correoCC: string;
  tieneDocumentoSoporte: boolean;
  archivoSoporte?: File;
}

// Caracteres que un nombre de archivo no admite en Windows (los de control tampoco).
const CARACTERES_NO_VALIDOS_EN_NOMBRE = '<>:"/\\|?*';

const limpiarNombreArchivo = (valor: string) =>
  Array.from(valor)
    .filter(
      (caracter) =>
        caracter.charCodeAt(0) >= 0x20 &&
        !CARACTERES_NO_VALIDOS_EN_NOMBRE.includes(caracter)
    )
    .join("")
    .replace(/[. ]+$/, "");

export default function SubidaDocumentos() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<FileWithMetadata[]>([]);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [tempFiles, setTempFiles] = useState<File[]>([]);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loadingDocumentId, setLoadingDocumentId] = useState<string | null>(
    null
  );
  const [showKeywordErrorDialog, setShowKeywordErrorDialog] = useState(false);
  const [keywordErrorFiles, setKeywordErrorFiles] = useState<string[]>([]);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const previewUrlRef = useRef<string | null>(null);

  // Filtros
  const [nameFilter, setNameFilter] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    // Calcular el lunes de la semana pasada
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
    const daysToSubtract = dayOfWeek === 0 ? 13 : dayOfWeek + 6; // Si es domingo, retroceder 13 días, sino día actual + 6
    const lastMonday = new Date(today);
    lastMonday.setDate(today.getDate() - daysToSubtract);
    lastMonday.setHours(0, 0, 0, 0);
    return lastMonday;
  });
  const [endDate, setEndDate] = useState<Date | undefined>(() => {
    // Fecha de hoy
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return today;
  });
  const [onlyPending, setOnlyPending] = useState(false); // Por defecto false para mostrar todos los documentos

  useEffect(() => {
    // Verificar autenticación solo en el cliente
    const authenticated = auth.isAuthenticated();
    setIsAuthenticated(authenticated);
    setMounted(true);

    if (!authenticated) {
      navigate("/SIGMA");
    }
  }, [navigate]);

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
    try {
      const userIdentifier = auth.getUserWithDomain() || auth.getUser();
      if (!userIdentifier) return;

      // Construir parámetros de consulta
      const params = new URLSearchParams({
        subidoPorUsuario: userIdentifier,
        soloActivos: "true",
      });

      // El procedimiento usa @Estatus=1 como «todos» y sin valor como «solo
      // pendientes»: para el filtro «solo pendientes» se omite el parámetro y
      // para «todos» se manda 1.
      if (!onlyPending) {
        params.append("estatus", "1");
      }

      if (nameFilter) {
        params.append("nombreDocumento", nameFilter);
      }

      if (startDate) {
        params.append("fechaSubidaDesde", startDate.toISOString());
      }

      if (endDate) {
        params.append("fechaSubidaHasta", endDate.toISOString());
      }

      const result = await get<{ data?: RawDocumentoApi[] }>(
        `/sigma/pdf-signature/listar-documento?${params}`
      );

      const docs: Document[] = (result.data || []).map(
        (doc: RawDocumentoApi): Document => {
          const estatus = doc.Estatus ?? doc.estatus;
          const fechaAutorizacion = doc.FechaAutorizacion ?? doc.fechaAutorizacion;

          return {
            id: String(doc.Id ?? doc.id ?? ""),
            name: doc.NombreArchivo || doc.nombreArchivo || "",
            type: doc.MimeType || doc.mimeType || "application/pdf",
            size: doc.TamanoBytes || doc.tamanoBytes || 0,
            uploadedBy: doc.SubidoPorUsuario || doc.subidoPorUsuario || "",
            uploadDate: new Date(doc.FechaSubida || doc.fechaSubida || ""),
            status:
              estatus === 1
                ? "pending"
                : estatus === 2
                  ? "approved"
                  : estatus === 3
                    ? "rejected"
                    : "pending",
            customName: doc.NombreArchivo || doc.nombreArchivo,
            observations: doc.ComentariosSubida || doc.comentariosSubida || "",
            attentionComments:
              doc.ComentariosDecision || doc.comentariosDecision || "",
            attentionDate: fechaAutorizacion
              ? new Date(fechaAutorizacion)
              : undefined,
            fileUrl: "",
            tieneDocumentoLigado:
              doc.TieneDocumentoLigado || doc.tieneDocumentoLigado || false,
          };
        }
      );

      setDocuments(docs);
    } catch (error) {
      console.error("Error loading documents:", error);
      alert("Error al cargar los documentos");
    }
  }, [onlyPending, nameFilter, startDate, endDate]);

  // Cargar documentos al montar, al autenticarse y cuando cambian los filtros
  useEffect(() => {
    if (mounted && isAuthenticated) {
      loadDocuments();
    }
  }, [mounted, isAuthenticated, loadDocuments]);

  // Mostrar loading mientras se monta el componente
  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  // Si no está autenticado, no mostrar nada mientras redirige
  if (!isAuthenticated) {
    return null;
  }

  // Función para enviar notificación en segundo plano (fire and forget)
  const sendEmailNotificationInBackground = (documentId: string, soloCC: boolean = false) => {
    const path = soloCC
      ? `/email/documentos/notificar/${documentId}?soloCC=true`
      : `/email/documentos/notificar/${documentId}`;

    // Enviar en segundo plano sin esperar respuesta
    post(path).catch((error: unknown) => {
      // Solo registrar el error sin afectar la UX del usuario
      console.error("Error enviando notificación de email en segundo plano:", error);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);

      // Filtrar solo archivos PDF
      const pdfFiles = newFiles.filter(
        (file) => file.type === "application/pdf"
      );

      // Mostrar alerta si se intentaron subir archivos que no son PDF
      if (pdfFiles.length !== newFiles.length) {
        alert(
          `Solo se permiten archivos PDF. Se ignoraron ${newFiles.length - pdfFiles.length} archivo(s).`
        );
      }

      if (pdfFiles.length > 0) {
        // Mostrar diálogo directamente sin escaneo previo
        setTempFiles(pdfFiles);
        setCurrentFileIndex(0);
        setShowDialog(true);
      }
    }
  };

  const handleDialogSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const customName = formData.get("customName") as string;
    const observations = formData.get("observations") as string;
    const correoCC = formData.get("correoCC") as string;
    const tieneDocumentoSoporte = formData.get("tieneDocumentoSoporte") === "on";
    const archivoSoporteInput = formData.get("archivoSoporte") as File | null;

    // Validar que el motivo de subida no esté vacío
    if (!observations || !observations.trim()) {
      alert("El motivo de subida es obligatorio");
      return;
    }

    // Validar formato de correos CC si se proporcionaron
    if (correoCC && correoCC.trim()) {
      const emails = correoCC.split(';').map(e => e.trim()).filter(e => e);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = emails.filter(email => !emailRegex.test(email));

      if (invalidEmails.length > 0) {
        alert(`Los siguientes correos no son válidos: ${invalidEmails.join(', ')}`);
        return;
      }
    }

    // Validar que si el checkbox está marcado, se haya seleccionado un archivo
    if (tieneDocumentoSoporte && (!archivoSoporteInput || archivoSoporteInput.size === 0)) {
      alert("Debe seleccionar un documento de soporte");
      return;
    }

    // Validar que el archivo de soporte sea PDF
    if (tieneDocumentoSoporte && archivoSoporteInput && archivoSoporteInput.type !== "application/pdf") {
      alert("El documento de soporte debe ser un archivo PDF");
      return;
    }

    const currentFile = tempFiles[currentFileIndex];
    const nombreLimpio = limpiarNombreArchivo(customName ?? "").trim();

    // Agregar el archivo
    const fileWithMetadata: FileWithMetadata = {
      file: currentFile,
      customName: nombreLimpio || currentFile.name,
      observations: observations.trim(),
      correoCC: correoCC.trim(),
      tieneDocumentoSoporte,
      archivoSoporte: tieneDocumentoSoporte && archivoSoporteInput ? archivoSoporteInput : undefined,
    };

    setFiles((prev) => [...prev, fileWithMetadata]);

    // Si hay más archivos, mostrar el siguiente
    if (currentFileIndex < tempFiles.length - 1) {
      setCurrentFileIndex(currentFileIndex + 1);
      // Resetear el formulario se hará automáticamente al cambiar de archivo
    } else {
      // No hay más archivos, cerrar diálogo
      setShowDialog(false);
      setTempFiles([]);
      setCurrentFileIndex(0);

      // Limpiar el input de archivos
      const fileInput = document.getElementById("files") as HTMLInputElement;
      if (fileInput) {
        fileInput.value = "";
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (files.length === 0) {
      alert("Por favor selecciona al menos un archivo");
      return;
    }

    setUploading(true);

    try {
      const fullUser = auth.getFullUser();

      const filesWithKeywordError: string[] = [];
      const filesWithOtherErrors: Array<{name: string, error: string}> = [];
      let successCount = 0;

      // Subir cada archivo a la API
      for (const fileWithMeta of files) {
        try {
          const formData = new FormData();
          formData.append(
            "nombre",
            fileWithMeta.customName || fileWithMeta.file.name
          );
          const userIdentifier =
            auth.getUserWithDomain() || fullUser?.username || "anonimo";

          formData.append("usuario", userIdentifier);
          formData.append("comentario", fileWithMeta.observations || "");
          formData.append("archivo", fileWithMeta.file);

          // Agregar correo del usuario autenticado (campo principal)
          const userEmail = auth.getFullUser()?.correo || "";
          if (userEmail) {
            formData.append("correo", userEmail);
          }

          // Agregar correos en copia (CC) si existen
          if (fileWithMeta.correoCC) {
            formData.append("correoCC", fileWithMeta.correoCC);
          }

          // Agregar documento de soporte si existe
          formData.append("tieneDocumentoSoporte", fileWithMeta.tieneDocumentoSoporte.toString());
          if (fileWithMeta.tieneDocumentoSoporte && fileWithMeta.archivoSoporte) {
            formData.append("archivoSoporte", fileWithMeta.archivoSoporte);
          }

          const created = await postForm<{ data?: { idDocumento?: string } }>(
            "/sigma/pdf-signature/subir-documento",
            formData
          );

          // Archivo subido exitosamente
          successCount++;

          // Obtener el ID del documento de la respuesta
          try {
            const documentId = created?.data?.idDocumento;

            // Enviar notificación por email si hay correos CC y se obtuvo el ID del documento
            if (documentId && fileWithMeta.correoCC) {
              sendEmailNotificationInBackground(documentId, true);
            }
          } catch (error) {
            // Si no se puede obtener el ID, solo registrar el error sin afectar el flujo
            console.error("Error al obtener ID del documento para notificación:", error);
          }
        } catch (error) {
          const body = error instanceof SigmaHttpError ? error.body : undefined;
          const errorCode =
            (body as { errorCode?: string } | undefined)?.errorCode ??
            (body as { data?: { errorCode?: string } } | undefined)?.data
              ?.errorCode;
          if (errorCode === "KEYWORD_NOT_FOUND") {
            filesWithKeywordError.push(
              fileWithMeta.customName || fileWithMeta.file.name
            );
            continue;
          }

          console.error(`Error uploading file ${fileWithMeta.file.name}:`, error);
          filesWithOtherErrors.push({
            name: fileWithMeta.customName || fileWithMeta.file.name,
            error: error instanceof Error ? error.message : "Error desconocido"
          });
        }
      }

      // Recargar documentos
      await loadDocuments();

      // Limpiar archivos seleccionados
      setFiles([]);

      // Limpiar el input de archivos
      const fileInput = document.getElementById("files") as HTMLInputElement;
      if (fileInput) {
        fileInput.value = "";
      }

      // Mostrar resultados
      if (filesWithKeywordError.length > 0) {
        setKeywordErrorFiles(filesWithKeywordError);
        setShowKeywordErrorDialog(true);
      }

      if (filesWithOtherErrors.length > 0) {
        const errorList = filesWithOtherErrors.map(f => `- ${f.name}: ${f.error}`).join('\n');
        setErrorMessage(`Los siguientes archivos tuvieron errores:\n\n${errorList}`);
        setShowErrorDialog(true);
      }

      if (successCount > 0) {
        alert(`${successCount} archivo(s) subido(s) exitosamente`);
      }

      if (successCount === 0 && filesWithKeywordError.length === 0 && filesWithOtherErrors.length === 0) {
        throw new Error("No se pudo subir ningún archivo");
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Error al subir los archivos"
      );
      setShowErrorDialog(true);
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handlePreview = async (document: Document, mostrarDocumentoSoporte?: boolean) => {
    // Si no se especifica mostrarDocumentoSoporte, usar false por defecto (documento original)
    const showSupport = mostrarDocumentoSoporte !== undefined 
      ? mostrarDocumentoSoporte 
      : false;
    
    setLoadingDocumentId(document.id);
    try {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }

      const fetchUrl = `/sigma/pdf-signature/pdf/${document.id}?descargar=true&mostrarDocumentoSoporte=${showSupport}`;

      const blob = await getBlob(fetchUrl);
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

  const handleDelete = async (document: Document) => {
    if (
      !confirm(
        `¿Estás seguro de eliminar el documento "${document.customName || document.name}"?`
      )
    ) {
      return;
    }

    try {
      await del<{ success: boolean }>(
        `/sigma/pdf-signature/eliminar-documento/${document.id}`
      );

      alert("Documento eliminado exitosamente");
      await loadDocuments();
    } catch (error) {
      console.error("handleDelete: Error deleting document:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Error al eliminar el documento"
      );
    }
  };

  const handleExportToExcel = () => {
    if (documents.length === 0) {
      alert("No hay documentos para exportar");
      return;
    }

    // Preparar datos para Excel
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

    // Crear libro de trabajo
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Documentos");

    // Ajustar ancho de columnas
    const colWidths = [
      { wch: 30 }, // Nombre
      { wch: 30 }, // Nombre Original
      { wch: 20 }, // Tipo
      { wch: 15 }, // Tamaño
      { wch: 20 }, // Subido por
      { wch: 20 }, // Fecha
      { wch: 15 }, // Estado
      { wch: 40 }, // Observaciones
    ];
    ws["!cols"] = colWidths;

    // Descargar archivo
    const fileName = `mis_documentos_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const columns = createSubidaColumns({
    onPreview: handlePreview,
    onDelete: handleDelete,
    onRefresh: loadDocuments,
    loadingDocumentId: loadingDocumentId,
  });

  return (
    <SidebarProvider>
        <div className={showPreview ? "invisible" : ""}>
          <AppSidebar />
        </div>
        <SidebarInset className={showPreview ? "invisible" : ""}>
          <Navbar />
          <main className="flex-1 p-3">
            <div className="space-y-1 max-w-full">
              <div className="py-0.5">
                <div className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  <h1 className="text-base font-bold leading-tight">Subida de Documentos</h1>
                </div>
                <p className="text-muted-foreground text-xs mt-0 leading-tight">
                  Sube tus archivos y documentos de forma segura
                </p>
              </div>
<Card>
              <CardHeader className="py-2 pb-1 px-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">Selecciona tus archivos PDF</CardTitle>
                </div>
                <CardDescription className="text-xs leading-tight">
                  Solo se permiten archivos PDF. Puedes subir múltiples archivos a la vez
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2 pt-1 px-3">
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="files" className="text-xs">Archivos PDF</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="files"
                        type="file"
                        accept=".pdf,application/pdf"
                        multiple
                        onChange={handleFileChange}
                        className="flex-1 h-8 text-xs"
                        disabled={uploading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          document.getElementById("files")?.click()
                        }
                        disabled={uploading}
                        className="h-8 w-8"
                      >
                        <Upload className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {uploading && (
                    <div className="flex items-center justify-center p-4 border rounded-lg bg-muted/50">
                      <div className="flex flex-col items-center gap-2">
                        <Spinner className="h-6 w-6" />
                        <div className="text-center">
                          <p className="text-xs font-medium">
                            Procesando archivos...
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Subiendo {files.length} archivo(s) al servidor
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {files.length > 0 && !uploading && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Archivos seleccionados ({files.length})</Label>
                      <div className="space-y-1.5">
                        {files.map((fileWithMeta, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 border rounded-lg bg-muted/50"
                          >
                            <div className="flex items-center gap-2 flex-1">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <div className="flex-1">
                                <p className="text-xs font-medium">
                                  {fileWithMeta.customName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(fileWithMeta.file.size)}
                                  {fileWithMeta.observations &&
                                    " • " +
                                      fileWithMeta.observations.substring(
                                        0,
                                        100
                                      ) +
                                      (fileWithMeta.observations.length > 100
                                        ? "..."
                                        : "")}
                                  {fileWithMeta.tieneDocumentoSoporte &&
                                    " • Con soporte"}
                                </p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFile(index)}
                              disabled={uploading}
                              className="h-7 w-7"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-8 text-xs"
                    disabled={files.length === 0 || uploading}
                  >
                    {uploading ? (
                      <>
                        <Spinner className="mr-2 h-3 w-3" />
                        Subiendo {files.length} archivo(s)...
                      </>
                    ) : (
                      `Subir ${files.length} archivo(s)`
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-1.5 pb-1 px-3">
                <div className="flex items-center gap-2">
                  <Info className="h-3 w-3 text-muted-foreground" />
                  <CardTitle className="text-xs font-semibold">Filtros</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pb-1 pt-0.5 px-3">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-1">
                  <div className="space-y-0.5">
                    <Label htmlFor="nameFilter" className="text-xs">Buscar por id</Label>
                    <Input
                      id="nameFilter"
                      placeholder="Nombre del documento..."
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <Label htmlFor="startDate" className="text-xs">Fecha desde</Label>
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
                    <Label htmlFor="endDate" className="text-xs">Fecha hasta</Label>
                    <DatePicker
                      value={toDateInputValue(endDate)}
                      onChange={(value) =>
                        setEndDate(value ? new Date(`${value}T23:59:59.999`) : undefined)
                      }
                      placeholder="Fecha fin"
                      className="h-7 text-xs"
                    />
                  </div>

                  <div className="flex items-end">
                    <Label
                      htmlFor="onlyPending"
                      className="hover:bg-accent/50 inline-flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium leading-tight cursor-pointer transition-colors has-[[aria-checked=true]]:border-primary has-[[aria-checked=true]]:bg-primary/10 dark:has-[[aria-checked=true]]:bg-primary/20"
                    >
                      <Checkbox
                        id="onlyPending"
                        checked={onlyPending}
                        onCheckedChange={(checked) =>
                          setOnlyPending(checked as boolean)
                        }
                        className="size-4 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                      />
                      <span>Todos</span>
                    </Label>
                  </div>
                </div>

                {(nameFilter || startDate || endDate) && (
                  <Badge
                    variant="outline"
                    className="btn-limpiar-filtros inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium text-primary border-primary/30 shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setNameFilter("");
                        setStartDate(undefined);
                        setEndDate(undefined);
                        setOnlyPending(false);
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
              <div className="flex flex-wrap items-center gap-2 py-0.5">
                <h2 className="text-xs font-semibold leading-tight">
                  Mis Documentos
                </h2>
                <span className="text-muted-foreground text-xs leading-tight">
                  {documents.length} documento(s)
                </span>
              </div>
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
        </main>
      </SidebarInset>

      {/* Diálogo para agregar metadata a cada archivo */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0">
          <form onSubmit={handleDialogSubmit} data-scan-form="true" key={currentFileIndex} className="flex flex-col h-full">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>
                Información del archivo ({currentFileIndex + 1} de{" "}
                {tempFiles.length})
              </DialogTitle>
              <DialogDescription>
                Agrega un nombre personalizado y observaciones para:{" "}
                <span className="font-medium">
                  {tempFiles[currentFileIndex]?.name}
                </span>
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 px-6">
              <div className="grid gap-4 py-4">
              <div className="grid gap-3">
                <Label htmlFor="customName">
                  Nombre personalizado
                  <span className="text-muted-foreground text-xs ml-2">
                    (Opcional)
                  </span>
                </Label>
                <Input
                  id="customName"
                  name="customName"
                  key={`customName-${currentFileIndex}`}
                  defaultValue={tempFiles[currentFileIndex]?.name.replace(
                    ".pdf",
                    ""
                  )}
                  placeholder="Ej: Contrato de servicios 2024"
                  autoFocus
                  onInput={(e) => {
                    const limpio = limpiarNombreArchivo(e.currentTarget.value);
                    if (limpio !== e.currentTarget.value) {
                      e.currentTarget.value = limpio;
                    }
                  }}
                />
                <p className="text-[11px] text-muted-foreground">
                  No se permiten los caracteres &lt; &gt; : " / \ | ? *
                </p>
              </div>
              <div className="grid gap-3">
                <Label htmlFor="observations">
                  Motivo de solicitud de autorización
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <Textarea
                  id="observations"
                  name="observations"
                  key={`observations-${currentFileIndex}`}
                  placeholder="Explique el motivo por el cual está subiendo este documento..."
                  rows={4}
                  required
                />
              </div>
              <div className="grid gap-3">
                <Label
                  htmlFor="tieneDocumentoSoporte"
                  className="hover:bg-accent/50 flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium cursor-pointer transition-colors has-[[aria-checked=true]]:border-primary has-[[aria-checked=true]]:bg-primary/10 dark:has-[[aria-checked=true]]:bg-primary/20"
                >
                  <Checkbox
                    id="tieneDocumentoSoporte"
                    name="tieneDocumentoSoporte"
                    key={`tieneDocumentoSoporte-${currentFileIndex}`}
                    onCheckedChange={(checked) => {
                      const container = document.getElementById(`archivoSoporteContainer-${currentFileIndex}`);
                      if (container) {
                        container.style.display = checked ? 'block' : 'none';
                      }
                      const fileInput = document.getElementById(`archivoSoporte-${currentFileIndex}`) as HTMLInputElement;
                      if (fileInput && !checked) {
                        fileInput.value = "";
                      }
                    }}
                    className="size-4 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                  />
                  <span className="flex items-center gap-1">
                    Se necesita documento de soporte
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">El documento de soporte es un documento adicional y principal que no requiere firma.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </span>
                </Label>
                <div id={`archivoSoporteContainer-${currentFileIndex}`} style={{ display: 'none' }}>
                  <Input
                    id={`archivoSoporte-${currentFileIndex}`}
                    name="archivoSoporte"
                    type="file"
                    accept=".pdf,application/pdf"
                    className="h-8 text-xs"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Archivo PDF adicional que no requiere firma
                  </p>
                </div>
              </div>
              <div className="grid gap-3">
                <Label htmlFor="correoCC">
                  Correos en copia (CC)
                  <span className="text-muted-foreground text-xs ml-2">
                    (Opcional)
                  </span>
                </Label>
                <Input
                  id="correoCC"
                  name="correoCC"
                  key={`correoCC-${currentFileIndex}`}
                  type="text"
                  placeholder="correo1@ejemplo.com;correo2@ejemplo.com"
                />
                <p className="text-xs text-muted-foreground">
                  Separa múltiples correos con punto y coma (;)
                </p>
              </div>
            </div>
            </div>
            <DialogFooter className="px-6 pb-6">
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDialog(false);
                    setTempFiles([]);
                    setCurrentFileIndex(0);
                    const fileInput = document.getElementById(
                      "files"
                    ) as HTMLInputElement;
                    if (fileInput) fileInput.value = "";
                  }}
                >
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit">
                {currentFileIndex < tempFiles.length - 1
                  ? "Siguiente"
                  : "Finalizar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de vista previa del PDF */}
      <PDFPreviewDialog
        document={previewDocument}
        open={showPreview}
        onOpenChange={setShowPreview}
        onDocumentLoad={handleDocumentLoad}
      />

      {/* AlertDialog para error de palabra clave no encontrada */}
      <AlertDialog
        open={showKeywordErrorDialog}
        onOpenChange={setShowKeywordErrorDialog}
      >
        <AlertDialogContent className="!max-w-[95%] sm:!max-w-[90%] max-h-[90vh] w-full flex flex-col p-0">
          <AlertDialogHeader className="px-6 pt-6">
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-6 w-6" />
              Palabra clave no encontrada
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              {keywordErrorFiles.length === 1 ? (
                <>
                  El documento{" "}
                  <span className="font-semibold text-foreground">
                    "{keywordErrorFiles[0]}"
                  </span>{" "}
                  no contiene la palabra clave requerida para que pueda ser firmado.
                </>
              ) : (
                <>
                  Los siguientes {keywordErrorFiles.length} documentos no contienen la palabra clave requerida:
                  <ul className="mt-2 ml-4 list-disc">
                    {keywordErrorFiles.map((fileName, idx) => (
                      <li key={idx} className="font-semibold text-foreground">
                        {fileName}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="overflow-y-auto flex-1 px-6">
            <div className="space-y-4">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <div className="flex items-start gap-3">
                <FileCheck className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm mb-2">
                    Corrija su documento
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Para que el documento pueda ser firmado automáticamente,
                    debe incluir la palabra clave{" "}
                    <code className="px-2 py-1 bg-muted rounded text-foreground font-mono text-xs">
                      {"#" +
                        import.meta.env.VITE_DOCUMENTOS_PALABRA_REEMPLAZAR ||
                        "#firmad"}
                    </code>{" "}
                    en el lugar donde desea que aparezca la firma.
                  </p>
                </div>
              </div>
            </div>

            {/* Ejemplo visual de documento */}
            <div className="border-4 border-blue-500 rounded-lg overflow-hidden bg-white shadow-lg">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-3 sm:px-6 py-3 sm:py-4">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-0">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white flex-shrink-0" />
                  <span className="text-sm sm:text-lg font-bold text-white">
                    📄 EJEMPLO DE DOCUMENTO CORRECTO
                  </span>
                </div>
                <span className="text-[10px] sm:text-xs text-blue-100 bg-blue-800 px-2 sm:px-3 py-1 rounded-full font-semibold inline-block mt-2 sm:mt-0">
                  PLANTILLA DE REFERENCIA
                </span>
              </div>

              <div
                className="p-4 sm:p-8 md:p-12 space-y-4 sm:space-y-5 bg-white overflow-x-auto"
                style={{ fontFamily: "'Times New Roman', Times, serif" }}
              >
                {/* Encabezado oficial */}
                <div className="border-b-2 border-gray-800 pb-3 sm:pb-4 mb-4 sm:mb-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-0 mb-3">
                    <div>
                      <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 tracking-wide">
                        ORDEN DE COMPRA
                      </h2>
                      <p className="text-[10px] sm:text-xs text-gray-600 mt-1">
                        DEPARTAMENTO DE ADQUISICIONES
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-[10px] sm:text-xs text-gray-600">
                        Folio:
                      </p>
                      <p className="text-base sm:text-lg font-bold text-gray-900">
                        OC-2024-1547
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-[10px] sm:text-xs mt-4">
                    <div>
                      <p className="text-gray-600">Fecha de emisión:</p>
                      <p className="font-semibold">08 de Octubre, 2025</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Fecha de entrega:</p>
                      <p className="font-semibold">22 de Octubre, 2025</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Moneda:</p>
                      <p className="font-semibold">MXN (Pesos Mexicanos)</p>
                    </div>
                  </div>
                </div>

                {/* Datos del proveedor */}
                <div className="bg-gray-50 border border-gray-300 rounded p-3 sm:p-4 mb-3 sm:mb-4">
                  <h3 className="text-xs sm:text-sm font-bold text-gray-900 mb-2">
                    DATOS DEL PROVEEDOR
                  </h3>
                  <div className="text-[10px] sm:text-xs space-y-1">
                    <p>
                      <span className="font-semibold">Razón Social:</span>{" "}
                      Tecnología y Sistemas Avanzados S.A. de C.V.
                    </p>
                    <p>
                      <span className="font-semibold">RFC:</span> TSA980512XY7
                    </p>
                    <p>
                      <span className="font-semibold">Dirección:</span> Av.
                      Insurgentes Sur 1234, Col. Del Valle, CDMX, C.P. 03100
                    </p>
                  </div>
                </div>

                {/* Tabla de artículos */}
                <div className="mb-4 sm:mb-6 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                  <table className="w-full min-w-[600px] border-collapse border border-gray-400 text-[10px] sm:text-xs">
                    <thead>
                      <tr className="bg-gray-800 text-white">
                        <th className="border border-gray-400 p-2 text-left">
                          Cant.
                        </th>
                        <th className="border border-gray-400 p-2 text-left">
                          Descripción
                        </th>
                        <th className="border border-gray-400 p-2 text-right">
                          Precio Unit.
                        </th>
                        <th className="border border-gray-400 p-2 text-right">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-400 p-2 text-center">
                          25
                        </td>
                        <td className="border border-gray-400 p-2">
                          Licencias de software empresarial - Suite
                          Productividad Pro
                        </td>
                        <td className="border border-gray-400 p-2 text-right">
                          $2,450.00
                        </td>
                        <td className="border border-gray-400 p-2 text-right font-semibold">
                          $61,250.00
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-400 p-2 text-center">
                          10
                        </td>
                        <td className="border border-gray-400 p-2">
                          Equipos de cómputo portátil modelo Pro-X15
                        </td>
                        <td className="border border-gray-400 p-2 text-right">
                          $18,500.00
                        </td>
                        <td className="border border-gray-400 p-2 text-right font-semibold">
                          $185,000.00
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-400 p-2 text-center">
                          50
                        </td>
                        <td className="border border-gray-400 p-2">
                          Servicios de mantenimiento preventivo anual
                        </td>
                        <td className="border border-gray-400 p-2 text-right">
                          $850.00
                        </td>
                        <td className="border border-gray-400 p-2 text-right font-semibold">
                          $42,500.00
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Totales */}
                <div className="flex justify-end mb-4 sm:mb-6">
                  <div className="w-full sm:w-64 space-y-2 text-xs sm:text-sm border border-gray-400 p-2 sm:p-3 bg-gray-50">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-semibold">$288,750.00</span>
                    </div>
                    <div className="flex justify-between">
                      <span>IVA (16%):</span>
                      <span className="font-semibold">$46,200.00</span>
                    </div>
                    <div className="flex justify-between border-t-2 border-gray-800 pt-2 text-base">
                      <span className="font-bold">TOTAL:</span>
                      <span className="font-bold">$334,950.00</span>
                    </div>
                  </div>
                </div>

                {/* Condiciones */}
                <p className="text-xs sm:text-sm text-gray-800 leading-relaxed text-justify">
                  <span className="font-bold">CONDICIONES COMERCIALES:</span> El
                  presente documento constituye una orden de compra formal bajo
                  los términos y condiciones establecidos en el contrato marco
                  número CM-2024-089. El proveedor se compromete a entregar los
                  bienes y servicios descritos en la fecha acordada, cumpliendo
                  con las especificaciones técnicas y estándares de calidad
                  previamente establecidos. El pago se realizará mediante
                  transferencia bancaria a 30 días fecha factura, previa entrega
                  de la documentación fiscal correspondiente.
                </p>

                <div className="mt-6 sm:mt-8 pt-3 sm:pt-4">
                  <p className="text-xs sm:text-sm text-gray-600 mb-6 sm:mb-8">
                    Atentamente,
                  </p>

                  {/* Área de firma centrada */}
                  <div className="flex justify-center mt-8 sm:mt-12 mb-6 sm:mb-8">
                    <div className="text-center">
                      <div className="bg-yellow-50 border-2 border-yellow-400 rounded px-3 sm:px-4 py-2 sm:py-3 mb-2 sm:mb-3 inline-block">
                        <code className="text-xs sm:text-sm font-mono text-yellow-800 font-semibold">
                          {"#" +
                            import.meta.env
                              .VITE_DOCUMENTOS_PALABRA_REEMPLAZAR ||
                            "#firmad"}
                        </code>
                      </div>
                      <div className="border-t border-gray-400 pt-2 min-w-[200px] sm:min-w-[300px]">
                        <p className="text-xs sm:text-sm font-semibold text-gray-900">
                          Firma del Director
                        </p>
                        <p className="text-xs sm:text-sm text-gray-600">
                          Tony Stark
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Tabla de firmas */}
                  <div className="mt-6 sm:mt-8 border border-gray-400 overflow-x-auto -mx-4 sm:mx-0">
                    <table className="w-full min-w-[500px] text-[10px] sm:text-xs">
                      <thead>
                        <tr className="border-b border-gray-400">
                          <th className="border-r border-gray-400 p-2 text-left bg-gray-50 font-semibold">
                            Elaboró
                          </th>
                          <th className="border-r border-gray-400 p-2 text-left bg-gray-50 font-semibold">
                            Autorizó
                          </th>
                          <th className="p-2 text-left bg-gray-50 font-semibold">
                            Autorizó
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-400">
                          <td className="border-r border-gray-400 p-2 font-medium">
                            Nombre
                          </td>
                          <td className="border-r border-gray-400 p-2 font-medium">
                            Nombre
                          </td>
                          <td className="p-2 font-medium">Nombre</td>
                        </tr>
                        <tr className="border-b border-gray-400">
                          <td className="border-r border-gray-400 p-2">
                            Peter Parker
                          </td>
                          <td className="border-r border-gray-400 p-2">
                            Bruce Wayne
                          </td>
                          <td className="p-2">Clark Kent</td>
                        </tr>
                        <tr className="border-b border-gray-400">
                          <td className="border-r border-gray-400 p-2 font-medium">
                            Firma
                          </td>
                          <td className="border-r border-gray-400 p-2 font-medium">
                            Firma
                          </td>
                          <td className="p-2 font-medium">Firma</td>
                        </tr>
                        <tr>
                          <td className="border-r border-gray-400 p-4 h-12 relative">
                            <div className="absolute inset-2 bg-blue-50 border-2 border-blue-400 rounded flex items-center justify-center">
                              <span className="text-blue-700 font-bold text-xs transform -rotate-12">
                                FIRMADO DIGITALMENTE
                              </span>
                            </div>
                          </td>
                          <td className="border-r border-gray-400 p-4 h-12 relative">
                            <div className="absolute inset-2 bg-blue-50 border-2 border-blue-400 rounded flex items-center justify-center">
                              <span className="text-blue-700 font-bold text-xs transform -rotate-12">
                                FIRMADO DIGITALMENTE
                              </span>
                            </div>
                          </td>
                          <td className="p-4 h-12 relative">
                            <div className="absolute inset-2 bg-yellow-50 border-2 border-yellow-400 rounded flex items-center justify-center">
                              <code className="text-yellow-800 font-bold text-xs">
                                 {"#" +
                            import.meta.env
                              .VITE_DOCUMENTOS_PALABRA_REEMPLAZAR ||
                            "#firmad"}
                              </code>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td className="border-r border-gray-400 p-2">
                            Analista de Sistemas
                          </td>
                          <td className="border-r border-gray-400 p-2">
                            Gerente Administrativo
                          </td>
                          <td className="p-2">Dirección General</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4 sm:mt-6 text-[10px] sm:text-xs text-gray-500 text-center border-t pt-3 sm:pt-4">
                  <p>
                    Ciudad de México •{" "}
                    {new Date().toLocaleDateString("es-MX", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900 mb-3">
                <strong>💡 Opciones de firma:</strong> La palabra clave puede
                colocarse de diferentes maneras en su documento:
              </p>
              <ul className="text-sm text-blue-800 space-y-2 ml-4">
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>
                    <strong>Firma independiente:</strong> Como se muestra
                    arriba, con una línea separada para la firma del director
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>
                    <strong>Dentro de tabla:</strong> Como se ve en la tabla de
                    firmas, donde la palabra clave reemplaza el contenido de una
                    celda específica
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>
                    <strong>En cualquier ubicación:</strong> Puede colocar la
                    palabra clave en cualquier parte del documento donde
                    necesite que aparezca la firma digital
                  </span>
                </li>
              </ul>
              <p className="text-sm text-blue-900 mt-3">
                <strong>Importante:</strong> La palabra clave resaltada en
                amarillo será reemplazada automáticamente por la firma digital
                al autorizar el documento.
              </p>
            </div>
          </div>
          </div>

          <AlertDialogFooter className="px-6 pb-6">
            <AlertDialogAction
              onClick={() => {
                setShowKeywordErrorDialog(false);
                setKeywordErrorFiles([]);
              }}
              className="w-full sm:w-auto"
            >
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog para errores generales */}
      <AlertDialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <AlertDialogContent className="max-h-[90vh] flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error al subir archivo
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base overflow-y-auto max-h-[60vh] whitespace-pre-wrap">
              {errorMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setShowErrorDialog(false);
                setErrorMessage("");
              }}
            >
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
