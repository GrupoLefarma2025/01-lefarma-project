#!/bin/bash
# Script para poblar catálogo de Formas de Pago

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

echo ""
echo "=== Creando Formas de Pago ==="

create_forma_pago() {
    local nombre=$1
    local clave=$2
    local descripcion=$3

    RESPONSE=$(curl -s "$API_URL/catalogos/formaspago" \
      -H "$AUTH_HEADER" \
      -H "Content-Type: application/json" \
      -d "{
        \"nombre\": \"$nombre\",
        \"clave\": \"$clave\",
        \"descripcion\": \"$descripcion\",
        \"activo\": true
      }")

    ID=$(echo "$RESPONSE" | jq -r '.data.idFormaPago // empty')

    if [ -n "$ID" ]; then
        echo "  ✓ Forma de pago creada: $nombre (ID: $ID)"
    else
        ERROR=$(echo "$RESPONSE" | jq -r '.errors[0].description // "Unknown error"')
        if [[ "$ERROR" == *"Already exists"* ]] || [[ "$ERROR" == *"Ya existe"* ]] || [[ "$ERROR" == *"already"* ]]; then
            echo "  ✓ Forma de pago ya existe: $nombre"
        else
            echo "  ✗ Error creando forma de pago $nombre: $ERROR"
        fi
    fi
}

echo "Formas de pago:"
create_forma_pago "Pago a contado" "EFO" "Pago total al momento"
create_forma_pago "Pago a crédito" "CRE" "Pago diferido según acuerdo con proveedor"
create_forma_pago "Pago parcial" "PAR" "Anticipo + saldo pendiente"

echo ""
echo "✓ Proceso completado"
echo ""
echo "Resumen:"
echo "- 3 Formas de pago creadas"
echo "  * Pago a contado (EFO)"
echo "  * Pago a crédito (CRE)"
echo "  * Pago parcial (PAR)"
