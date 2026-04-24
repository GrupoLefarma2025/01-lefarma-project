#!/usr/bin/env python3
"""
SQL Server Query Tool - Solo Lectura
Valida, genera .sql y ejecuta SELECTs y EXECs de SPs/funciones
"""

import re
import sys
import os
import yaml
import subprocess
import argparse
from datetime import datetime
from pathlib import Path

# ======================
# CONFIGURACIÓN
# ======================
SKILL_DIR = Path.home() / ".hermes" / "skills" / "sql-server-query"
CONNECTIONS_FILE = SKILL_DIR / "connections.yaml"
OUTPUT_DIR = Path.home() / "Downloads"  # o ~/query_outputs/

# ======================
# PALABRAS PROHIBIDAS
# ======================
FORBIDDEN = [
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE",
    "MERGE", "BULK INSERT", "RESTORE", "GRANT", "DENY", "REVOKE",
    "INSERT INTO", "UPDATE FROM", "DELETE FROM", "DROP TABLE", "DROP COLUMN",
    "ALTER TABLE", "ALTER COLUMN", "TRUNCATE TABLE", "CREATE TABLE",
    "CREATE PROCEDURE", "CREATE FUNCTION", "CREATE VIEW", "CREATE INDEX",
    "CREATE TRIGGER", "xp_cmdshell", "EXECUTE (si no es EXEC de SP)",
    "DROP PROC", "DROP FUNCTION", "DROP VIEW", "DROP INDEX",
    "DISABLE TRIGGER", "ENABLE TRIGGER", "sp_configure", "reconfigure"
]

# ======================
# CARGAR CONEXIONES
# ======================
def load_connections():
    if not CONNECTIONS_FILE.exists():
        print(f"ERROR: {CONNECTIONS_FILE} no existe")
        sys.exit(1)
    
    with open(CONNECTIONS_FILE, "r") as f:
        data = yaml.safe_load(f)
    
    return data.get("connections", {})

def get_connection_string(conn_name: str) -> str:
    conns = load_connections()
    
    if conn_name not in conns:
        available = ", ".join(conns.keys())
        print(f"ERROR: Conexión '{conn_name}' no encontrada")
        print(f"Disponibles: {available}")
        sys.exit(1)
    
    c = conns[conn_name]
    return (
        f"Server={c['server']};Database={c['database']};"
        f"User Id={c['username']};Password={c['password']};"
        f"Connection Timeout=360;TrustServerCertificate=true;Encrypt=false"
    )

# ======================
# VALIDACIÓN
# ======================
def validate_query(query: str) -> tuple[bool, str]:
    """
    Retorna (es_seguro, mensaje_error)
    """
    upper = query.upper()
    
    for word in FORBIDDEN:
        if word.upper() in upper:
            return False, f"PALABRA PROHIBIDA detectada: {word}"
    
    # EXEC sin proc/function es sospechoso
    if re.match(r'^\s*EXEC\s+sp_', upper) or re.match(r'^\s*EXEC\s+\[?dbo\]?\.?sp_', upper):
        return True, "EXEC de SP detectado - requerirá confirmación"
    
    if re.match(r'^\s*EXEC\s+', upper):
        return True, "EXEC detectado - requerirá confirmación"
    
    return True, "OK"

# ======================
# GENERAR .SQL
# ======================
def generate_sql_file(query: str, connection_name: str, database: str) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"query_{timestamp}.sql"
    filepath = OUTPUT_DIR / filename
    
    header = f"""-- =============================================
-- SQL Server Query
-- Generated: {datetime.now().isoformat()}
-- Connection: {connection_name}
-- Database: {database}
-- =============================================

"""
    
    with open(filepath, "w") as f:
        f.write(header)
        f.write(query)
        f.write("\n\n-- =============================================\n")
    
    return filepath

# ======================
# EJECUTAR QUERY
# ======================
def execute_query(query: str, conn_string: str, conn_name: str) -> dict:
    """
    Ejecuta query usando sqlcmd
    Retorna dict con 'success', 'output', 'error'
    """
    # Generar archivo .sql temporal
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    temp_sql = f"/tmp/query_{timestamp}.sql"
    
    with open(temp_sql, "w") as f:
        f.write(query)
    
    try:
        result = subprocess.run(
            [
                "sqlcmd",
                "-S", "192.168.4.2",  # Extraer server de connection string
                "-U", "coreapi",
                "-P", "L4_CL4VE_S3cReta_Y_sUp3r__SEGUR4_123!",
                "-d", "Lefarma",  # Esta se overridea
                "-i", temp_sql,
                "-s", ",",
                "-W",  # trim whitespace
                "-r", "1"  # stderr to stdout
            ],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        return {
            "success": result.returncode == 0,
            "output": result.stdout,
            "error": result.stderr
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "output": "",
            "error": "Timeout: query tardó más de 60 segundos"
        }
    except FileNotFoundError:
        return {
            "success": False,
            "output": "",
            "error": "sqlcmd no encontrado. Instalar: sudo apt install mssql-tools18"
        }
    finally:
        if os.path.exists(temp_sql):
            os.remove(temp_sql)

# ======================
# QUERIES PREDEFINIDOS
# ======================
QUERY_STRUCTURE = """
SELECT 
    c.COLUMN_NAME,
    c.DATA_TYPE,
    c.CHARACTER_MAXIMUM_LENGTH,
    c.NUMERIC_PRECISION,
    c.NUMERIC_SCALE,
    c.IS_NULLABLE,
    c.COLUMN_DEFAULT,
    CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'PK' ELSE '' END AS CONSTRAINT_TYPE
FROM INFORMATION_SCHEMA.COLUMNS c
LEFT JOIN (
    SELECT ku.COLUMN_NAME
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku 
        ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
    WHERE tc.TABLE_NAME = '{table}' AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
WHERE c.TABLE_NAME = '{table}'
ORDER BY c.ORDINAL_POSITION;
"""

QUERY_TABLES = """
SELECT 
    TABLE_NAME,
    TABLE_TYPE
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE IN ('BASE TABLE', 'VIEW')
ORDER BY TABLE_NAME;
"""

QUERY_PROCEDURES = """
SELECT 
    ROUTINE_NAME,
    ROUTINE_DEFINITION
FROM INFORMATION_SCHEMA.ROUTINES
WHERE ROUTINE_TYPE = 'PROCEDURE'
ORDER BY ROUTINE_NAME;
"""

QUERY_FUNCTIONS = """
SELECT 
    ROUTINE_NAME,
    DATA_TYPE AS RETURN_TYPE,
    ROUTINE_DEFINITION
FROM INFORMATION_SCHEMA.ROUTINES
WHERE ROUTINE_TYPE = 'FUNCTION'
ORDER BY ROUTINE_NAME;
"""

QUERY_SELECT_ALL = "SELECT TOP {limit} * FROM {table} ORDER BY 1;"

# ======================
# MAIN
# ======================
def main():
    parser = argparse.ArgumentParser(description="SQL Server Query Tool (Solo Lectura)")
    parser.add_argument("query", help="Query SQL a ejecutar")
    parser.add_argument("-c", "--connection", default="Lefarma", help="Nombre de conexión")
    parser.add_argument("--dry-run", action="store_true", help="Solo genera .sql sin ejecutar")
    parser.add_argument("--list-connections", action="store_true", help="Lista conexiones disponibles")
    parser.add_argument("--add-connection", help="Agregar conexión (nombre:server:database:user:pass)")
    
    args = parser.parse_args()
    
    # Listar conexiones
    if args.list_connections:
        conns = load_connections()
        print("Conexiones disponibles:")
        for name, c in conns.items():
            print(f"  - {name}: {c['server']}/{c['database']}")
        return
    
    # Agregar conexión
    if args.add_connection:
        parts = args.add_connection.split(":")
        if len(parts) != 5:
            print("Formato: nombre:server:database:user:pass")
            sys.exit(1)
        
        conns = load_connections()
        name, server, db, user, passwd = parts
        conns[name] = {
            "name": name,
            "server": server,
            "database": db,
            "username": user,
            "password": passwd
        }
        
        with open(CONNECTIONS_FILE, "w") as f:
            yaml.dump({"connections": conns}, f, default_flow_style=False)
        
        print(f"Conexión '{name}' agregada")
        return
    
    # Cargar conexión
    conns = load_connections()
    if args.connection not in conns:
        print(f"Conexión '{args.connection}' no encontrada")
        print("Usa --list-connections para ver disponibles")
        sys.exit(1)
    
    c = conns[args.connection]
    conn_string = get_connection_string(args.connection)
    
    query = args.query
    
    # Validar
    is_safe, message = validate_query(query)
    if not is_safe:
        print(f"❌ BLOQUEADO: {message}")
        print("Esta herramienta SOLO ejecuta SELECTs y EXECs de SPs/funciones")
        sys.exit(1)
    
    print(f"✓ Validación: {message}")
    
    # Generar .sql
    filepath = generate_sql_file(query, args.connection, c["database"])
    print(f"\n📄 Archivo generado: {filepath}")
    
    # Mostrar contenido
    print("\n--- CONTENIDO ---")
    with open(filepath, "r") as f:
        print(f.read())
    
    if args.dry_run:
        print("\n⚠️ Modo dry-run: no se ejecutó nada")
        return
    
    # Detectar si es EXEC
    is_exec = bool(re.match(r'^\s*EXEC\s+', query.upper()))
    
    if is_exec:
        print("\n⚠️ Procedimiento almacenado detectado")
        print("Se necesita confirmación del usuario para ejecutar")
        # En uso real via Hermes, esto sería una pregunta al usuario
        print("(En contexto de Hermes, se pediría: '¿Ejecuto este SP? (si/no)')")
        return
    
    # Ejecutar SELECT
    print("\n🚀 Ejecutando query...")
    result = execute_query(query, conn_string, args.connection)
    
    if result["success"]:
        print("\n✅ RESULTADO:")
        print(result["output"])
    else:
        print(f"\n❌ ERROR: {result['error']}")

if __name__ == "__main__":
    main()
