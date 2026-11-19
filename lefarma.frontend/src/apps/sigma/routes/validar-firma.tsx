import { useEffect, useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Spinner } from "@/apps/sigma/components/ui/spinner";
import { SigmaHttpError, getBlob, postForm } from "@/apps/sigma/lib/httpClient";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

export default function ValidarFirma() {
  const [searchParams] = useSearchParams();
  const idFromUrl = (searchParams.get("idDocumento") ?? "").trim();
  const [documentId, setDocumentId] = useState(idFromUrl);
  const [file, setFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    message: string;
  } | null>(null);
  const autoValidatedId = useRef("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];

      // Validar que sea un PDF
      if (selectedFile.type !== "application/pdf") {
        alert("Solo se permiten archivos PDF");
        e.target.value = "";
        return;
      }

      setFile(selectedFile);
      // Limpiar resultado previo
      setValidationResult(null);
    }
  };

  // Llama al servicio de firmas y guarda el resultado. Lanza error si la
  // respuesta no es un veredicto (documento inexistente, sin autorizar, etc.).
  const verificarDocumento = async (
    id: string,
    archivo: File | Blob,
    nombreArchivo: string
  ) => {
    const formData = new FormData();
    formData.append("archivo", archivo, nombreArchivo);

    try {
      const result = await postForm<{
        message?: string;
        data?: { coincidencia?: boolean };
      }>(`/sigma/pdf-signature/verificar-documento/${id}`, formData);

      setValidationResult({
        isValid: true,
        message:
          result.message ??
          "✅ El documento es auténtico y no ha sido alterado.",
      });
    } catch (error) {
      const body =
        error instanceof SigmaHttpError
          ? (error.body as
              | { message?: string; data?: { coincidencia?: boolean } }
              | undefined)
          : undefined;

      if (body?.data?.coincidencia === false) {
        setValidationResult({
          isValid: false,
          message:
            body.message ??
            "❌ Falla de integridad. El hash del archivo subido no coincide con el hash autorizado.",
        });
        return;
      }

      throw error;
    }
  };

  // Valida automáticamente el documento del enlace: descarga el PDF autorizado
  // y lo compara contra el hash registrado.
  const validarDesdeEnlace = async (id: string) => {
    setValidating(true);
    setValidationResult(null);

    try {
      const blob = await getBlob(
        `/sigma/pdf-signature/pdf/${id}?descargar=true&mostrarDocumentoSoporte=false`
      );

      await verificarDocumento(id, blob, `${id}.pdf`);
    } catch (error) {
      console.error("Error validating document from link:", error);
      setValidationResult({
        isValid: false,
        message:
          error instanceof Error
            ? error.message
            : "Error al validar el documento",
      });
    } finally {
      setValidating(false);
    }
  };

  useEffect(() => {
    if (!idFromUrl) return;

    setDocumentId(idFromUrl);

    // Evita revalidar el mismo documento (por ejemplo en doble render de dev)
    if (autoValidatedId.current === idFromUrl) return;
    autoValidatedId.current = idFromUrl;

    void validarDesdeEnlace(idFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idFromUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!documentId.trim()) {
      alert("Por favor ingresa el UUID del documento");
      return;
    }

    if (!file) {
      alert("Por favor selecciona un archivo PDF");
      return;
    }

    setValidating(true);
    setValidationResult(null);

    try {
      await verificarDocumento(documentId.trim(), file, file.name);
    } catch (error) {
      console.error("Error validating document:", error);
      setValidationResult({
        isValid: false,
        message:
          error instanceof Error
            ? error.message
            : "Error al validar el documento",
      });
    } finally {
      setValidating(false);
    }
  };

  const handleReset = () => {
    setDocumentId("");
    setFile(null);
    setValidationResult(null);
    const fileInput = document.getElementById("file") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <Navbar />
          <main className="flex-1 p-3">
            <div className="max-w-3xl mx-auto space-y-1">
              <div className="py-0.5">
                <h1 className="text-base font-bold leading-tight">Validar Firma Digital</h1>
                <p className="text-muted-foreground text-xs mt-0 leading-tight">
                  Verifica la autenticidad de la firma digital de un documento
                </p>
              </div>

              <Card className="w-full">
                <CardHeader className="py-2 pb-1 px-3">
                  <CardTitle className="text-sm">Información del Documento</CardTitle>
                </CardHeader>
                <CardContent className="pb-2 pt-1 px-3">
                  {idFromUrl && (
                    <p className="mb-2 text-[10px] text-muted-foreground">
                      Documento recibido por enlace: se valida automáticamente
                      contra el archivo autorizado.
                    </p>
                  )}
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="documentId" className="text-xs">
                        ID del Documento <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="documentId"
                        type="text"
                        placeholder="Ej: 123e4567-e89b-12d3-a456-426614174000"
                        value={documentId}
                        onChange={(e) => setDocumentId(e.target.value)}
                        disabled={validating}
                        required
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="file" className="text-xs">
                        Archivo PDF <span className="text-red-500">*</span>
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="file"
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={handleFileChange}
                          className="flex-1 h-8 text-xs"
                          disabled={validating}
                          required
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            document.getElementById("file")?.click()
                          }
                          disabled={validating}
                          className="h-8 w-8"
                        >
                          <Upload className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {file && !validating && (
                      <div className="p-2 border rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <FileText className="h-6 w-6 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="text-xs font-medium">{file.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {validating && (
                      <div className="flex items-center justify-center p-4 border rounded-lg bg-muted/50">
                        <div className="flex flex-col items-center gap-2">
                          <Spinner className="h-6 w-6" />
                          <div className="text-center">
                            <p className="text-xs font-medium">
                              Validando firma digital...
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Por favor espera
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {validationResult && !validating && (
                      <Alert
                        variant={validationResult.isValid ? "default" : "destructive"}
                        className={validationResult.isValid ? "border-green-500 bg-green-50 dark:bg-green-950/20 text-green-900 dark:text-green-100" : ""}
                      >
                        {validationResult.isValid ? (
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        <AlertTitle className={validationResult.isValid ? "text-green-800 dark:text-green-200" : ""}>
                          {validationResult.isValid
                            ? "Firma Válida"
                            : "Firma Inválida"}
                        </AlertTitle>
                        <AlertDescription className={validationResult.isValid ? "text-green-700 dark:text-green-300" : ""}>
                          {validationResult.message}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        className="flex-1 h-8 text-xs"
                        disabled={validating || !documentId.trim() || !file}
                      >
                        {validating ? (
                          <>
                            <Spinner className="mr-2 h-3 w-3" />
                            Validando...
                          </>
                        ) : (
                          <>
                            <AlertCircle className="mr-2 h-3 w-3" />
                            Validar Firma
                          </>
                        )}
                      </Button>

                      {(documentId || file || validationResult) && !validating && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleReset}
                          className="h-8 text-xs"
                        >
                          Limpiar
                        </Button>
                      )}
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-2 pb-1 px-3">
                  <CardTitle className="text-sm">¿Cómo funciona?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pb-2 pt-1 px-3">
                  <div className="flex items-start gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                      1
                    </div>
                    <div>
                      <p className="font-medium text-xs">Obtén el ID del documento</p>
                      <p className="text-[10px] text-muted-foreground">
                        Ingresa el identificador único del documento que deseas validar
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                      2
                    </div>
                    <div>
                      <p className="font-medium text-xs">Carga el archivo PDF</p>
                      <p className="text-[10px] text-muted-foreground">
                        Selecciona el documento PDF que quieres verificar
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
                      3
                    </div>
                    <div>
                      <p className="font-medium text-xs">Valida la firma</p>
                      <p className="text-[10px] text-muted-foreground">
                        El sistema verificará si el documento tiene una firma digital válida
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </SidebarInset>
    </SidebarProvider>
  );
}
