import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toApiError } from '@/utils/errors';
import { solicitudesApi } from '../services/solicitudes.api';
import type { ConceptosMotor, Cotizacion, FilaCotizacion } from '../types/cotizacion.types';
import type { Solicitud } from '../types/solicitud.types';
import { analizarCotizacion, desgloseConceptos, opcionesParaEnvio, textoPrecio } from './analizadorCotizacion';
import { MiniaturaCaptura } from './celdasCotizacion';

export interface ImportarCotizacionProps {
  /** Solicitud destino. Si es null, el borrador se crea al enviar. */
  solicitudId?: number | null;
  /**
   * Gasolina, casetas, comida y taxi de la propuesta elegida en el wizard.
   * Solo el wizard los conoce: el motor de costos de ruta los calcula en
   * memoria y no los persiste. `null` (o ausente) significa "no se sabe" y
   * viaja como `null`.
   */
  conceptosMotor?: ConceptosMotor | null;
  /** Se dispara con la solicitud persistida una vez enviada la cotización. */
  onEnviada?: (solicitud: Solicitud) => void;
}

/**
 * Importador del JSON que devuelve el agente externo: lo valida contra el
 * contrato (schemas/cotizacionViajes.esquema.ts), lo muestra como tabla con
 * link de compra y capturas, deja elegir opciones y las envia con el PUT de
 * opciones. La nota de cobertura se muestra siempre: esta pantalla no promete
 * cobertura total de transportistas.
 */
export function ImportarCotizacion({ solicitudId = null, conceptosMotor = null, onEnviada }: ImportarCotizacionProps) {
  const [texto, setTexto] = useState('');
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);
  const [filas, setFilas] = useState<FilaCotizacion[]>([]);
  const [errores, setErrores] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [solicitudEnviada, setSolicitudEnviada] = useState<Solicitud | null>(null);

  /** Cargar: si el JSON no valida, muestra el error y no toca filas ni estado. */
  const cargar = () => {
    const resultado = analizarCotizacion(texto);
    if (!resultado.valido) {
      setErrores(resultado.errores);
      return;
    }
    setErrores([]);
    setCotizacion(resultado.cotizacion);
    setFilas(resultado.filas);
    setSolicitudEnviada(null);
    setErrorEnvio(null);
  };

  const alternarSeleccion = (clave: string) =>
    setFilas(previas =>
      previas.map(fila => (fila.clave === clave ? { ...fila, seleccionada: !fila.seleccionada } : fila)),
    );

  const haySeleccion = filas.some(fila => fila.seleccionada);
  const enviada = solicitudEnviada !== null;

  const enviar = async () => {
    if (!cotizacion || enviando) return;
    setEnviando(true);
    setErrorEnvio(null);
    try {
      // El desglose por concepto solo puede armarse aqui: avion/autobus/
      // hospedaje dependen de las filas elegidas de la cotizacion de pi, y
      // gasolina/casetas/comida/taxi llegan del motor de costos de ruta via
      // `conceptosMotor`.
      const desglose = desgloseConceptos(filas, conceptosMotor);
      const id =
        solicitudId ??
        (
          await solicitudesApi.crear({
            datos: {
              origen: cotizacion.consulta.origen,
              destino: cotizacion.consulta.destino,
              fecha_salida: cotizacion.consulta.fecha_salida,
              fecha_regreso: cotizacion.consulta.fecha_regreso,
              personas: cotizacion.consulta.personas,
              cotizacion_version: cotizacion.version,
              autobus: desglose.autobus,
              avion: desglose.avion,
              gasolina: desglose.gasolina,
              casetas: desglose.casetas,
              comida: desglose.comida,
              taxi: desglose.taxi,
              hospedaje: desglose.hospedaje,
              total: desglose.total,
            },
          })
        ).data.data.id_solicitud;
      const respuesta = await solicitudesApi.guardarOpciones(id, opcionesParaEnvio(filas));
      const solicitud = respuesta.data.data;
      setSolicitudEnviada(solicitud);
      onEnviada?.(solicitud);
    } catch (error) {
      setErrorEnvio(toApiError(error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar cotización de viajes</CardTitle>
        <CardDescription>
          Pega el JSON que devuelve la búsqueda externa y elige las opciones que
          quieres solicitar. Estado: {solicitudEnviada?.estado ?? 'sin enviar'}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cotizacion-json">JSON de la cotización</Label>
          <Textarea
            id="cotizacion-json"
            rows={8}
            value={texto}
            onChange={evento => setTexto(evento.target.value)}
            placeholder='{ "version": "1.0.0", "consulta": { ... }, "opciones": [ ... ] }'
          />
          <div>
            <Button type="button" onClick={cargar}>
              Cargar cotización
            </Button>
          </div>
        </div>

        {errores.length > 0 && (
          <Alert variant="destructive" data-testid="errores-cotizacion">
            <AlertTitle>La cotización no es válida</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {errores.map(error => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {cotizacion && (
          <>
            <Alert data-testid="cobertura-declarada">
              <AlertTitle>Cobertura de la búsqueda</AlertTitle>
              <AlertDescription>
                <p>{cotizacion.cobertura_declarada}</p>
                <div className="mt-2" data-testid="transportistas-no-encontrados">
                  {cotizacion.transportistas_no_encontrados.length === 0 ? (
                    <p>Sin transportistas pendientes de reportar.</p>
                  ) : (
                    <>
                      <p className="font-medium">No se encontraron:</p>
                      <ul className="list-disc pl-4">
                        {cotizacion.transportistas_no_encontrados.map(faltante => (
                          <li key={faltante} data-testid="transportista-no-encontrado">
                            {faltante}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </AlertDescription>
            </Alert>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Elegir</TableHead>
                  <TableHead>Opcion</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead>Llegada</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Compra</TableHead>
                  <TableHead>Capturas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map(fila => (
                  <TableRow key={fila.clave} data-testid={`fila-${fila.clave}`}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={fila.seleccionada}
                        onChange={() => alternarSeleccion(fila.clave)}
                        aria-label={`Elegir ${fila.transportista} ${fila.salida}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{fila.transportista}</span>
                        <span className="text-xs text-muted-foreground">
                          {fila.modo} · {fila.fuente}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{fila.salida}</TableCell>
                    <TableCell>{fila.llegada}</TableCell>
                    <TableCell>
                      <span>{textoPrecio(fila)}</span>
                      {fila.estimado && (
                        <Badge variant="secondary" data-testid={`estimado-${fila.clave}`}>
                          estimado
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <a
                        href={fila.url_compra}
                        target="_blank"
                        rel="noreferrer"
                        data-testid={`url-compra-${fila.clave}`}
                      >
                        {fila.url_compra}
                      </a>
                    </TableCell>
                    <TableCell>
                      <div
                        className="flex flex-col gap-1"
                        data-testid={`capturas-${fila.clave}`}
                      >
                        {fila.capturas.map((captura, indice) => (
                          <MiniaturaCaptura
                            key={captura}
                            ruta={captura}
                            alt={`Captura ${indice + 1} de ${fila.transportista}`}
                            className="h-12 w-auto"
                          />
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {errorEnvio && (
              <Alert variant="destructive" data-testid="error-envio">
                <AlertTitle>No se pudo enviar la solicitud</AlertTitle>
                <AlertDescription>{errorEnvio}</AlertDescription>
              </Alert>
            )}

            {enviada && (
              <Alert data-testid="solicitud-enviada">
                <AlertTitle>Solicitud enviada</AlertTitle>
                <AlertDescription>
                  Cotización guardada en la solicitud {solicitudEnviada.id_solicitud}
                  {solicitudEnviada.estado ? ` con estado ${solicitudEnviada.estado}` : ''}.
                </AlertDescription>
              </Alert>
            )}

            <div>
              <Button
                type="button"
                onClick={enviar}
                disabled={enviando || enviada || !haySeleccion}
              >
                {enviando ? 'Enviando...' : 'Enviar solicitud'}
              </Button>
              {!haySeleccion && (
                <p className="text-xs text-muted-foreground">
                  Selecciona al menos una opción para enviar.
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}