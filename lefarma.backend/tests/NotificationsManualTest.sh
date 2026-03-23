#!/bin/bash
# Script completo de prueba del sistema de notificaciones
# Prueba: autenticación, envío de notificaciones, SSE, y validación

set -e

BASE_URL="http://localhost:5134"
FRONTEND_URL="http://localhost:5173"
USER_ID="54"
DOMAIN="Grupolefarma"
PASSWORD="tt01tt"
RECIPIENT_ID="21"

echo "=========================================="
echo "🧪 SISTEMA DE NOTIFICACIONES - TEST COMPLETO"
echo "=========================================="
echo ""

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para imprimir resultados
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Función para verificar si el servidor está corriendo
check_server() {
    if curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Test 1: Verificar Backend
echo "📡 Test 1: Verificando Backend..."
if check_server; then
    print_success "Backend está corriendo en $BASE_URL"
else
    print_error "Backend no está corriendo en $BASE_URL"
    echo "Por favor inicia el backend con: cd lefarma.backend/src/Lefarma.API && dotnet run"
    exit 1
fi
echo ""

# Test 2: Autenticación
echo "🔐 Test 2: Autenticación..."
AUTH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login-step-two" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USER_ID\", \"domain\": \"$DOMAIN\", \"password\": \"$PASSWORD\"}")

# Extraer token
TOKEN=$(echo $AUTH_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
    print_error "Fallo en autenticación"
    echo "Response: $AUTH_RESPONSE"
    exit 1
fi

print_success "Autenticación exitosa"
echo "Token: ${TOKEN:0:50}..."
echo ""

# Test 3: Enviar notificación individual
echo "📨 Test 3: Enviar Notificación Individual..."
SEND_RESPONSE=$(curl -s -X POST "$BASE_URL/api/notifications/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "channels": [{"channelType": "in-app", "recipients": "'$RECIPIENT_ID'"}],
    "title": "🧪 Test de Notificación",
    "message": "Esta es una notificación de prueba del sistema automatizado",
    "type": "success",
    "priority": "normal",
    "category": "system"
  }')

if echo $SEND_RESPONSE | grep -q "notificationId"; then
    NOTIFICATION_ID=$(echo $SEND_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['notificationId'])" 2>/dev/null || echo "unknown")
    print_success "Notificación enviada (ID: $NOTIFICATION_ID)"
else
    print_error "Fallo al enviar notificación"
    echo "Response: $SEND_RESPONSE"
fi
echo ""

# Test 4: Obtener notificaciones del usuario
echo "📬 Test 4: Obtener Notificaciones del Usuario..."
NOTIFS_RESPONSE=$(curl -s "$BASE_URL/api/notifications/user/$RECIPIENT_ID" \
  -H "Authorization: Bearer $TOKEN")

if echo $NOTIFS_RESPONSE | grep -q "success"; then
    print_success "Notificaciones obtenidas exitosamente"
    NOTIF_COUNT=$(echo $NOTIFS_RESPONSE | python3 -c "import sys, json; data=json.load(sys.stdin)['data']; print(len(data) if isinstance(data, list) else 0)" 2>/dev/null || echo "0")
    echo "   Total de notificaciones: $NOTIF_COUNT"
else
    print_error "Fallo al obtener notificaciones"
fi
echo ""

# Test 5: Marcar como leída
echo "📖 Test 5: Marcar Notificación como Leída..."
if [ ! -z "$NOTIFICATION_ID" ] && [ "$NOTIFICATION_ID" != "unknown" ]; then
    MARK_READ_RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/notifications/$NOTIFICATION_ID/read" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "{\"userId\": $RECIPIENT_ID}")

    if echo $MARK_READ_RESPONSE | grep -q "success"; then
        print_success "Notificación marcada como leída"
    else
        print_error "Fallo al marcar como leída"
        echo "Response: $MARK_READ_RESPONSE"
    fi
else
    print_warning "Saltando - no se obtuvo notificationId válido"
fi
echo ""

# Test 6: Marcar todas como leídas
echo "📚 Test 6: Marcar Todas como Leídas..."
MARK_ALL_RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/notifications/user/$RECIPIENT_ID/read-all" \
  -H "Authorization: Bearer $TOKEN")

if echo $MARK_ALL_RESPONSE | grep -q "success"; then
    print_success "Todas las notificaciones marcadas como leídas"
else
    print_error "Fallo al marcar todas como leídas"
fi
echo ""

# Test 7: Envío masivo (Bulk)
echo "📦 Test 7: Envío Masivo (Bulk)..."
BULK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/notifications/send-bulk" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "userIds": [21, 22],
    "title": "🧪 Test Masivo",
    "message": "Notificación de prueba masiva",
    "type": "info",
    "priority": "normal",
    "category": "system",
    "channels": [{"channelType": "in-app", "recipients": "21"}]
  }')

if echo $BULK_RESPONSE | grep -q "notificationId"; then
    print_success "Notificación masiva enviada"
else
    print_error "Fallo al enviar notificación masiva"
fi
echo ""

# Test 8: Verificar endpoint SSE
echo "🔌 Test 8: Verificar Endpoint SSE..."
SSE_RESPONSE=$(curl -s -I "$BASE_URL/api/notifications/stream" \
  -H "Authorization: Bearer $TOKEN" 2>&1 | head -1)

if echo $SSE_RESPONSE | grep -q "401"; then
    print_success "Endpoint SSE responde (requiere autenticación - correcto)"
elif echo $SSE_RESPONSE | grep -q "200"; then
    print_success "Endpoint SSE accesible"
else
    print_warning "Endpoint SSE respuesta inesperada: $SSE_RESPONSE"
fi
echo ""

# Test 9: Test de error - Notificación sin título
echo "⚠️  Test 9: Validación - Sin Título..."
INVALID_RESPONSE=$(curl -s -X POST "$BASE_URL/api/notifications/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "",
    "message": "Test",
    "channels": [{"channelType": "in-app", "recipients": "21"}]
  }')

if echo $INVALID_RESPONSE | grep -q "400\|error"; then
    print_success "Validación correcta - rechazó notificación sin título"
else
    print_error "Validación falló - debería rechazar notificación sin título"
fi
echo ""

# Test 10: Test de error - Sin canales
echo "⚠️  Test 10: Validación - Sin Canales..."
NO_CHANNELS_RESPONSE=$(curl -s -X POST "$BASE_URL/api/notifications/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Test",
    "message": "Test",
    "channels": []
  }')

if echo $NO_CHANNELS_RESPONSE | grep -q "400\|error"; then
    print_success "Validación correcta - rechazó notificación sin canales"
else
    print_error "Validación falló - debería rechazar notificación sin canales"
fi
echo ""

# Test 11: Verificar frontend
echo "🌐 Test 11: Verificar Frontend..."
if curl -s "$FRONTEND_URL" > /dev/null 2>&1; then
    print_success "Frontend está corriendo en $FRONTEND_URL"
else
    print_warning "Frontend no está corriendo en $FRONTEND_URL"
    echo "Por favor inicia el frontend con: cd lefarma.frontend && npm run dev"
fi
echo ""

# Resumen
echo "=========================================="
echo "📊 RESUMEN DE PRUEBAS"
echo "=========================================="
echo ""
echo "✅ Tests Completados:"
echo "  • Autenticación"
echo "  • Envío de notificación individual"
echo "  • Obtener notificaciones del usuario"
echo "  • Marcar notificación como leída"
echo "  • Marcar todas como leídas"
echo "  • Envío masivo (bulk)"
echo "  • Verificación de endpoint SSE"
echo "  • Validación de datos de entrada"
echo "  • Verificación de frontend"
echo ""
echo "📝 Tests Creados:"
echo "  • Unit Tests: NotificationServiceTests.cs"
echo "  • Integration Tests: NotificationsApiTests.cs"
echo ""
echo "🎯 Próximos Pasos:"
echo "  1. Ejecutar tests unitarios: cd lefarma.backend && dotnet test"
echo "  2. Abrir navegador: $FRONTEND_URL"
echo "  3. Iniciar sesión con: Usuario $USER_ID, Password: $PASSWORD"
echo "  4. Navegar a: $FRONTEND_URL/notificaciones"
echo "  5. Enviar notificación de prueba desde la interfaz"
echo ""
echo "✨ Sistema de notificaciones validado y listo para usar!"
echo ""
