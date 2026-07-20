import { useRef, useState } from 'react';
import { Upload, Loader2, FileText, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { toast } from 'sonner';
import { proveedorApi } from '@/shared/api/apiClient';
import {
  buildErrorsCsv,
  downloadCsv,
  parseProveedoresCsv,
  PROVEEDOR_CSV_COLUMNS,
} from '@/utils/csv';
import { toApiError } from '@/utils/errors';
import { ApiResponse } from '@/types/api.types';

const MAX_FILE_BYTES = 5_000_000;
const PREVIEW_ROW_LIMIT = 10;

interface BulkUploadRowError {
  rowNumber: number;
  field?: string | null;
  message: string;
}

interface BulkUploadResult {
  totalRows: number;
  proveedoresImported: number;
  cuentasImported: number;
  failedRows: number;
  errors: BulkUploadRowError[];
}

interface BulkUploadModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onImported: () => void;
}

export function BulkUploadModal({ open, setOpen, onImported }: BulkUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<BulkUploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setPreviewRows([]);
    setPreviewHeaders([]);
    setTotalRows(0);
    setIsImporting(false);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    setOpen(next);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;

    if (!picked.name.toLowerCase().endsWith('.csv')) {
      toast.error('El archivo debe tener extensión .csv');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (picked.size > MAX_FILE_BYTES) {
      toast.error(`El archivo excede el límite de 5 MB (${(picked.size / 1_000_000).toFixed(2)} MB)`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFile(picked);
    setResult(null);

    const parsed = await parseProveedoresCsv(picked);
    if (parsed.errorMessage) {
      toast.error(parsed.errorMessage);
      setPreviewRows([]);
      setPreviewHeaders([]);
      setTotalRows(0);
      return;
    }

    setPreviewHeaders(parsed.headers);
    setPreviewRows(parsed.rows.slice(0, PREVIEW_ROW_LIMIT));
    setTotalRows(parsed.rows.length);
  };

  const handleImport = async () => {
    if (!file) return;
    setIsImporting(true);
    try {
      const response = await proveedorApi.bulkUpload(file);
      const body = response.data as ApiResponse<BulkUploadResult>;
      if (body.success && body.data) {
        setResult(body.data);
        if (body.data.failedRows === 0) {
          toast.success(
            `Importados ${body.data.proveedoresImported} proveedores y ${body.data.cuentasImported} cuentas.`,
          );
          onImported();
          setTimeout(() => handleClose(false), 2000);
        } else {
          toast.warning(
            `Importación parcial: ${body.data.proveedoresImported} proveedores, ${body.data.cuentasImported} cuentas, ${body.data.failedRows} errores.`,
          );
          onImported();
        }
      } else {
        toast.error(body.message ?? 'Error en la carga masiva');
      }
    } catch (err: unknown) {
      const e = toApiError(err);
      toast.error(e.message ?? 'Error al subir el archivo');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadErrors = () => {
    if (!result || result.errors.length === 0) return;
    const blob = buildErrorsCsv(result.errors);
    downloadCsv(blob, `errores_carga_masiva_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const orderedHeaders = previewHeaders.length > 0
    ? previewHeaders
    : PROVEEDOR_CSV_COLUMNS.map((c) => c.label);

  return (
    <Modal
      id="modal-bulk-upload"
      open={open}
      setOpen={handleClose}
      title="Carga Masiva de Proveedores"
      size="xl"
      footer={
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={isImporting}>
            {result ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!result && (
            <Button
              type="button"
              onClick={handleImport}
              disabled={!file || isImporting || totalRows === 0}
            >
              {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Upload className="mr-2 h-4 w-4" />
              Importar {totalRows > 0 ? `(${totalRows} filas)` : ''}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {!result && (
          <>
            <div className="rounded-md border border-dashed bg-muted/30 p-4 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Reglas de agrupación:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Cada fila representa un proveedor + opcionalmente una cuenta bancaria.</li>
                <li>Para agregar más cuentas al mismo proveedor, repite la <strong>Razón Social</strong> y el <strong>RFC</strong> en filas <strong>consecutivas</strong>.</li>
                <li>Las filas adicionales del mismo proveedor sólo necesitan datos de cuenta (FormaPagoId, BancoId, CLABE, etc.).</li>
                <li>Si la columna <code>FormaPagoId</code> está vacía en una fila, no se crea cuenta para esa fila.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Archivo CSV</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="block w-full cursor-pointer text-sm"
                disabled={isImporting}
              />
              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{file.name}</span>
                  <span className="text-xs">({(file.size / 1000).toFixed(1)} KB)</span>
                </div>
              )}
            </div>

            {previewRows.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Previsualización (primeras {previewRows.length} de {totalRows} filas)
                </p>
                <div className="max-h-72 overflow-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60 sticky top-0">
                      <tr>
                        {orderedHeaders.map((h) => (
                          <th key={h} className="px-2 py-1 text-left font-medium whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {previewRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-muted/30">
                          {orderedHeaders.map((h) => (
                            <td key={h} className="px-2 py-1 whitespace-nowrap text-muted-foreground">
                              {row[h] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {result && (
          <div className="space-y-4">
            <div
              className={`rounded-md border p-4 ${
                result.failedRows === 0
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-amber-50 border-amber-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.failedRows === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                )}
                <div className="flex-1 space-y-1">
                  <p className="font-medium text-sm">
                    {result.failedRows === 0 ? 'Importación exitosa' : 'Importación parcial'}
                  </p>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>Filas procesadas: <strong>{result.totalRows}</strong></p>
                    <p>Proveedores creados: <strong>{result.proveedoresImported}</strong></p>
                    <p>Cuentas bancarias creadas: <strong>{result.cuentasImported}</strong></p>
                    <p>Filas con error: <strong>{result.failedRows}</strong></p>
                  </div>
                </div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Detalle de errores</p>
                  <Button type="button" variant="outline" size="sm" onClick={handleDownloadErrors}>
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Descargar CSV de errores
                  </Button>
                </div>
                <div className="max-h-60 overflow-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium">Fila</th>
                        <th className="px-2 py-1 text-left font-medium">Campo</th>
                        <th className="px-2 py-1 text-left font-medium">Mensaje</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {result.errors.map((err, idx) => (
                        <tr key={idx} className="hover:bg-muted/30">
                          <td className="px-2 py-1 font-mono">{err.rowNumber}</td>
                          <td className="px-2 py-1 text-muted-foreground">{err.field ?? '—'}</td>
                          <td className="px-2 py-1 text-red-600">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
