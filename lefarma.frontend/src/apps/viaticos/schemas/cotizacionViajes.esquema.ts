import type { Esquema } from '../components/validadorCotizacion';

export const esquemaCotizacionViajes: Esquema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'version',
    'consulta',
    'cobertura_declarada',
    'transportistas_no_encontrados',
    'opciones',
  ],
  properties: {
    version: {
      type: 'string',
      const: '1.0.0',
    },
    consulta: {
      type: 'object',
      additionalProperties: false,
      required: ['origen', 'destino', 'fecha_salida', 'fecha_regreso', 'personas'],
      properties: {
        origen: { type: 'string' },
        destino: { type: 'string' },
        fecha_salida: { type: 'string' },
        fecha_regreso: { type: ['string', 'null'] },
        personas: { type: 'integer' },
      },
    },
    cobertura_declarada: { type: 'string' },
    transportistas_no_encontrados: {
      type: 'array',
      items: { type: 'string' },
    },
    opciones: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'transportista',
          'modo',
          'salida',
          'llegada',
          'precio',
          'url_compra',
          'fuente',
        ],
        properties: {
          transportista: { type: 'string' },
          modo: { type: 'string', enum: ['avion', 'autobus', 'hotel'] },
          salida: { type: 'string' },
          llegada: { type: 'string' },
          precio: { type: ['number', 'null'] },
          moneda: { type: 'string' },
          url_compra: { type: 'string' },
          capturas: { type: 'array', items: { type: 'string' } },
          fuente: { type: 'string' },
          consultado_en: { type: 'string' },
        },
        if: {
          required: ['precio'],
          properties: { precio: { type: 'null' } },
        },
        then: {
          required: ['fuente'],
          properties: { fuente: { const: 'estimado' } },
        },
      },
    },
  },
};