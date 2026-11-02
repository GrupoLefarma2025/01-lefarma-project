import logoDefault from '@/assets/logo.png';
import logoArgosol from '@/assets/empresas/argosol.webp?no-inline';
import logoAsokam from '@/assets/empresas/asokam.webp?no-inline';
import logoFarmalic from '@/assets/empresas/farmalic.webp?no-inline';
import logoLefarma from '@/assets/empresas/lefarma.webp?no-inline';
import logoPickneys from '@/assets/empresas/pickneys.webp?no-inline';
import logoReumedika from '@/assets/empresas/reumedika.webp?no-inline';
import logoConstrumedika from '@/assets/logo_11.png?no-inline';
import logoGrupoLefarma from '@/assets/logo_12.png?no-inline';

const EMPRESA_ARTRICENTER = 1;

const LOGOS_POR_NOMBRE: Record<string, string> = {
  ARGOSOL: logoArgosol,
  ASOKAM: logoAsokam,
  CONSTRUMEDIKA: logoConstrumedika,
  FARMALIC: logoFarmalic,
  'GRUPO LEFARMA': logoGrupoLefarma,
  LEFARMA: logoLefarma,
  PICKNEYS: logoPickneys,
  REUMEDIKA: logoReumedika,
};

function normalizarEmpresa(nombre?: string | null): string {
  return (nombre ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function esArtricenter(idEmpresa: number, nombre?: string | null): boolean {
  const clave = normalizarEmpresa(nombre);
  return idEmpresa === EMPRESA_ARTRICENTER || clave === 'ARTRICENTER' || clave === 'ARTICENTER';
}

/**
 * Los documentos de Artricenter se emiten con la marca Reumedika.
 * Para el resto, el logo se resuelve por nombre para no depender de IDs nuevos.
 */
export function resolverLogoEmpresa(idEmpresa: number, nombre?: string | null): string {
  if (esArtricenter(Number(idEmpresa), nombre)) {
    return logoReumedika;
  }

  return LOGOS_POR_NOMBRE[normalizarEmpresa(nombre)] ?? logoDefault;
}

export function resolverNombreEmpresaDocumento(
  idEmpresa: number,
  nombre?: string | null
): string {
  if (esArtricenter(Number(idEmpresa), nombre)) {
    return 'REUMEDIKA';
  }

  const nombreNormalizado = (nombre ?? '').trim();
  return nombreNormalizado ? nombreNormalizado.toUpperCase() : `EMPRESA ${idEmpresa}`;
}
