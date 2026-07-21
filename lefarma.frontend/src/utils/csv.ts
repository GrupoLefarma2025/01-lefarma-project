import Papa from 'papaparse';

export type ProveedorCsvColumnGroup = 'proveedor' | 'cuenta';

export interface ProveedorCsvColumn {
  key: string;
  label: string;
  required: boolean;
  group: ProveedorCsvColumnGroup;
  exampleValues: string[];
}

const EXAMPLE_ROW_COUNT = 4;

export const PROVEEDOR_CSV_COLUMNS: ProveedorCsvColumn[] = [
  {
    key: 'RazonSocial',
    label: 'RazonSocial',
    required: true,
    group: 'proveedor',
    exampleValues: ['Distribuidora ACME SA de CV', 'Servicios MX SA de CV', 'Suministros del Norte SA', 'Suministros del Norte SA'],
  },
  {
    key: 'RFC',
    label: 'RFC',
    required: false,
    group: 'proveedor',
    exampleValues: ['ACM010101AA1', 'SMX020202BB2', 'SDN030303CC3', 'SDN030303CC3'],
  },
  {
    key: 'CodigoPostal',
    label: 'CodigoPostal',
    required: false,
    group: 'proveedor',
    exampleValues: ['64000', '06100', '44100', ''],
  },
  {
    key: 'RegimenFiscalId',
    label: 'RegimenFiscalId',
    required: false,
    group: 'proveedor',
    exampleValues: ['1', '2', '1', ''],
  },
  {
    key: 'UsoCfdi',
    label: 'UsoCfdi',
    required: false,
    group: 'proveedor',
    exampleValues: ['G03', 'G03', 'G03', ''],
  },
  {
    key: 'PersonaContactoNombre',
    label: 'PersonaContactoNombre',
    required: false,
    group: 'proveedor',
    exampleValues: ['Juan Pérez', '', 'Lucía Gómez', ''],
  },
  {
    key: 'ContactoTelefono',
    label: 'ContactoTelefono',
    required: false,
    group: 'proveedor',
    exampleValues: ['8181818181', '', '3312121212', ''],
  },
  {
    key: 'ContactoEmail',
    label: 'ContactoEmail',
    required: false,
    group: 'proveedor',
    exampleValues: ['juan@acme.mx', '', 'lucia@sdnorte.mx', ''],
  },
  {
    key: 'Comentario',
    label: 'Comentario',
    required: false,
    group: 'proveedor',
    exampleValues: ['Proveedor principal', '', 'Cliente desde 2020', ''],
  },
  {
    key: 'FormaPagoId',
    label: 'FormaPagoId',
    required: false,
    group: 'cuenta',
    exampleValues: ['1', '', '1', '2'],
  },
  {
    key: 'BancoId',
    label: 'BancoId',
    required: false,
    group: 'cuenta',
    exampleValues: ['1', '', '2', '3'],
  },
  {
    key: 'NumeroCuenta',
    label: 'NumeroCuenta',
    required: false,
    group: 'cuenta',
    exampleValues: ['1234567890', '', '0987654321', '1122334455'],
  },
  {
    key: 'CLABE',
    label: 'CLABE',
    required: false,
    group: 'cuenta',
    exampleValues: ['012345678901234567', '', '014321098765432109', '021112233445566778'],
  },
  {
    key: 'NumeroTarjeta',
    label: 'NumeroTarjeta',
    required: false,
    group: 'cuenta',
    exampleValues: ['', '', '', ''],
  },
  {
    key: 'Beneficiario',
    label: 'Beneficiario',
    required: false,
    group: 'cuenta',
    exampleValues: ['Distribuidora ACME SA de CV', '', 'Suministros del Norte SA', 'Suministros del Norte SA'],
  },
  {
    key: 'CorreoNotificacion',
    label: 'CorreoNotificacion',
    required: false,
    group: 'cuenta',
    exampleValues: ['pagos@acme.mx', '', 'pagos@sdnorte.mx', 'pagos2@sdnorte.mx'],
  },
];

const BOM = '﻿';

function csvEscape(value: string): string {
  if (value == null) return '';
  const needsQuotes = /[",\n\r]/.test(value);
  if (!needsQuotes) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function formatHeader(col: ProveedorCsvColumn): string {
  const suffix = col.required ? ' (requerido)' : ' (opcional)';
  return `${col.label}${suffix}`;
}

export function buildPlantillaProveedoresCsv(catalogos?: {
  formasPago?: Array<{ idFormaPago: number; activo: boolean }>;
  bancos?: Array<{ idBanco: number }>;
  regimenesFiscales?: Array<{ idRegimenFiscal: number; activo: boolean }>;
}): Blob {
  const formaPagoIds = pickIds(
    catalogos?.formasPago,
    (fp) => fp.idFormaPago,
    (fp) => fp.activo,
  );
  const bancoIds = pickIds(catalogos?.bancos, (b) => b.idBanco);
  const regimenIds = pickIds(
    catalogos?.regimenesFiscales,
    (r) => r.idRegimenFiscal,
    (r) => r.activo,
  );

  const overrides: Record<string, string[]> = {
    RegimenFiscalId: makeExampleColumn(regimenIds, ['', '', '', '']),
    FormaPagoId: makeExampleColumn(formaPagoIds, ['', '', '', '']),
    BancoId: makeExampleColumn(bancoIds, ['', '', '', '']),
  };

  const headerLine = PROVEEDOR_CSV_COLUMNS.map(formatHeader).map(csvEscape).join(',');

  const rows: string[] = [];
  for (let i = 0; i < EXAMPLE_ROW_COUNT; i++) {
    const cells = PROVEEDOR_CSV_COLUMNS.map((col) => {
      const override = overrides[col.key];
      const value = override ? override[i] : col.exampleValues[i] ?? '';
      return csvEscape(value);
    });
    rows.push(cells.join(','));
  }

  const csv = BOM + [headerLine, ...rows].join('\r\n');
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

function pickIds<T>(
  items: T[] | undefined,
  getId: (item: T) => number,
  isActive?: (item: T) => boolean,
): number[] {
  if (!items || items.length === 0) return [];
  const filtered = isActive ? items.filter(isActive) : items;
  return filtered.map(getId);
}

function makeExampleColumn(ids: number[], fallback: string[]): string[] {
  if (ids.length === 0) return fallback;
  // Fila 0: un proveedor con una cuenta → primer id del catálogo (si aplica)
  // Fila 1: un proveedor sin cuenta → vacío
  // Fila 2: un proveedor con una cuenta → primer id nuevamente (espeja fila 0)
  // Fila 3: mismo proveedor que fila 2 con una SEGUNDA cuenta → id distinto si disponible
  const first = String(ids[0]);
  const second = ids.length > 1 ? String(ids[1]) : first;
  return [first, '', first, second];
}

export function buildTemplateProveedoresCsv(): Blob {
  const headerLine = PROVEEDOR_CSV_COLUMNS.map(formatHeader).map(csvEscape).join(',');
  const csv = BOM + headerLine + '\r\n';
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

export function downloadCsv(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export interface ParseCsvResult {
  headers: string[];
  rows: Record<string, string>[];
  errorMessage?: string;
}

function normalizeHeader(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const parenIndex = trimmed.indexOf(' (');
  return parenIndex > 0 ? trimmed.slice(0, parenIndex).trim() : trimmed;
}

export function parseProveedoresCsv(file: File): Promise<ParseCsvResult> {
  return new Promise((resolve) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const rawRows = results.data;
        if (!rawRows || rawRows.length === 0) {
          resolve({ headers: [], rows: [], errorMessage: 'El archivo CSV está vacío' });
          return;
        }

        const headers = rawRows[0].map(normalizeHeader);
        if (!headers.includes('RazonSocial')) {
          resolve({
            headers,
            rows: [],
            errorMessage: 'Falta la columna requerida "RazonSocial"',
          });
          return;
        }
        const rows = rawRows.slice(1).map((rawRow) => {
          const obj: Record<string, string> = {};
          headers.forEach((header, idx) => {
            obj[header] = (rawRow[idx] ?? '').toString();
          });
          return obj;
        });

        if (results.errors?.length) {
          const firstError = results.errors[0];
          resolve({
            headers,
            rows,
            errorMessage: `Advertencia al parsear: ${firstError.message} (fila ${firstError.row ?? '?'})`,
          });
          return;
        }

        resolve({ headers, rows });
      },
      error: (error) => {
        resolve({ headers: [], rows: [], errorMessage: error.message });
      },
    });
  });
}

export function buildErrorsCsv(
  errors: Array<{ rowNumber: number; field?: string | null; message: string }>,
): Blob {
  const header = 'rowNumber,field,message';
  const lines = errors.map((e) =>
    [csvEscape(String(e.rowNumber)), csvEscape(e.field ?? ''), csvEscape(e.message)].join(','),
  );
  const csv = BOM + [header, ...lines].join('\r\n');
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

// --- Vacaciones: días no hábiles ---

export interface DiaNoHabilCsvColumn {
  key: string;
  label: string;
  required: boolean;
  exampleValues: string[];
}

export const DIAS_NO_HABILES_CSV_COLUMNS: DiaNoHabilCsvColumn[] = [
  {
    key: 'dia',
    label: 'dia',
    required: true,
    exampleValues: ['1', '2', '25'],
  },
  {
    key: 'mes',
    label: 'mes',
    required: true,
    exampleValues: ['1', '1', '1'],
  },
  {
    key: 'anio',
    label: 'anio',
    required: true,
    exampleValues: ['2027', '2027', '2027'],
  },
  {
    key: 'descripcion',
    label: 'descripcion',
    required: false,
    exampleValues: ['Año Nuevo', 'Día de la Constitución', ''],
  },
];

export function buildTemplateDiasNoHabilesCsv(): Blob {
  const headerLine = DIAS_NO_HABILES_CSV_COLUMNS.map((col) => col.label).join(',');
  const csv = BOM + headerLine + '\r\n';
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

export function buildPlantillaDiasNoHabilesCsv(): Blob {
  const headerLine = DIAS_NO_HABILES_CSV_COLUMNS.map((col) => col.label).join(',');
  const rows = [0, 1, 2].map((i) =>
    DIAS_NO_HABILES_CSV_COLUMNS.map((col) => csvEscape(col.exampleValues[i] ?? '')).join(','),
  );
  const csv = BOM + [headerLine, ...rows].join('\r\n');
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

export interface DiaNoHabilCsvRow {
  dia?: string;
  mes?: string;
  anio?: string;
  descripcion?: string;
}

export function parseDiasNoHabilesCsv(file: File): Promise<{
  headers: string[];
  rows: Record<string, string>[];
  errorMessage?: string;
}> {
  return new Promise((resolve) => {
    Papa.parse<string[]>(file, {
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const rawRows = results.data;
        if (!rawRows || rawRows.length === 0) {
          resolve({ headers: [], rows: [], errorMessage: 'El archivo CSV está vacío' });
          return;
        }

        const headers = rawRows[0].map((h) => h.trim().toLowerCase());
        const required = ['dia', 'mes', 'anio'];
        const missing = required.filter((r) => !headers.includes(r));
        if (missing.length > 0) {
          resolve({
            headers,
            rows: [],
            errorMessage: `Faltan columnas requeridas: ${missing.join(', ')}`,
          });
          return;
        }

        const rows = rawRows.slice(1).map((rawRow) => {
          const obj: Record<string, string> = {};
          headers.forEach((header, idx) => {
            obj[header] = (rawRow[idx] ?? '').toString();
          });
          return obj;
        });

        if (results.errors?.length) {
          const firstError = results.errors[0];
          resolve({
            headers,
            rows,
            errorMessage: `Advertencia al parsear: ${firstError.message} (fila ${firstError.row ?? '?'})`,
          });
          return;
        }

        resolve({ headers, rows });
      },
      error: (error) => {
        resolve({ headers: [], rows: [], errorMessage: error.message });
      },
    });
  });
}

export function buildDiasNoHabilesErrorsCsv(
  errors: Array<{ rowNumber: number; rowData: string; error: string }>,
): Blob {
  const header = 'rowNumber,rowData,error';
  const lines = errors.map((e) =>
    [csvEscape(String(e.rowNumber)), csvEscape(e.rowData), csvEscape(e.error)].join(','),
  );
  const csv = BOM + [header, ...lines].join('\r\n');
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}
