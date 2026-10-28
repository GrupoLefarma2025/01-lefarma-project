// Almacenamiento de capturas en el volumen /data.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { nombreSeguro } from './seguridad.js';

export const DIR_CAPTURAS = process.env.CAPTURAS_DIR || '/data/capturas';

/** Guarda un PNG con nombre unico y devuelve {archivo, ruta, bytes}. */
export async function guardarPng(buffer, nombreBase = 'captura') {
  await fs.mkdir(DIR_CAPTURAS, { recursive: true });
  const base = nombreSeguro(nombreBase, 'captura');
  const sufijo = crypto.randomBytes(4).toString('hex');
  const archivo = `${base}-${Date.now().toString(36)}-${sufijo}.png`;
  const ruta = path.join(DIR_CAPTURAS, archivo);
  await fs.writeFile(ruta, buffer);
  return { archivo, ruta, bytes: buffer.length };
}

/** Resuelve un archivo de captura de forma segura (sin traversal). */
export function rutaSeguraCaptura(archivo) {
  const limpio = path.basename(String(archivo || ''));
  if (!/^[a-zA-Z0-9._-]+\.png$/.test(limpio)) return null;
  const ruta = path.join(DIR_CAPTURAS, limpio);
  if (!ruta.startsWith(DIR_CAPTURAS + path.sep)) return null;
  return ruta;
}

export function urlCaptura(baseUrl, archivo) {
  return `${String(baseUrl || '').replace(/\/+$/, '')}/c/${archivo}`;
}
