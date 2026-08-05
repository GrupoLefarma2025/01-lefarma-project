-- =============================================================================
-- 020. SIMPLIFICAR ESQUEMA DE COMPROBANTES
-- =============================================================================
-- Cambios:
--   1. Eliminar tabla comprobantes_conceptos (los conceptos van en JSON)
--   2. Agregar columna datos_adicionales NVARCHAR(MAX) - JSON flexible
--   3. Agregar FK id_medio_pago → catalogos.medios_pago
--   4. Eliminar columnas CFDI de comprobantes (14 columnas + 4 totales + es_cfdi + xml_original)
--   5. Eliminar columna id_concepto de comprobantes_partidas
--   6. Recrear tablas desde cero (DROP + CREATE, estamos en desarrollo)
-- =============================================================================

-- ─── DROP EXISTING TABLES (orden inverso de dependencias) ────────────────────

IF OBJECT_ID('operaciones.comprobantes_partidas', 'U') IS NOT NULL
    DROP TABLE operaciones.comprobantes_partidas;

IF OBJECT_ID('operaciones.comprobantes_conceptos', 'U') IS NOT NULL
    DROP TABLE operaciones.comprobantes_conceptos;

IF OBJECT_ID('operaciones.comprobantes', 'U') IS NOT NULL
    DROP TABLE operaciones.comprobantes;

-- ─── asegurar FK a medios_pago ──────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
               WHERE s.name = 'catalogos' AND t.name = 'medios_pago')
BEGIN
    PRINT 'ADVERTENCIA: La tabla catalogos.medios_pago no existe. Creala antes de ejecutar este script.';
    THROW 51000, 'La tabla catalogos.medios_pago es requerida.', 1;
END
GO

-- ─── 1. RECREAR comprobantes ────────────────────────────────────────────────

CREATE TABLE operaciones.comprobantes (
    id_comprobante      INT IDENTITY(1,1) NOT NULL,
    id_empresa          INT NOT NULL,
    id_usuario_subio    INT NOT NULL,
    id_paso_workflow    INT NULL,
    id_medio_pago       INT NULL,                           -- FK → catalogos.medios_pago

    categoria           VARCHAR(10) NOT NULL DEFAULT 'gasto',  -- 'gasto' | 'pago'
    tipo_comprobante    VARCHAR(20) NOT NULL,                  -- 'cfdi','ticket','nota','recibo','manual','spei','cheque',etc.

    -- Totales (siempre requeridos para cualquier comprobante)
    total               DECIMAL(18,2) NOT NULL DEFAULT 0,

    -- Campos de pago (solo categoria='pago')
    referencia_pago     VARCHAR(100) NULL,
    fecha_pago          DATETIME NULL,
    monto_pago          DECIMAL(18,2) NULL,

    -- JSON flexible: absorbe CFDI, conceptos, datos especificos del medio de pago
    datos_adicionales   NVARCHAR(MAX) NULL,

    -- Estado: 0=Pendiente, 1=Parcial, 2=Aplicado, 3=Rechazado
    estado              TINYINT NOT NULL DEFAULT 0,

    -- Auditoria
    fecha_creacion      DATETIME2 NOT NULL DEFAULT GETDATE(),
    fecha_modificacion  DATETIME2 NULL,

    CONSTRAINT PK_comprobantes PRIMARY KEY CLUSTERED (id_comprobante),
    CONSTRAINT FK_comprobantes_medio_pago FOREIGN KEY (id_medio_pago)
        REFERENCES catalogos.medios_pago (id_medio_pago)
);

-- ─── 2. RECREAR comprobantes_partidas ───────────────────────────────────────

CREATE TABLE operaciones.comprobantes_partidas (
    id_asignacion       INT IDENTITY(1,1) NOT NULL,
    id_comprobante      INT NOT NULL,
    id_partida          INT NOT NULL,
    id_usuario_asigno   INT NOT NULL,
    id_paso_workflow    INT NULL,

    cantidad_asignada   DECIMAL(18,6) NOT NULL,
    importe_asignado    DECIMAL(18,2) NOT NULL,
    notas               VARCHAR(500) NULL,
    fecha_asignacion    DATETIME2 NOT NULL DEFAULT GETDATE(),

    CONSTRAINT PK_comprobantes_partidas PRIMARY KEY CLUSTERED (id_asignacion),
    CONSTRAINT FK_comprobantes_partidas_comprobante FOREIGN KEY (id_comprobante)
        REFERENCES operaciones.comprobantes (id_comprobante),
    CONSTRAINT FK_comprobantes_partidas_partida FOREIGN KEY (id_partida)
        REFERENCES operaciones.ordenes_compra_partidas (id_partida)
);

-- ─── 3. INSERT seed de medios de pago (si catalogos.medios_pago esta vacia) ─

IF NOT EXISTS (SELECT 1 FROM catalogos.medios_pago)
BEGIN
    SET IDENTITY_INSERT catalogos.medios_pago ON;

    INSERT INTO catalogos.medios_pago
        (id_medio_pago, nombre, nombre_normalizado, descripcion, codigo_sat,
         requiere_referencia, requiere_autorizacion, activo, fecha_creacion)
    VALUES
    (1, 'Efectivo',                    'efectivo',                    'Pago en efectivo',               '01', 0, 0, 1, GETDATE()),
    (2, 'Cheque Nominativo',           'cheque nominativo',           'Cheque a nombre del proveedor',   '02', 1, 0, 1, GETDATE()),
    (3, 'Transferencia Electrónica',   'transferencia electronica',   'SPEI / Transferencia bancaria',   '03', 1, 0, 1, GETDATE()),
    (4, 'Tarjeta de Crédito',          'tarjeta de credito',          'Pago con tarjeta de credito',     '04', 0, 1, 1, GETDATE()),
    (5, 'Tarjeta de Débito',           'tarjeta de debito',           'Pago con tarjeta de debito',     '28', 0, 1, 1, GETDATE()),
    (6, 'Depósito',                    'deposito',                    'Deposito bancario',               '99', 1, 0, 1, GETDATE()),
    (7, 'OLT',                         'olt',                         'Operacion en Linea de Tesoreria', '99', 1, 0, 1, GETDATE()),
    (8, 'Otro',                        'otro',                        'Otro medio de pago no contemplado','99', 0, 0, 1, GETDATE());

    SET IDENTITY_INSERT catalogos.medios_pago OFF;
    PRINT 'Seed catalogos.medios_pago insertado (7 registros)';
END

PRINT 'Script 020 ejecutado correctamente.';
GO
