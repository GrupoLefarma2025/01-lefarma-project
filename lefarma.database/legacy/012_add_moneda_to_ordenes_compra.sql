-- ============================================================
-- 012 - Agregar moneda a órdenes de compra
-- ============================================================

ALTER TABLE operaciones.ordenes_compra
    ADD id_moneda            INT            NULL,
        tipo_cambio_aplicado DECIMAL(18,6)  NOT NULL  DEFAULT 1.000000;

ALTER TABLE operaciones.ordenes_compra
    ADD CONSTRAINT FK_ordenes_compra_moneda
        FOREIGN KEY (id_moneda)
        REFERENCES catalogos.monedas (id_moneda);

-- Poblar las OC existentes con la moneda default
UPDATE oc
SET    oc.id_moneda = m.id_moneda
FROM   operaciones.ordenes_compra oc
CROSS JOIN (SELECT TOP 1 id_moneda FROM catalogos.monedas WHERE es_default = 1) m;
