#!/usr/bin/env bash
# 从 GitHub Releases 拉安装包到 dist-releases/<tag>/，供国内镜像托管。
# 默认只下载 latest 的全部资源。指定版本：RELEASE_TAG=v1.1.13
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

REPO="${GITHUB_REPO:-nebulasforce/neonassault}"
OUT_DIR="${ROOT_DIR}/dist-releases"
API="https://api.github.com/repos/${REPO}/releases?per_page=10"
WANT_TAG="${RELEASE_TAG:-}"
UA="neonassault-china-mirror"

if nc -z -w 1 127.0.0.1 "${PROXY_PORT:-7890}" >/dev/null 2>&1; then
  export https_proxy="${https_proxy:-http://127.0.0.1:${PROXY_PORT:-7890}}"
  export http_proxy="${http_proxy:-$https_proxy}"
  export HTTPS_PROXY="$https_proxy"
  export HTTP_PROXY="$http_proxy"
  printf '[%s]   ✓ 使用本机代理 %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${https_proxy}"
fi

ts() { date '+%Y-%m-%d %H:%M:%S'; }
ok() { printf '[%s]   ✓ %s\n' "$(ts)" "$*"; }
fail() { printf '[%s]   ✗ %s\n' "$(ts)" "$*"; exit 1; }

mkdir -p "${OUT_DIR}"
JSON="$(mktemp)"
LIST="$(mktemp)"
trap 'rm -f "${JSON}" "${LIST}"' EXIT

curl -fsSL -A "${UA}" -H 'Accept: application/vnd.github+json' "${API}" > "${JSON}"
[[ -s "${JSON}" ]] || fail "GitHub Releases API 为空"

python3 - "${JSON}" "${WANT_TAG}" "${LIST}" <<'PY'
import json, sys
releases = json.load(open(sys.argv[1], encoding="utf-8"))
published = [r for r in releases if not r.get("draft") and not r.get("prerelease")]
if not published:
    sys.exit("no published releases")
want = sys.argv[2]
target = next((r for r in published if r.get("tag_name") == want), None) if want else published[0]
if target is None:
    sys.exit(f"tag {want} not found")
with open(sys.argv[3], "w", encoding="utf-8") as out:
    out.write(target["tag_name"] + "\n")
    for a in target.get("assets") or []:
        out.write("\t".join([a["name"], str(int(a.get("size") or 0)), a["browser_download_url"]]) + "\n")
print(target["tag_name"])
PY

TAG="$(head -n1 "${LIST}")"
DEST="${OUT_DIR}/${TAG}"
mkdir -p "${DEST}"
ok "目标版本 ${TAG} → ${DEST}"

tail -n +2 "${LIST}" | while IFS=$'\t' read -r name size url; do
  dest="${DEST}/${name}"
  if [[ -f "${dest}" ]]; then
    have="$(wc -c < "${dest}" | tr -d ' ')"
    if [[ "${have}" == "${size}" ]]; then
      ok "已存在 ${name} (${size} bytes)"
      continue
    fi
  fi
  printf '[%s]   … 下载 %s (%s bytes)\n' "$(ts)" "${name}" "${size}"
  curl -L --fail --retry 5 --retry-all-errors --retry-delay 2 -A "${UA}" --continue-at - -o "${dest}.part" "${url}"
  mv "${dest}.part" "${dest}"
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "${dest}" | awk '{print $1}' > "${dest}.sha256"
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${dest}" | awk '{print $1}' > "${dest}.sha256"
  fi
  ok "完成 ${name}"
done

ok "安装包目录: ${DEST}"
ls -lh "${DEST}"
