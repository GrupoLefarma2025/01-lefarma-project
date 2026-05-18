import { useState, useMemo } from 'react';
import { Search, Download, FileText, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import {
  buildPlantillaProveedoresCsv,
  buildTemplateProveedoresCsv,
  downloadCsv,
} from '@/utils/csv';

interface FormaPagoLite {
  idFormaPago: number;
  nombre: string;
  clave?: string;
  activo: boolean;
}

interface BancoLite {
  idBanco: number;
  nombre: string;
  clave?: string;
}

interface RegimenFiscalLite {
  idRegimenFiscal: number;
  clave: string;
  descripcion: string;
  activo: boolean;
}

interface ClavesReferenciaModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  formasPago: FormaPagoLite[];
  bancos: BancoLite[];
  regimenesFiscales: RegimenFiscalLite[];
}

const USOS_CFDI: Array<{ clave: string; descripcion: string }> = [
  { clave: 'G01', descripcion: 'Adquisición de mercancías' },
  { clave: 'G02', descripcion: 'Devoluciones, descuentos o bonificaciones' },
  { clave: 'G03', descripcion: 'Gastos en general' },
  { clave: 'I01', descripcion: 'Construcciones' },
  { clave: 'I02', descripcion: 'Mobiliario y equipo de oficina por inversiones' },
  { clave: 'I03', descripcion: 'Equipo de transporte' },
  { clave: 'I04', descripcion: 'Equipo de cómputo y accesorios' },
  { clave: 'I05', descripcion: 'Dados, troqueles, moldes, matrices y herramental' },
  { clave: 'I06', descripcion: 'Comunicaciones telefónicas' },
  { clave: 'I07', descripcion: 'Comunicaciones satelitales' },
  { clave: 'I08', descripcion: 'Otra maquinaria y equipo' },
  { clave: 'D01', descripcion: 'Honorarios médicos, dentales y gastos hospitalarios' },
  { clave: 'D02', descripcion: 'Gastos médicos por incapacidad o discapacidad' },
  { clave: 'D03', descripcion: 'Gastos funerales' },
  { clave: 'D04', descripcion: 'Donativos' },
  { clave: 'D05', descripcion: 'Intereses reales pagados por créditos hipotecarios (casa habitación)' },
  { clave: 'D06', descripcion: 'Aportaciones voluntarias al SAR' },
  { clave: 'D07', descripcion: 'Primas por seguros de gastos médicos' },
  { clave: 'D08', descripcion: 'Gastos de transportación escolar obligatoria' },
  { clave: 'D09', descripcion: 'Depósitos en cuentas para el ahorro / pensiones' },
  { clave: 'D10', descripcion: 'Pagos por servicios educativos (colegiaturas)' },
  { clave: 'S01', descripcion: 'Sin efectos fiscales' },
  { clave: 'CP01', descripcion: 'Pagos' },
  { clave: 'CN01', descripcion: 'Nómina' },
  { clave: 'P01', descripcion: 'Por definir' },
];

type Tab = 'formasPago' | 'bancos' | 'regimenes' | 'usoCfdi';

const TAB_LABELS: Record<Tab, string> = {
  formasPago: 'Formas de Pago',
  bancos: 'Bancos',
  regimenes: 'Regímenes Fiscales',
  usoCfdi: 'Uso CFDI',
};

const TAB_COLUMN_HEADERS: Record<Tab, string> = {
  formasPago: 'FormaPagoId',
  bancos: 'BancoId',
  regimenes: 'RegimenFiscalId',
  usoCfdi: 'UsoCfdi',
};

interface TableRow {
  id: string;
  clave: string;
  nombre: string;
  inactive?: boolean;
}

export function ClavesReferenciaModal({
  open,
  setOpen,
  formasPago,
  bancos,
  regimenesFiscales,
}: ClavesReferenciaModalProps) {
  const [tab, setTab] = useState<Tab>('formasPago');
  const [search, setSearch] = useState('');

  const rows: TableRow[] = useMemo(() => {
    switch (tab) {
      case 'formasPago':
        return formasPago.map((fp) => ({
          id: String(fp.idFormaPago),
          clave: fp.clave ?? '',
          nombre: fp.nombre,
          inactive: !fp.activo,
        }));
      case 'bancos':
        return bancos.map((b) => ({
          id: String(b.idBanco),
          clave: b.clave ?? '',
          nombre: b.nombre,
        }));
      case 'regimenes':
        return regimenesFiscales.map((r) => ({
          id: String(r.idRegimenFiscal),
          clave: r.clave,
          nombre: r.descripcion,
          inactive: !r.activo,
        }));
      case 'usoCfdi':
        return USOS_CFDI.map((u) => ({ id: u.clave, clave: u.clave, nombre: u.descripcion }));
    }
  }, [tab, formasPago, bancos, regimenesFiscales]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.id.toLowerCase().includes(needle) ||
        r.clave.toLowerCase().includes(needle) ||
        r.nombre.toLowerCase().includes(needle),
    );
  }, [rows, search]);

  const handleDownloadTemplate = () => {
    downloadCsv(buildTemplateProveedoresCsv(), 'plantilla_proveedores.csv');
    setOpen(false);
  };

  const handleDownloadExample = () => {
    const blob = buildPlantillaProveedoresCsv({
      formasPago,
      bancos,
      regimenesFiscales,
    });
    downloadCsv(blob, 'ejemplo_proveedores.csv');
    setOpen(false);
  };

  const tabKeys: Tab[] = ['formasPago', 'bancos', 'regimenes', 'usoCfdi'];

  return (
    <Modal
      id="modal-claves-referencia"
      open={open}
      setOpen={setOpen}
      title="Catálogos de referencia para la plantilla CSV"
      size="lg"
      footer={
        <div className="flex justify-between items-center gap-2 pt-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            Usa la columna <strong>Id</strong> en tu CSV.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
            <Button type="button" variant="outline" onClick={handleDownloadTemplate}>
              <FileText className="mr-2 h-4 w-4" />
              Plantilla vacía
            </Button>
            <Button type="button" onClick={handleDownloadExample}>
              <Download className="mr-2 h-4 w-4" />
              Ejemplo con datos
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-blue-900">
            <p className="font-medium mb-0.5">Cómo usar esta referencia</p>
            <p>
              Consulta el <strong>Id</strong> exacto de cada catálogo que necesites antes de llenar el CSV.
              Los Ids se copian sin comillas en las columnas correspondientes (ej. <code>FormaPagoId = 2</code>,
              <code>BancoId = 10</code>). El <strong>Nombre</strong> está sólo como referencia para
              ayudarte a identificar el registro correcto.
            </p>
            <p className="mt-2">
              Tienes dos descargas: <strong>"Plantilla vacía"</strong> baja sólo los encabezados
              (para llenar desde cero) y <strong>"Ejemplo con datos"</strong> baja la plantilla con
              filas de muestra ya llenadas (útil para ver cómo se agrupan cuentas múltiples).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b">
          {tabKeys.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setSearch('');
              }}
              className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Columna del CSV: <code className="font-mono bg-muted px-1.5 py-0.5 rounded">{TAB_COLUMN_HEADERS[tab]}</code>
            </p>
            <div className="relative max-w-[220px]">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-7 h-8 text-xs"
              />
            </div>
          </div>

          {tab === 'usoCfdi' && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs">
              <Info className="h-3.5 w-3.5 text-amber-700 mt-0.5 shrink-0" />
              <p className="text-amber-900">
                <strong>Nota:</strong> <code>UsoCfdi</code> es diferente al resto — no tiene un id
                numérico. Su <strong>código SAT</strong> (G01, G03, I04...) ES el identificador.
                En el CSV escribe directamente el código (ej. <code>UsoCfdi = G03</code>).
              </p>
            </div>
          )}

          <div className="max-h-72 overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/60 sticky top-0">
                <tr>
                  <th className="px-3 py-1.5 text-left font-medium w-20">Id</th>
                  <th className="px-3 py-1.5 text-left font-medium">Nombre / Descripción</th>
                  <th className="px-3 py-1.5 text-left font-medium w-24">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                      Sin resultados
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => (
                    <tr key={`${row.id}-${idx}`} className={row.inactive ? 'opacity-50' : 'hover:bg-muted/30'}>
                      <td className="px-3 py-1.5 font-mono font-semibold text-primary">{row.id}</td>
                      <td className="px-3 py-1.5">{row.nombre}</td>
                      <td className="px-3 py-1.5">
                        {row.inactive ? (
                          <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600 border-gray-300">
                            Inactivo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                            Activo
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            Mostrando {filteredRows.length} de {rows.length} registros.
          </p>
        </div>
      </div>
    </Modal>
  );
}
