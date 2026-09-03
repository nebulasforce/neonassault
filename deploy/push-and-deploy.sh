#!/usr/bin/env bash
# 本机一键：构建 web →（可选）同步 GitHub Release 安装包 → rsync 到腾讯云 → 远端 Docker nginx 拉起
# 日常只换网页：SKIP_RELEASES=1 make deploy-tencent
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

REMOTE_HOST="${REMOTE_HOST:-root@118.25.79.136}"
REMOTE_DIR="${REMOTE_DIR:-/data/neonassault}"
NGINX_IMAGE="${NGINX_IMAGE:-docker.m.daocloud.io/library/nginx:1.27-alpine}"
SKIP_RELEASES="${SKIP_RELEASES:-0}"
RELEASE_TAG="${RELEASE_TAG:-}"
NA_HTTP_PORT="${NA_HTTP_PORT:-80}"
DIST_WEB="${ROOT_DIR}/dist-web"
DIST_REL="${ROOT_DIR}/dist-releases"

if nc -z -w 1 127.0.0.1 "${PROXY_PORT:-7890}" >/dev/null 2>&1; then
  export https_proxy="${https_proxy:-http://127.0.0.1:${PROXY_PORT:-7890}}"
  export http_proxy="${http_proxy:-$https_proxy}"
  export HTTPS_PROXY="$https_proxy"
  export HTTP_PROXY="$http_proxy"
fi

ts() { date '+%Y-%m-%d %H:%M:%S'; }
step=0
total_steps=5
if [[ "${SKIP_RELEASES}" == "1" ]]; then
  total_steps=4
fi

progress() {
  step=$((step + 1))
  printf '\n[%s] [%d/%d] ▶ %s\n' "$(ts)" "${step}" "${total_steps}" "$*"
}
ok() { printf '[%s]   ✓ %s\n' "$(ts)" "$*"; }
fail() { printf '[%s]   ✗ %s\n' "$(ts)" "$*"; exit 1; }

ssh_base() {
  if [[ -n "${SSHPASS:-}" ]] && command -v sshpass >/dev/null 2>&1; then
    sshpass -e ssh -o StrictHostKeyChecking=accept-new \
      -o PreferredAuthentications=password -o PubkeyAuthentication=no "$@"
  else
    ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "$@"
  fi
}

rsync_rsh() {
  if [[ -n "${SSHPASS:-}" ]] && command -v sshpass >/dev/null 2>&1; then
    printf 'sshpass -e ssh -o StrictHostKeyChecking=accept-new -o PreferredAuthentications=password -o PubkeyAuthentication=no'
  else
    printf 'ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new'
  fi
}

progress "构建 Web 发行版 dist-web/"
node scripts/build-web.js --out dist-web
[[ -f "${DIST_WEB}/index.html" ]] || fail "构建失败，缺少 dist-web/index.html"
ok "本地站点: ${DIST_WEB}"

if [[ "${SKIP_RELEASES}" != "1" ]]; then
  progress "同步 GitHub Release 安装包到 dist-releases/"
  RELEASE_TAG="${RELEASE_TAG}" bash deploy/sync-releases.sh
  node scripts/gen-releases-json.js \
    --mode mirror \
    --files "${DIST_REL}" \
    --out "${DIST_WEB}/releases/releases.json" \
    --play-url "/"
  ok "安装包清单已写入 dist-web/releases/releases.json"
else
  ok "SKIP_RELEASES=1，跳过安装包下载"
  mkdir -p "${DIST_WEB}/releases"
  if [[ -d "${DIST_REL}" ]] && ls "${DIST_REL}"/*/ >/dev/null 2>&1; then
    node scripts/gen-releases-json.js \
      --mode mirror \
      --files "${DIST_REL}" \
      --out "${DIST_WEB}/releases/releases.json" \
      --play-url "/"
    ok "沿用本地 dist-releases 生成国内直链清单"
  elif [[ -f "${ROOT_DIR}/web/releases/releases.json" ]]; then
    cp "${ROOT_DIR}/web/releases/releases.json" "${DIST_WEB}/releases/releases.json"
    ok "无本地安装包，沿用仓库内 GitHub 清单"
  fi
fi

progress "同步站点 / 安装包 / 部署文件到 ${REMOTE_HOST}:${REMOTE_DIR}"
ssh_base "${REMOTE_HOST}" \
  "mkdir -p '${REMOTE_DIR}/www' '${REMOTE_DIR}/files' '${REMOTE_DIR}/nginx' '${REMOTE_DIR}/logs'"

RSH="$(rsync_rsh)"
rsync -az --delete --exclude '.DS_Store' -e "${RSH}" \
  "${DIST_WEB}/" "${REMOTE_HOST}:${REMOTE_DIR}/www/"
ok "已同步 www/"

if [[ "${SKIP_RELEASES}" != "1" ]] && [[ -d "${DIST_REL}" ]]; then
  rsync -az --exclude '.DS_Store' -e "${RSH}" \
    "${DIST_REL}/" "${REMOTE_HOST}:${REMOTE_DIR}/files/"
  ok "已同步 files/"
fi

# scp 没有 -e；有密码时走 sshpass
if [[ -n "${SSHPASS:-}" ]] && command -v sshpass >/dev/null 2>&1; then
  sshpass -e scp -o StrictHostKeyChecking=accept-new \
    -o PreferredAuthentications=password -o PubkeyAuthentication=no \
    "${ROOT_DIR}/deploy/docker-compose.tencent.yml" \
    "${REMOTE_HOST}:${REMOTE_DIR}/docker-compose.yml"
  sshpass -e scp -o StrictHostKeyChecking=accept-new \
    -o PreferredAuthentications=password -o PubkeyAuthentication=no \
    "${ROOT_DIR}/deploy/nginx/default.conf" \
    "${REMOTE_HOST}:${REMOTE_DIR}/nginx/default.conf"
  sshpass -e scp -o StrictHostKeyChecking=accept-new \
    -o PreferredAuthentications=password -o PubkeyAuthentication=no \
    "${ROOT_DIR}/deploy/remote-deploy.sh" \
    "${REMOTE_HOST}:${REMOTE_DIR}/remote-deploy.sh"
else
  scp -o BatchMode=yes \
    "${ROOT_DIR}/deploy/docker-compose.tencent.yml" \
    "${REMOTE_HOST}:${REMOTE_DIR}/docker-compose.yml"
  scp -o BatchMode=yes \
    "${ROOT_DIR}/deploy/nginx/default.conf" \
    "${REMOTE_HOST}:${REMOTE_DIR}/nginx/default.conf"
  scp -o BatchMode=yes \
    "${ROOT_DIR}/deploy/remote-deploy.sh" \
    "${REMOTE_HOST}:${REMOTE_DIR}/remote-deploy.sh"
fi
ssh_base "${REMOTE_HOST}" "chmod +x '${REMOTE_DIR}/remote-deploy.sh'"
ok "已同步 docker-compose.yml / nginx/default.conf / remote-deploy.sh"

progress "远端执行 Docker nginx 部署"
ssh_base "${REMOTE_HOST}" \
  "cd '${REMOTE_DIR}' && NGINX_IMAGE='${NGINX_IMAGE}' NA_DATA_DIR='${REMOTE_DIR}' NA_HTTP_PORT='${NA_HTTP_PORT}' ./remote-deploy.sh"
ok "远端部署脚本执行结束"

progress "本机侧完成"
ok "远端目录: ${REMOTE_HOST}:${REMOTE_DIR}"
ok "外挂: www/ files/ nginx/ logs/"
ok "日常热更网页: SKIP_RELEASES=1 make deploy-tencent"
REMOTE_IP="${REMOTE_HOST#*@}"
ok "游戏:    http://${REMOTE_IP}/"
ok "安装包:  http://${REMOTE_IP}/releases/"
