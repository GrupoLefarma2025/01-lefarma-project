export const CHIP_CLASS = 'variable-chip';

export function escaparVariable(variable: string): string {
  return variable.replace(/[&<>"]/g, (c) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
    };
    return map[c] ?? c;
  });
}

export function crearChipVariable(variable: string): string {
  const key = variable.replace(/^\{\{|\}\}$/g, '');
  const keySeguro = escaparVariable(key);
  return `<span class="${CHIP_CLASS}" data-variable="${keySeguro}">${keySeguro}</span>`;
}

export function convertirVariablesAChips(html: string, variables: string[]): string {
  let resultado = html;
  variables.forEach((variable) => {
    const key = variable.replace(/^\{\{|\}\}$/g, '');
    resultado = resultado.replaceAll(`{{${key}}}`, crearChipVariable(variable));
  });
  return resultado;
}

export function normalizarVariables(html: string): string {
  return html.replace(
    /<span\s+(?:[^>]*\s+)?class="[^"]*\bvariable-chip\b[^"]*"[^>]*\s+data-variable="([^"]*)"[^>]*>[^<]*<\/span>/g,
    '{{$1}}'
  );
}
