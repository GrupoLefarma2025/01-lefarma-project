#!/bin/bash
# Script para poblar catálogos de Empresas y Sucursales

API_URL="http://localhost:5000/api"
USERNAME="54"
PASSWORD="tt01tt"

echo "=== Paso 1: Buscar dominios del usuario ==="
STEP1_RESPONSE=$(curl -s "$API_URL/auth/login-step-one" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME\"}")

AVAILABLE_DOMAIN=$(echo "$STEP1_RESPONSE" | jq -r '.data.domains[0] // empty')

if [ -z "$AVAILABLE_DOMAIN" ]; then
    echo "No se encontraron dominios para el usuario"
    exit 1
fi

echo "Dominio encontrado: $AVAILABLE_DOMAIN"

echo ""
echo "=== Paso 2: Autenticando ==="
STEP2_RESPONSE=$(curl -s "$API_URL/auth/login-step-two" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$USERNAME\",
    \"password\": \"$PASSWORD\",
    \"domain\": \"$AVAILABLE_DOMAIN\"
  }")

TOKEN=$(echo "$STEP2_RESPONSE" | jq -r '.data.accessToken // empty')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
    echo "Error de autenticación"
    echo "$STEP2_RESPONSE" | jq .
    exit 1
fi

echo "✓ Autenticación exitosa"

AUTH_HEADER="Authorization: Bearer $TOKEN"

# Función para crear sucursal con descripción y clave contable
create_sucursal() {
    local id_empresa=$1
    local nombre=$2
    local clave=$3
    local descripcion=$4
    local clave_contable=$5

    RESPONSE=$(curl -s "$API_URL/catalogos/sucursales" \
      -H "$AUTH_HEADER" \
      -H "Content-Type: application/json" \
      -d "{
        \"idEmpresa\": $id_empresa,
        \"nombre\": \"$nombre\",
        \"clave\": \"$clave\",
        \"descripcion\": \"$descripcion\",
        \"claveContable\": \"$clave_contable\",
        \"latitud\": 0,
        \"longitud\": 0,
        \"activo\": true
      }")

    ID=$(echo "$RESPONSE" | jq -r '.data.idSucursal // empty')

    if [ -n "$ID" ]; then
        echo "  ✓ Sucursal creada: $nombre (ID: $ID)"
    else
        ERROR=$(echo "$RESPONSE" | jq -r '.errors[0].description // "Unknown error"')
        if [[ "$ERROR" == *"Already exists"* ]] || [[ "$ERROR" == *"Ya existe"* ]] || [[ "$ERROR" == *"already"* ]]; then
            echo "  ✓ Sucursal ya existe: $nombre"
        else
            echo "  ✗ Error creando sucursal $nombre: $ERROR"
        fi
    fi
}

echo ""
echo "=== Creando Sucursales ==="

# Sucursales de Asokam (ID: 7)
echo ""
echo "Sucursales de Asokam (ID: 7):"
create_sucursal 7 "Antonio Maura" "101" "Sucursal Antonio Maura" "ASK-101-CC"
create_sucursal 7 "Guadalajara" "102" "Sucursal Guadalajara" "ASK-102-CC"
create_sucursal 7 "Cedis" "103" "Centro de distribución" "ASK-103-CC"

# Sucursales de Lefarma (ID: 8)
echo ""
echo "Sucursales de Lefarma (ID: 8):"
create_sucursal 8 "Planta" "101" "Planta de producción" "LEF-101-CC"
create_sucursal 8 "Mancera" "102" "Sucursal Gabriel Mancera" "LEF-102-CC"

# Sucursales de Artricenter (ID: 1)
echo ""
echo "Sucursales de Artricenter (ID: 1):"
create_sucursal 1 "Viaducto" "101" "Sucursal Viaducto" "ATC-101-CC"
create_sucursal 1 "La Raza" "102" "Sucursal La Raza" "ATC-102-CC"
create_sucursal 1 "Atizapan" "103" "Sucursal Atizapan" "ATC-103-CC"

# Sucursales de Construmedika (ID: 11)
echo ""
echo "Sucursales de Construmedika (ID: 11):"
create_sucursal 11 "Unica" "001" "Única sucursal" "CON-001-CC"

# Sucursales de Grupo Lefarma (ID: 12)
echo ""
echo "Sucursales de Grupo Lefarma (ID: 12):"
create_sucursal 12 "Oficinas centrales" "001" "Oficinas corporativas" "GRP-001-CC"

echo ""
echo "✓ Proceso completado"
echo ""
echo "Resumen:"
echo "- 5 Empresas (Asokam, Lefarma, Artricenter, Construmedika, GrupoLefarma)"
echo "- 12 Sucursales totales"
echo "  * Asokam: 3 sucursales (Antonio Maura, Guadalajara, Cedis)"
echo "  * Lefarma: 2 sucursales (Planta, Mancera)"
echo "  * Artricenter: 3 sucursales (Viaducto, La Raza, Atizapan)"
echo "  * Construmedika: 1 sucursal (Unica)"
echo "  * GrupoLefarma: 1 sucursal (Oficinas centrales)"
