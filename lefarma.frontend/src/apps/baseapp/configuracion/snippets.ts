import type { VariableConfiguracion } from './types';
import {
  etiquetaTipo,
  itemListaDeEsquema,
  normalizarTipoDato,
} from './utils';

export type SnippetCodigo = 'frontend' | 'console' | 'backend' | 'sql' | 'curl';

function tipoFrontendBase(tipo: string): string {
  const canonico = normalizarTipoDato(tipo);
  switch (canonico) {
    case 'entero':
    case 'decimal':
      return 'number';
    case 'booleano':
      return 'boolean';
    case 'objeto':
      return 'Record<string, unknown>';
    case 'json':
      return 'unknown';
    default:
      return 'string';
  }
}

/** Tipo TypeScript legible para el snippet de frontend. */
export function tipoFrontend(variable: VariableConfiguracion): string {
  const canonico = normalizarTipoDato(variable.tipoDato);

  if (canonico === 'lista' || variable.tipoDato === 'array') {
    const item = itemListaDeEsquema(variable.esquema);
    if (item.tipo === 'lista') return 'unknown[][]';
    return `${tipoFrontendBase(item.tipo)}[]`;
  }

  return tipoFrontendBase(variable.tipoDato);
}

function tipoBackendBase(tipo: string): string {
  const canonico = normalizarTipoDato(tipo);
  switch (canonico) {
    case 'entero':
      return 'int';
    case 'decimal':
      return 'decimal';
    case 'booleano':
      return 'bool';
    case 'fecha':
      return 'DateOnly';
    case 'hora':
      return 'TimeOnly';
    case 'fecha_hora':
      return 'DateTime';
    case 'objeto':
    case 'json':
      return 'JsonElement';
    default:
      return 'string';
  }
}

/** Tipo C# legible para el snippet de backend. */
export function tipoBackend(variable: VariableConfiguracion): string {
  const canonico = normalizarTipoDato(variable.tipoDato);

  if (canonico === 'lista' || variable.tipoDato === 'array') {
    const item = itemListaDeEsquema(variable.esquema);
    if (item.tipo === 'lista') return 'List<JsonElement>';
    return `List<${tipoBackendBase(item.tipo)}>`;
  }

  return tipoBackendBase(variable.tipoDato);
}

function snippetFrontend(variable: VariableConfiguracion): string {
  return `import { useConfig } from '@/shared/configuracion/useConfig';

// Se actualiza automáticamente por SSE y polling.
const valor = useConfig<${tipoFrontend(variable)}>('${variable.clave}');`;
}

function snippetConsola(variable: VariableConfiguracion): string {
  return `// Consola del navegador (F12)
window.lefarmaConfig.get('${variable.clave}');

// Si aún no está en caché:
await window.lefarmaConfig.getAsync('${variable.clave}');

// Todas las variables frontend disponibles:
window.lefarmaConfig.getAll();`;
}

function snippetBackend(variable: VariableConfiguracion): string {
  const tipo = tipoBackend(variable);
  return `// Inyecta IConfiguracionRuntimeService en el constructor.
var resultado = await _configuracion.GetAsync<${tipo}>(
    "${variable.clave}",
    cancellationToken);

if (resultado.IsError)
{
    return resultado.Errors;
}

${tipo} valor = resultado.Value;`;
}

function snippetSql(variable: VariableConfiguracion): string {
  const canonico = normalizarTipoDato(variable.tipoDato);

  if (
    variable.tipoDato === 'array' ||
    canonico === 'lista' ||
    canonico === 'objeto' ||
    canonico === 'json'
  ) {
    return `SELECT [key], [value], [type]
FROM OPENJSON(config.fn_obtener_variable(N'${variable.clave}'));`;
  }

  if (canonico === 'entero') {
    return `SELECT TRY_CONVERT(int, config.fn_obtener_variable(N'${variable.clave}')) AS valor;`;
  }

  if (canonico === 'decimal') {
    return `SELECT TRY_CONVERT(decimal(18,6), config.fn_obtener_variable(N'${variable.clave}')) AS valor;`;
  }

  if (canonico === 'booleano') {
    return `SELECT TRY_CONVERT(bit, config.fn_obtener_variable(N'${variable.clave}')) AS valor;`;
  }

  if (canonico === 'fecha') {
    return `SELECT TRY_CONVERT(date, config.fn_obtener_variable(N'${variable.clave}')) AS valor;`;
  }

  if (canonico === 'fecha_hora') {
    return `SELECT TRY_CONVERT(datetime2(3), config.fn_obtener_variable(N'${variable.clave}')) AS valor;`;
  }

  if (canonico === 'hora') {
    return `SELECT TRY_CONVERT(time, config.fn_obtener_variable(N'${variable.clave}')) AS valor;`;
  }

  return `SELECT config.fn_obtener_variable(N'${variable.clave}') AS valor;`;
}

function snippetCurl(variable: VariableConfiguracion): string {
  const origen =
    typeof window === 'undefined' ? 'https://tu-servidor' : window.location.origin;
  return `curl --request GET \\
  --url "${origen}/api/configuracion/integraciones/variables/${encodeURIComponent(variable.clave)}" \\
  --header "X-API-Key: $LEFARMA_CONFIG_API_KEY"`;
}

/**
 * Los snippets se generan a partir de la variable real y de su tipo declarado.
 * El cURL solo se ofrece cuando la variable está expuesta a integraciones.
 */
export function generarSnippet(
  variable: VariableConfiguracion,
  tipo: SnippetCodigo,
): string {
  switch (tipo) {
    case 'frontend':
      return snippetFrontend(variable);
    case 'console':
      return snippetConsola(variable);
    case 'backend':
      return snippetBackend(variable);
    case 'sql':
      return snippetSql(variable);
    case 'curl':
      return snippetCurl(variable);
  }
}

export interface OpcionSnippet {
  tipo: SnippetCodigo;
  etiqueta: string;
  descripcion: string;
  disponible: boolean;
}

export function opcionesSnippet(variable: VariableConfiguracion): OpcionSnippet[] {
  return [
    {
      tipo: 'frontend',
      etiqueta: 'Frontend',
      descripcion: `useConfig<${tipoFrontend(variable)}>`,
      disponible: variable.disponibleFrontend,
    },
    {
      tipo: 'console',
      etiqueta: 'Consola del navegador',
      descripcion: 'window.lefarmaConfig.get',
      disponible: variable.disponibleFrontend,
    },
    {
      tipo: 'backend',
      etiqueta: 'Backend',
      descripcion: `GetAsync<${tipoBackend(variable)}>`,
      disponible: variable.disponibleBackend,
    },
    {
      tipo: 'sql',
      etiqueta: 'SQL Server',
      descripcion: 'fn_obtener_variable',
      disponible: variable.disponibleSql,
    },
    {
      tipo: 'curl',
      etiqueta: 'cURL · API externa',
      descripcion: 'X-API-Key',
      disponible: variable.disponibleIntegraciones,
    },
  ];
}

/**
 * Copia texto con fallback para navegadores servidos por HTTP no seguro,
 * donde navigator.clipboard puede no existir o rechazar la operación.
 */
export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  // La Clipboard API asíncrona falla o queda vacía en varios navegadores
  // cuando la aplicación se sirve por HTTP. En ese caso usamos el fallback
  // síncrono dentro del gesto del usuario.
  if (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    typeof navigator !== 'undefined' &&
    navigator.clipboard?.writeText
  ) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // Continúa con el fallback.
    }
  }

  if (typeof document === 'undefined') return false;

  const textarea = document.createElement('textarea');
  textarea.value = texto;
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);

  try {
    // El foco y la selección son obligatorios para que execCommand('copy')
    // funcione también desde un menú desplegable.
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, texto.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

export function descripcionSnippet(variable: VariableConfiguracion): string {
  return `${etiquetaTipo(variable.tipoDato)} · ${variable.clave}`;
}
