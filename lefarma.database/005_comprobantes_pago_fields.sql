-- Migración: Agregar campos de pago a operaciones.comprobantes
-- Estos campos se usan cuando categoria = 'pago' para registrar referencia, fecha y monto del pago

ALTER TABLE operaciones.comprobantes
    ADD referencia_pago VARCHAR(100) NULL,
        fecha_pago      DATETIME     NULL,
        monto_pago      DECIMAL(18,2) NULL;
