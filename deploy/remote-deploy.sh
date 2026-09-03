#!/usr/bin/env bash
# 腾讯云远端：用 Docker nginx 拉起静态站（配置/站点/安装包全部外挂）
# 目录约定（本脚本所在目录，默认 /data/neonassault）：
#   www/  files/  nginx/default.conf  logs/  docker-compose.yml
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
NGINX_IMAGE="${NGINX_IMAGE:-docker.m.daocloud.io/library/nginx:1.27-alpine}"
NA_DATA_DIR="${NA_DATA_DIR:-${SCRIPT_DIR}}"
NA_HTTP_PORT="${NA_HTTP_PORT:-80}"
LOG_DIR="${SCRIPT_DIR}/logs"
LOG_FILE="${LOG_DIR}/deploy-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "${SCRIPT_DIR}/www" "${SCRIPT_DIR}/files" "${SCRIPT_DIR}/nginx" "${LOG_DIR}"

exec > >(tee -a "${LOG_FILE}") 2>&1

ts() { date '+%Y-%m-%d %H:%M:%S'; }
step=0
total_steps=6

progress() {
  step=$((step + 1))
  printf '\n[%s] [%d/%d] ▶ %s\n' "$(ts)" "${step}" "${total_steps}" "$*"
}
ok() { printf '[%s]   ✓ %s\n' "$(ts)" "$*"; }
warn() { printf '[%s]   ! %s\n' "$(ts)" "$*"; }
fail() { printf '[%s]   ✗ %s\n' "$(ts)" "$*"; exit 1; }

have_compose() {
  docker compose version >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1
}

ensure_compose() {
  if have_compose; then
    return 0
  fi
  warn "未找到 docker compose，尝试安装 docker-compose-plugin"
  if command -v dnf >/dev/null 2>&1; then
    dnf install -y docker-compose-plugin || true
  elif command -v yum >/dev/null 2>&1; then
    yum install -y docker-compose-plugin || true
  fi
  have_compose
}

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "${COMPOSE_FILE}" "$@"
  else
    docker-compose -f "${COMPOSE_FILE}" "$@"
  fi
}

run_nginx_container() {
  docker rm -f neonassault-web >/dev/null 2>&1 || true
  docker run -d \
    --name neonassault-web \
    --restart unless-stopped \
    -p "${NA_HTTP_PORT}:80" \
    -v "${NA_DATA_DIR}/www:/usr/share/nginx/html:ro" \
    -v "${NA_DATA_DIR}/files:/data/releases:ro" \
    -v "${NA_DATA_DIR}/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro" \
    -v "${NA_DATA_DIR}/logs:/var/log/nginx" \
    "${NGINX_IMAGE}"
}

pull_image() {
  local images=(
    "${NGINX_IMAGE}"
    "docker.m.daocloud.io/library/nginx:1.27-alpine"
    "nginx:1.27-alpine"
  )
  local img
  for img in "${images[@]}"; do
    printf '[%s]   … 拉取 %s\n' "$(ts)" "${img}"
    if docker pull "${img}"; then
      NGINX_IMAGE="${img}"
      return 0
    fi
  done
  return 1
}

progress "环境检查"
command -v docker >/dev/null 2>&1 || fail "docker 未安装"
USE_COMPOSE=0
if ensure_compose; then
  USE_COMPOSE=1
  ok "将使用 docker compose"
else
  warn "无 compose 插件，回退为 docker run（同样外挂 www/files/nginx/logs）"
fi
ok "工作目录: ${SCRIPT_DIR}"
ok "目标镜像: ${NGINX_IMAGE}"
ok "日志文件: ${LOG_FILE}"

if [[ ! -f "${SCRIPT_DIR}/nginx/default.conf" ]]; then
  fail "缺少 nginx/default.conf"
fi
if [[ ! -f "${SCRIPT_DIR}/www/index.html" ]]; then
  fail "缺少 www/index.html，请先同步 web 构建产物"
fi
if [[ "${USE_COMPOSE}" -eq 1 && ! -f "${COMPOSE_FILE}" ]]; then
  fail "缺少 ${COMPOSE_FILE}，请先从本机同步部署文件"
fi

export NGINX_IMAGE
export NA_DATA_DIR
export NA_HTTP_PORT

progress "拉取 nginx 镜像"
if pull_image; then
  ok "镜像就绪: ${NGINX_IMAGE}"
  docker image inspect "${NGINX_IMAGE}" --format 'ID={{.Id}} Size={{.Size}}' || true
else
  fail "无法拉取 nginx 镜像（已尝试 DaoCloud 与 Docker Hub）"
fi

progress "停止旧容器"
if [[ "${USE_COMPOSE}" -eq 1 ]]; then
  compose stop web 2>/dev/null || warn "web 服务尚未运行，跳过 stop"
  compose rm -f web 2>/dev/null || true
fi
docker rm -f neonassault-web 2>/dev/null || true
ok "旧 web 容器已清理"

progress "启动 Docker nginx（外挂 www / files / nginx / logs）"
if [[ "${USE_COMPOSE}" -eq 1 ]]; then
  compose up -d --remove-orphans
  ok "compose up 完成"
else
  run_nginx_container
  ok "docker run 完成"
fi

progress "等待站点就绪"
deadline=$((SECONDS + 60))
ready=0
while (( SECONDS < deadline )); do
  if docker inspect -f '{{.State.Running}}' neonassault-web 2>/dev/null | grep -q true; then
    if docker exec neonassault-web wget -qO- http://127.0.0.1/ >/dev/null 2>&1; then
      ready=1
      break
    fi
  fi
  printf '[%s]   … 等待中\n' "$(ts)"
  sleep 3
done
if [[ "${ready}" -eq 1 ]]; then
  ok "http://127.0.0.1/ 已响应"
else
  warn "60s 内未完全就绪，请检查下方状态与日志"
  docker logs --tail=40 neonassault-web || true
fi

progress "部署结果摘要"
if [[ "${USE_COMPOSE}" -eq 1 ]]; then
  compose ps
else
  docker ps --filter name=neonassault-web
fi
echo
ok "最近 nginx 日志（最多 40 行）:"
docker logs --tail=40 neonassault-web || true

echo
ok "外挂目录:"
printf '  www:    %s/www\n' "${SCRIPT_DIR}"
printf '  files:  %s/files\n' "${SCRIPT_DIR}"
printf '  nginx:  %s/nginx/default.conf\n' "${SCRIPT_DIR}"
printf '  logs:   %s/logs\n' "${SCRIPT_DIR}"
printf '  游戏:   http://<host>/\n'
printf '  安装包: http://<host>/releases/\n'

echo
printf '[%s] ========== 部署结束 ==========\n' "$(ts)"
printf '[%s] 日志已保存: %s\n' "$(ts)" "${LOG_FILE}"
printf '[%s] 常用命令:\n' "$(ts)"
printf '  docker exec neonassault-web nginx -s reload\n'
printf '  docker logs -f neonassault-web\n'
printf '  tail -f %s/access.log\n' "${LOG_DIR}"
