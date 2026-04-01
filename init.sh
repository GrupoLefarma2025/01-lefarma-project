#!/usr/bin/env bash
set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
GRAY='\033[0;37m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PATH="$SCRIPT_DIR/lefarma.backend/src/Lefarma.API"
FRONTEND_PATH="$SCRIPT_DIR/lefarma.frontend"

BACKEND_PORT=5174
FRONTEND_PORT=5173

PUBLIC_IP="$(hostname -I | awk '{print $1}')"

LOG_DIR="/tmp/lefarma"
mkdir -p "$LOG_DIR"

COMMAND=""
TARGET="all"

if [ $# -eq 0 ]; then
    COMMAND="start"
else
    case "$1" in
        restart)
            COMMAND="restart"
            if [ $# -eq 2 ]; then
                case "$2" in
                    backend|frontend)
                        TARGET="$2"
                        ;;
                    *)
                        echo -e "${RED}Unknown target: $2 (use 'backend' or 'frontend')${NC}"
                        exit 1
                        ;;
                esac
            fi
            ;;
        stop|--stop)
            COMMAND="stop"
            ;;
        start|--start)
            COMMAND="start"
            ;;
        status|--status)
            COMMAND="status"
            ;;
        logs)
            COMMAND="logs"
            ;;
        *)
            echo -e "${RED}Unknown argument: $1${NC}"
            echo "Usage: $0 [restart [backend|frontend] | stop | start | status | logs]"
            exit 1
            ;;
    esac
fi

kill_tree() {
    local port=$1
    local label=$2
    local pids
    pids=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo -e "  ${GRAY}Killing $label on port $port...${NC}"
        for pid in $pids; do
            # kill children first
            local children
            children=$(pgrep -P "$pid" 2>/dev/null || true)
            for child in $children; do
                kill -9 "$child" 2>/dev/null || true
            done
            kill -9 "$pid" 2>/dev/null || true
        done
        sleep 1
        # second pass
        pids=$(lsof -ti :"$port" 2>/dev/null || true)
        for pid in $pids; do
            kill -9 "$pid" 2>/dev/null || true
        done
        sleep 1
        echo -e "  ${GREEN}$label stopped${NC}"
    else
        echo -e "  ${GRAY}$label already stopped (port $port free)${NC}"
    fi
}

wait_for_port() {
    local port=$1
    local name=$2
    local max_wait=${3:-90}
    local elapsed=0
    echo -ne "  ${GRAY}Waiting for $name on port $port ...${NC}"
    while [ $elapsed -lt $max_wait ]; do
        if lsof -ti :"$port" >/dev/null 2>&1; then
            echo -e " ${GREEN}UP${NC} (~${elapsed}s)"
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
        echo -n "."
    done
    echo ""
    echo -e "  ${RED}$name FAILED to start within ${max_wait}s${NC}"
    echo -e "  ${GRAY}Check: tail -30 $LOG_DIR/$name.log${NC}"
    return 1
}

start_backend() {
    echo -e "${YELLOW}Starting Backend (.NET + Hot Reload)...${NC}"
    > "$LOG_DIR/backend.log"
    cd "$BACKEND_PATH"
    setsid dotnet watch run --launch-profile http >> "$LOG_DIR/backend.log" 2>&1 &
    cd "$SCRIPT_DIR"
    wait_for_port "$BACKEND_PORT" "backend" 90
}

start_frontend() {
    echo -e "${YELLOW}Starting Frontend (Vite + HMR)...${NC}"
    > "$LOG_DIR/frontend.log"
    cd "$FRONTEND_PATH"
    setsid ./node_modules/.bin/vite --host 0.0.0.0 --port "$FRONTEND_PORT" >> "$LOG_DIR/frontend.log" 2>&1 &
    cd "$SCRIPT_DIR"
    wait_for_port "$FRONTEND_PORT" "frontend" 30
}

stop_backend() {
    kill_tree "$BACKEND_PORT" "Backend"
}

stop_frontend() {
    kill_tree "$FRONTEND_PORT" "Frontend"
}

print_usage() {
    echo -e "  ${YELLOW}Commands:${NC}"
    echo -e "  ${GRAY}  ./init.sh                      Start both${NC}"
    echo -e "  ${GRAY}  ./init.sh restart               Restart both${NC}"
    echo -e "  ${GRAY}  ./init.sh restart backend        Restart backend only${NC}"
    echo -e "  ${GRAY}  ./init.sh restart frontend       Restart frontend only${NC}"
    echo -e "  ${GRAY}  ./init.sh stop                   Stop both${NC}"
    echo -e "  ${GRAY}  ./init.sh status                 Check what's running${NC}"
    echo -e "  ${GRAY}  ./init.sh logs                   Tail both logs${NC}"
}

print_urls() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Services Ready!${NC}"
    echo -e "${GREEN}========================================${NC}"
    if [ "$TARGET" = "all" ] || [ "$TARGET" = "backend" ]; then
        echo -e "  Backend:  ${CYAN}http://$PUBLIC_IP:$BACKEND_PORT${NC}"
        echo -e "  Swagger:  ${CYAN}http://$PUBLIC_IP:$BACKEND_PORT/swagger${NC}"
    fi
    if [ "$TARGET" = "all" ] || [ "$TARGET" = "frontend" ]; then
        echo -e "  Frontend: ${CYAN}http://$PUBLIC_IP:$FRONTEND_PORT${NC}"
    fi
    echo ""
    echo -e "  ${GRAY}Logs: $LOG_DIR/backend.log | frontend.log${NC}"
    echo ""
    print_usage
    echo ""
}

show_status() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  Lefarma Status${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    local b_pid f_pid
    b_pid=$(lsof -ti :"$BACKEND_PORT" 2>/dev/null || true)
    f_pid=$(lsof -ti :"$FRONTEND_PORT" 2>/dev/null || true)

    if [ -n "$b_pid" ]; then
        echo -e "  Backend  ($BACKEND_PORT): ${GREEN}RUNNING${NC}  PID: $b_pid"
    else
        echo -e "  Backend  ($BACKEND_PORT): ${RED}STOPPED${NC}"
    fi

    if [ -n "$f_pid" ]; then
        echo -e "  Frontend ($FRONTEND_PORT): ${GREEN}RUNNING${NC}  PID: $f_pid"
    else
        echo -e "  Frontend ($FRONTEND_PORT): ${RED}STOPPED${NC}"
    fi
    echo ""
}

case "$COMMAND" in
    stop)
        echo -e "${CYAN}========================================${NC}"
        echo -e "${RED}  Stopping All Services${NC}"
        echo -e "${CYAN}========================================${NC}"
        echo ""
        stop_backend
        stop_frontend
        echo ""
        echo -e "${GREEN}Done.${NC}"
        ;;
    restart)
        echo -e "${CYAN}========================================${NC}"
        echo -e "${YELLOW}  Restarting${NC}"
        [ "$TARGET" = "all" ] && echo -e "${YELLOW}  (backend + frontend)${NC}" || echo -e "${YELLOW}  ($TARGET only)${NC}"
        echo -e "${CYAN}========================================${NC}"
        echo ""

        if [ "$TARGET" = "all" ] || [ "$TARGET" = "backend" ]; then
            stop_backend
            start_backend
        fi

        if [ "$TARGET" = "all" ] || [ "$TARGET" = "frontend" ]; then
            stop_frontend
            start_frontend
        fi

        print_urls
        ;;
    start)
        echo -e "${CYAN}========================================${NC}"
        echo -e "${CYAN}  Lefarma Init${NC}"
        echo -e "${GREEN}  Hot Reload Enabled${NC}"
        echo -e "${CYAN}========================================${NC}"
        echo ""

        kill_tree "$BACKEND_PORT" "Backend"
        kill_tree "$FRONTEND_PORT" "Frontend"
        echo ""

        start_backend
        echo ""
        start_frontend

        print_urls
        ;;
    status)
        show_status
        ;;
    logs)
        echo -e "${YELLOW}Tailing logs (Ctrl+C to exit)...${NC}"
        tail -f "$LOG_DIR/backend.log" "$LOG_DIR/frontend.log"
        ;;
esac
