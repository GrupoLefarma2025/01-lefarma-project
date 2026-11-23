import { esTipoRango, type TipoDatoRango, type VariableConfiguracion } from './types';
import {
  etiquetaTipo,
  itemListaDeEsquema,
  normalizarTipoDato,
} from './utils';

export type SnippetCodigo = 'frontend' | 'console' | 'backend' | 'sql' | 'api';

export type LenguajeApi =
  | 'curl'
  | 'powershell'
  | 'python'
  | 'csharp'
  | 'javascript'
  | 'typescript'
  | 'vba'
  | 'tsql';

interface LenguajeApiDefinicion {
  valor: LenguajeApi;
  etiqueta: string;
}

const LENGUAJES_API: readonly LenguajeApiDefinicion[] = [
  { valor: 'curl', etiqueta: 'cURL' },
  { valor: 'powershell', etiqueta: 'PowerShell' },
  { valor: 'python', etiqueta: 'Python' },
  { valor: 'csharp', etiqueta: 'C#' },
  { valor: 'javascript', etiqueta: 'JavaScript' },
  { valor: 'typescript', etiqueta: 'TypeScript' },
  { valor: 'vba', etiqueta: 'Visual Basic (macro VBA)' },
  { valor: 'tsql', etiqueta: 'T-SQL (función SQL)' },
];

export interface OpcionLenguajeApi extends LenguajeApiDefinicion {
  disponible: boolean;
}

function tipoFrontendRango(tipo: TipoDatoRango): string {
  const base = tipo === 'rango_entero' || tipo === 'rango_decimal' ? 'number' : 'string';
  return `{ desde: ${base}; hasta: ${base} }`;
}

function tipoFrontendBase(tipo: string): string {
  const canonico = normalizarTipoDato(tipo);
  if (canonico && esTipoRango(canonico)) return tipoFrontendRango(canonico);

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

export function tipoFrontend(variable: VariableConfiguracion): string {
  const canonico = normalizarTipoDato(variable.tipoDato);

  if (canonico === 'lista' || variable.tipoDato === 'array') {
    const item = itemListaDeEsquema(variable.esquema);
    if (item.tipo === 'lista') return 'unknown[][]';
    return `${tipoFrontendBase(item.tipo)}[]`;
  }

  return tipoFrontendBase(variable.tipoDato);
}

function tipoBackendRango(tipo: TipoDatoRango): string {
  const base =
    tipo === 'rango_fecha'
      ? 'DateOnly'
      : tipo === 'rango_fecha_hora'
        ? 'DateTime'
        : tipo === 'rango_entero'
          ? 'int'
          : 'decimal';
  return `(${base} Desde, ${base} Hasta)`;
}

function tipoBackendBase(tipo: string): string {
  const canonico = normalizarTipoDato(tipo);
  if (canonico && esTipoRango(canonico)) return tipoBackendRango(canonico);

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
    canonico === 'json' ||
    (canonico !== null && esTipoRango(canonico))
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

function datosApi(variable: VariableConfiguracion): { url: string; clave: string } {
  const origen =
    typeof window === 'undefined' ? 'https://tu-servidor' : window.location.origin;
  const url = `${origen}/api/configuracion/integraciones/variables/${encodeURIComponent(
    variable.clave,
  )}`;

  return { url, clave: variable.clave };
}

function snippetCurl(variable: VariableConfiguracion): string {
  const { url } = datosApi(variable);
  return `curl --request GET \\
  --url "${url}" \\
  --header "X-API-Key: TU_API_KEY"`;
}

function snippetPowerShell(variable: VariableConfiguracion): string {
  const { url } = datosApi(variable);
  return `$headers = @{ 'X-API-Key' = 'TU_API_KEY' }

$respuesta = Invoke-RestMethod -Method Get -Uri '${url}' -Headers $headers
$respuesta.valor`;
}

function snippetPython(variable: VariableConfiguracion): string {
  const { url } = datosApi(variable);
  return `import requests

url = "${url}"
headers = {"X-API-Key": "TU_API_KEY"}

respuesta = requests.get(url, headers=headers, timeout=15)
respuesta.raise_for_status()
datos = respuesta.json()
print(datos["valor"])`;
}

function snippetCSharp(variable: VariableConfiguracion): string {
  const { url } = datosApi(variable);
  return `using System.Net.Http;
using System.Net.Http.Json;

using var http = new HttpClient();
http.DefaultRequestHeaders.Add("X-API-Key", "TU_API_KEY");

var respuesta = await http.GetFromJsonAsync<RespuestaVariable>("${url}");
Console.WriteLine(respuesta?.Valor);

public sealed record RespuestaVariable(
    string Clave,
    string TipoDato,
    object? Valor,
    long Revision);`;
}

function snippetJavaScript(variable: VariableConfiguracion): string {
  const { url } = datosApi(variable);
  return `const respuesta = await fetch("${url}", {
  headers: { "X-API-Key": "TU_API_KEY" },
});

if (!respuesta.ok) {
  throw new Error("Error HTTP " + respuesta.status);
}

const datos = await respuesta.json();
console.log(datos.valor);`;
}

function snippetTypeScript(variable: VariableConfiguracion): string {
  const { url } = datosApi(variable);
  return `interface RespuestaVariable {
  clave: string;
  tipoDato: string;
  valor: ${tipoFrontend(variable)};
  revision: number;
}

const respuesta = await fetch("${url}", {
  headers: { "X-API-Key": "TU_API_KEY" },
});

if (!respuesta.ok) {
  throw new Error("Error HTTP " + respuesta.status);
}

const datos = (await respuesta.json()) as RespuestaVariable;
console.log(datos.valor);`;
}

function snippetVba(variable: VariableConfiguracion): string {
  const { url } = datosApi(variable);
  return `' Macro VBA (Excel/Word): herramienta síncrona con WinHTTP
Dim http As Object
Set http = CreateObject("WinHttp.WinHttpRequest.5.1")

http.Open "GET", "${url}", False
http.SetRequestHeader "X-API-Key", "TU_API_KEY"
http.Send

If http.Status <> 200 Then
    MsgBox "Error HTTP " & http.Status & ": " & http.ResponseText
    Exit Sub
End If

Dim respuesta As String
respuesta = http.ResponseText
' respuesta contiene { clave, tipoDato, valor, revision }`;
}

function snippetApi(variable: VariableConfiguracion, lenguaje: LenguajeApi): string {
  switch (lenguaje) {
    case 'curl':
      return snippetCurl(variable);
    case 'powershell':
      return snippetPowerShell(variable);
    case 'python':
      return snippetPython(variable);
    case 'csharp':
      return snippetCSharp(variable);
    case 'javascript':
      return snippetJavaScript(variable);
    case 'typescript':
      return snippetTypeScript(variable);
    case 'vba':
      return snippetVba(variable);
    case 'tsql':
      return snippetSql(variable);
  }
}

export function opcionesLenguajeApi(variable: VariableConfiguracion): OpcionLenguajeApi[] {
  return LENGUAJES_API.map((lenguaje) => ({
    ...lenguaje,
    disponible:
      lenguaje.valor === 'tsql'
        ? variable.disponibleSql
        : variable.disponibleIntegraciones,
  }));
}

export function etiquetaLenguajeApi(lenguaje: LenguajeApi): string {
  return LENGUAJES_API.find((opcion) => opcion.valor === lenguaje)?.etiqueta ?? lenguaje;
}

export function lenguajeApiPredeterminado(variable: VariableConfiguracion): LenguajeApi {
  return variable.disponibleIntegraciones ? 'curl' : 'tsql';
}

export function generarSnippet(
  variable: VariableConfiguracion,
  tipo: SnippetCodigo,
  lenguaje?: LenguajeApi,
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
    case 'api':
      return snippetApi(variable, lenguaje ?? lenguajeApiPredeterminado(variable));
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
      tipo: 'api',
      etiqueta: 'API externa · varios lenguajes',
      descripcion: 'cURL, PowerShell, Python, C#, JS, TS, VBA y T-SQL',
      disponible: variable.disponibleIntegraciones || variable.disponibleSql,
    },
  ];
}

export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
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
