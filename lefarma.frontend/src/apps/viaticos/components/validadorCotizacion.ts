// Validador propio del contrato de cotizacion de viajes (JSON Schema draft
// 2020-12). Subconjunto soportado: type, required, properties,
// additionalProperties, items, enum, const, allOf, if/then. Sin ajv ni
// dependencias nuevas; el keyword 'format' no se evalua (es anotacion).

export type Esquema = {
  type?: string | string[];
  const?: unknown;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, Esquema>;
  additionalProperties?: boolean;
  items?: Esquema;
  allOf?: Esquema[];
  if?: Esquema;
  then?: Esquema;
};

export interface ResultadoValidacion {
  valido: boolean;
  errores: string[];
}

const tipoDe = (valor: unknown): string =>
  valor === null ? 'null' : Array.isArray(valor) ? 'array' : Number.isInteger(valor) ? 'integer' : typeof valor;

function revisar(esquema: Esquema, valor: unknown, ruta: string): string[] {
  const errores: string[] = [];
  const coincide = (t: string) => t === tipoDe(valor) || (t === 'number' && typeof valor === 'number');
  if (esquema.type) {
    const tipos = Array.isArray(esquema.type) ? esquema.type : [esquema.type];
    if (!tipos.some(coincide)) errores.push(`${ruta}: tipo ${tipoDe(valor)}, se esperaba ${tipos.join(' | ')}`);
  }
  if (esquema.const !== undefined && valor !== esquema.const)
    errores.push(`${ruta}: debe ser ${JSON.stringify(esquema.const)}`);
  if (esquema.enum && !esquema.enum.includes(valor))
    errores.push(`${ruta}: ${JSON.stringify(valor)} fuera de [${esquema.enum.map(v => JSON.stringify(v)).join(', ')}]`);
  const esObjeto = typeof valor === 'object' && valor !== null && !Array.isArray(valor);
  if (esObjeto) {
    const obj = valor as Record<string, unknown>;
    for (const campo of esquema.required ?? []) if (!(campo in obj)) errores.push(`${ruta}.${campo}: campo requerido ausente`);
    for (const [campo, sub] of Object.entries(esquema.properties ?? {}))
      if (campo in obj) errores.push(...revisar(sub, obj[campo], `${ruta}.${campo}`));
    if (esquema.additionalProperties === false)
      for (const campo of Object.keys(obj))
        if (!(esquema.properties && campo in esquema.properties)) errores.push(`${ruta}.${campo}: propiedad no permitida`);
  }
  if (Array.isArray(valor) && esquema.items) valor.forEach((item, i) => errores.push(...revisar(esquema.items as Esquema, item, `${ruta}[${i}]`)));
  for (const sub of esquema.allOf ?? []) errores.push(...revisar(sub, valor, ruta));
  if (esquema.if && revisar(esquema.if, valor, ruta).length === 0 && esquema.then)
    errores.push(...revisar(esquema.then, valor, ruta));
  return errores;
}

export function validarCotizacion(datos: unknown, esquema: Esquema): ResultadoValidacion {
  const errores = revisar(esquema, datos, '$');
  return { valido: errores.length === 0, errores };
}
