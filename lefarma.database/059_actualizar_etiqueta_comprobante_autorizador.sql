/* ============================================================
   059 — Cambiar el texto del comprobante que se pide al crear una
         solicitud de permiso (incluida Comisión de trabajo)
   BD destino: Lefarma (desarrollo y producción)

   CONTEXTO
   --------
   El campo 23 de config.workflow_campos (nombre técnico
   comprobante_domicilio) es el documento obligatorio de la acción
   ENVIAR (176) del paso "Creación de solicitud" (105) del workflow
   11 ("Workflow Solicitud Permisos"). El mapeo 25
   (SOLICITUD_PERSONAL) manda a ese workflow el tipo 40
   COMISION_TRABAJO, así que al elegir "Comisión de trabajo" el
   empleado ve hoy la etiqueta:

     Comprobante de domicilio para home office

   Se cambia por:

     Subir comprobante autorizador por dirección

   ALCANCE
   -------
   Solo cambia etiqueta_usuario. El nombre técnico
   (comprobante_domicilio) se conserva porque es la llave con la que
   se validan los archivos adjuntos (metadata.tipo) y no debe
   tocarse. Afecta a todos los tipos de permiso que usan el workflow
   11, no solo a la comisión de trabajo. Idempotente.

   ROLLBACK
   --------
   UPDATE config.workflow_campos
   SET etiqueta_usuario = 'Comprobante de domicilio para home office'
   WHERE nombre_tecnico = 'comprobante_domicilio'
     AND tipo_control = 'Archivo';
   ============================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

UPDATE config.workflow_campos
SET etiqueta_usuario = 'Subir comprobante autorizador por dirección'
WHERE nombre_tecnico = 'comprobante_domicilio'
  AND tipo_control = 'Archivo'
  AND etiqueta_usuario <> 'Subir comprobante autorizador por dirección';

-- Verificación
SELECT id_workflow_campo, nombre_tecnico, etiqueta_usuario, tipo_control, activo
FROM config.workflow_campos
WHERE nombre_tecnico = 'comprobante_domicilio';
