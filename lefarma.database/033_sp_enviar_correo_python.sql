/* ============================================================================
   033_sp_enviar_correo_python.sql
   Grupo Lefarma — Envío de correos desde SQL Server (ML Services Python)
   Base: ASOKAM (192.168.4.2)

   PARTE 1) app.correo_cuentas   -> cuentas SMTP (una fila por correo remitente)
            con la contraseña CIFRADA (ENCRYPTBYPASSPHRASE).
   PARTE 2) app.sp_enviar_correo -> SP que envía correos en 2 formatos
            (HTML + texto plano) vía Python (smtplib), tomando las credenciales
            de la cuenta indicada en @correo_remitente.

   NO requiere pip: solo librerías estándar de Python (smtplib, email, ssl)
   más pandas (ya incluido en ML Services).

   SEGURIDAD
   - La contraseña NUNCA se guarda en claro: se guarda cifrada (VARBINARY) y se
     descifra solo en memoria al momento de enviar.
   - FRASE DE CIFRADO = LfM@il.2026.S3cr3ta  (vive en el INSERT de ejemplo y en
     el SP; si la cambian, hay que re-cifrar las contraseñas con la frase nueva:
     UPDATE app.correo_cuentas SET password_cifrada = ENCRYPTBYPASSPHRASE(
       N'frase_nueva', CONVERT(NVARCHAR(256), DECRYPTBYPASSPHRASE(N'LfM@il.2026.S3cr3ta', password_cifrada))));
   - Si más adelante requieren más control de llaves, migran a certificado
     (CREATE MASTER KEY + CREATE CERTIFICATE + ENCRYPTBYCERTIFICATE) sin
     cambiar el contrato del SP.

   USO — el cuerpo es UNO U OTRO:
   -- Modo HTML (bonito):
   EXEC app.sp_enviar_correo
       @correo_remitente = 'autorizaciones@grupolefarma.com.mx',
       @asunto           = N'Asunto del correo',
       @destinatarios    = N'a@grupolefarma.com.mx; b@grupolefarma.com.mx',
       @copias           = N'jefe@grupolefarma.com.mx',
       @nombre_remitente = N'noreplay',
       @body_html        = N'<h1>Hola</h1><p>Cuerpo en <b>HTML</b>.</p>';

   -- Modo texto plano (mas rapido):
   EXEC app.sp_enviar_correo
       @correo_remitente = 'autorizaciones@grupolefarma.com.mx',
       @asunto           = N'Asunto del correo',
       @destinatarios    = N'a@grupolefarma.com.mx',
       @body_normal      = N'Hola. Cuerpo en texto plano.';

   Si mandan ambos (@body_html + @body_normal), el correo sale doble
   (multipart/alternative: HTML para clientes modernos, texto para los demas).
   ============================================================================ */

/* ---------------------------------------------------------------------------
   PARTE 1) Tabla de cuentas de correo (contraseñas cifradas)
   --------------------------------------------------------------------------- */
IF OBJECT_ID(N'app.correo_cuentas', N'U') IS NULL
BEGIN
    CREATE TABLE app.correo_cuentas (
        id_cuenta              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_correo_cuentas PRIMARY KEY,
        correo                 VARCHAR(256)   NOT NULL CONSTRAINT UQ_correo_cuentas_correo UNIQUE,
        nombre_remitente       NVARCHAR(256)  NOT NULL CONSTRAINT DF_correo_cuentas_nombre DEFAULT (N'Grupo Lefarma'),
        smtp_servidor          VARCHAR(256)   NOT NULL CONSTRAINT DF_correo_cuentas_host DEFAULT ('mail.grupolefarma.com.mx'),
        smtp_puerto            INT            NOT NULL CONSTRAINT DF_correo_cuentas_puerto DEFAULT (587),
        usar_ssl               BIT            NOT NULL CONSTRAINT DF_correo_cuentas_ssl DEFAULT (1),
        aceptar_cert_invalidos BIT            NOT NULL CONSTRAINT DF_correo_cuentas_certs DEFAULT (1),
        timeout_ms             INT            NOT NULL CONSTRAINT DF_correo_cuentas_timeout DEFAULT (30000),
        password_cifrada       VARBINARY(512) NOT NULL,
        activo                 BIT            NOT NULL CONSTRAINT DF_correo_cuentas_activo DEFAULT (1),
        fecha_creacion         DATETIME       NOT NULL CONSTRAINT DF_correo_cuentas_fc DEFAULT (GETDATE()),
        fecha_modificacion     DATETIME       NULL
    );
END
GO

/* Cuenta inicial (SMTP validado: mail.grupolefarma.com.mx:587 STARTTLS). */
IF NOT EXISTS (SELECT 1 FROM app.correo_cuentas WHERE correo = 'autorizaciones@grupolefarma.com.mx')
INSERT INTO app.correo_cuentas
    (correo, nombre_remitente, smtp_servidor, smtp_puerto, usar_ssl,
     aceptar_cert_invalidos, timeout_ms, password_cifrada)
VALUES
    ('autorizaciones@grupolefarma.com.mx', N'Grupo Lefarma', 'mail.grupolefarma.com.mx', 587, 1,
     1, 30000, ENCRYPTBYPASSPHRASE(N'LfM@il.2026.S3cr3ta', N'Aut0r1z5c10n3s$$001'));
GO

/* Para agregar otra cuenta en el futuro:
INSERT INTO app.correo_cuentas
    (correo, nombre_remitente, smtp_servidor, smtp_puerto, usar_ssl,
     aceptar_cert_invalidos, timeout_ms, password_cifrada)
VALUES
    ('rh@grupolefarma.com.mx', N'Recursos Humanos', 'mail.grupolefarma.com.mx', 587, 1,
     1, 30000, ENCRYPTBYPASSPHRASE(N'LfM@il.2026.S3cr3ta', N'password-de-esa-cuenta'));
*/
GO

/* ---------------------------------------------------------------------------
   PARTE 2) SP de envío (Python / smtplib)
   --------------------------------------------------------------------------- */
CREATE OR ALTER PROCEDURE [app].[sp_enviar_correo]
    @correo_remitente VARCHAR(256),          -- cuenta registrada en app.correo_cuentas
    @nombre_remitente NVARCHAR(256) = NULL,  -- NULL = el nombre de la cuenta (ej. 'noreplay')
    @asunto           NVARCHAR(500),
    @destinatarios    NVARCHAR(MAX),         -- separados por ; o ,
    @body_html        NVARCHAR(MAX) = NULL,  -- cuerpo en modo HTML (uno u otro)
    @body_normal      NVARCHAR(MAX) = NULL,  -- cuerpo en texto plano (mas rapido)
    @copias           NVARCHAR(MAX) = NULL   -- CC, separadas por ; o ,
AS
BEGIN
    SET NOCOUNT ON;

    /* --- Credenciales de la cuenta (se descifran solo en memoria) --- */
    DECLARE @host VARCHAR(256), @puerto INT, @usar_ssl INT, @acepta_certs INT,
            @timeout_s INT, @nombre NVARCHAR(256), @pass NVARCHAR(256);

    SELECT @host       = smtp_servidor,
           @puerto     = smtp_puerto,
           @usar_ssl   = CONVERT(INT, usar_ssl),
           @acepta_certs = CONVERT(INT, aceptar_cert_invalidos),
           @timeout_s  = timeout_ms / 1000,
           @nombre     = nombre_remitente,
           @pass       = CONVERT(NVARCHAR(256),
                         DECRYPTBYPASSPHRASE(N'LfM@il.2026.S3cr3ta', password_cifrada))
    FROM app.correo_cuentas
    WHERE correo = @correo_remitente AND activo = 1;

    -- El nombre remitente se puede sobreescribir por llamada (NULL = el de la cuenta)
    IF @nombre_remitente IS NOT NULL AND LTRIM(RTRIM(@nombre_remitente)) <> ''
        SET @nombre = LTRIM(RTRIM(@nombre_remitente));

    IF @host IS NULL
        THROW 50001, 'Cuenta de correo no encontrada o inactiva en app.correo_cuentas.', 1;

    IF (@body_html IS NULL OR LTRIM(RTRIM(@body_html)) = '')
       AND (@body_normal IS NULL OR LTRIM(RTRIM(@body_normal)) = '')
        THROW 50002, 'Proporciona @body_html o @body_normal (el cuerpo es uno u otro).', 1;

    /* --- Envío vía Python (smtplib + MIME multipart/alternative) ---
       OJO: sp_execute_external_script tiene límite de argumentos (Msg 8144 si
       se satura su firma), así que todo viaja en UN solo payload JSON. */
    DECLARE @payload NVARCHAR(MAX) = (
        SELECT @host             AS host,
               @puerto           AS puerto,
               @correo_remitente AS usuario,
               @pass             AS password,
               @nombre           AS from_name,
               @destinatarios    AS para,
               @copias           AS cc,
               @asunto           AS subject,
               @body_html        AS html,
               @body_normal      AS normal,
               @usar_ssl         AS ssl,
               @acepta_certs     AS certs,
               @timeout_s        AS timeout_s
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
    );

    DECLARE @py NVARCHAR(MAX) = N'
import json
import re
import smtplib
import ssl
import pandas as pd
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

cfg = json.loads(payload)
to_list = [x.strip() for x in re.split("[;,]", cfg.get("para") or "") if x.strip()]
cc_list = [x.strip() for x in re.split("[;,]", cfg.get("cc") or "") if x.strip()]
if not to_list:
    raise ValueError("No hay destinatarios validos")

html = (cfg.get("html") or "").strip()
normal = (cfg.get("normal") or "").strip()

if html and normal:
    msg = MIMEMultipart("alternative")
    msg.attach(MIMEText(normal, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
elif html:
    msg = MIMEText(html, "html", "utf-8")
else:
    msg = MIMEText(normal, "plain", "utf-8")

msg["Subject"] = cfg["subject"]
msg["From"] = formataddr((cfg["from_name"], cfg["usuario"]))
msg["To"] = ", ".join(to_list)
if cc_list:
    msg["Cc"] = ", ".join(cc_list)

ctx = ssl._create_unverified_context() if cfg.get("certs") else ssl.create_default_context()
srv = smtplib.SMTP(cfg["host"], int(cfg["puerto"]), timeout=int(cfg["timeout_s"]))
srv.ehlo()
if cfg.get("ssl"):
    srv.starttls(context=ctx)
    srv.ehlo()
srv.login(cfg["usuario"], cfg["password"])
srv.sendmail(cfg["usuario"], to_list + cc_list, msg.as_string())
srv.quit()

OutputDataSet = pd.DataFrame({
    "estado": ["ENVIADO"],
    "detalle": ["De " + cfg["usuario"] + " a " + "; ".join(to_list + cc_list)]
})
';

    EXEC sp_execute_external_script
        @language = N'Python',
        @script   = @py,
        @params   = N'@payload nvarchar(max)',
        @payload  = @payload
    WITH RESULT SETS ((estado NVARCHAR(20), detalle NVARCHAR(1000)));
END
GO

/* ---------------------------------------------------------------------------
   PRUEBA (la primera ejecución tarda 30-60 s en levantar el runtime de Python)
   ---------------------------------------------------------------------------

-- Modo HTML:
EXEC app.sp_enviar_correo
    @correo_remitente = 'autorizaciones@grupolefarma.com.mx',
    @asunto           = N'Prueba SMTP desde SQL Server (HTML)',
    @destinatarios    = N'6@grupolefarma.com.mx',
    @copias           = NULL,
    @nombre_remitente = N'noreplay',
    @body_html        = N'<h1>Hola</h1><p>Correo de <b>prueba</b> en HTML.</p>';

-- Modo texto plano (mas rapido):
EXEC app.sp_enviar_correo
    @correo_remitente = 'autorizaciones@grupolefarma.com.mx',
    @asunto           = N'Prueba SMTP desde SQL Server (texto)',
    @destinatarios    = N'6@grupolefarma.com.mx',
    @nombre_remitente = N'noreplay',
    @body_normal      = N'Hola. Correo de prueba en texto plano.';

   Esperado: resultado con estado = ENVIADO y el correo llega en ~5 s.
   Si algo falla, el error de Python (traceback) aparece en los Messages:
   - timeout/connection refused -> firewall o servicio SMTP
   - 535 auth -> credenciales de la cuenta
   --------------------------------------------------------------------------- */
