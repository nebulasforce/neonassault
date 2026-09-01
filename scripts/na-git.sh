#!/usr/bin/env bash
# 提交 / 推送 / 打 tag。推 tag 会触发 .github/workflows/release.yml 打包 Release。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

cmd="${1:-help}"
shift || true

usage() {
  cat <<'EOF'
用法：
  make push MSG="说明"              提交并推到 origin（触发 GitHub Pages）
  make release MSG="说明"           提交、打 tag、推送（触发 APK / Win / mac / 鸿蒙打包）
  make release VERSION=1.2.1 MSG="说明"
  make tag                          用当前 package.json 版本打 tag 并推送（不提交）

环境：若本机 127.0.0.1:7890 有代理，会自动走它，避免直连 GitHub 卡住。
EOF
}

enable_proxy() {
  local port="${PROXY_PORT:-7890}"
  if (echo >/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1; then
    export http_proxy="${http_proxy:-http://127.0.0.1:${port}}"
    export https_proxy="${https_proxy:-http://127.0.0.1:${port}}"
    export all_proxy="${all_proxy:-socks5://127.0.0.1:${port}}"
    export HTTP_PROXY="$http_proxy"
    export HTTPS_PROXY="$https_proxy"
    export ALL_PROXY="$all_proxy"
    echo "→ 使用本机代理 $https_proxy"
  else
    echo "→ 未检测到 127.0.0.1:${port}，直连 GitHub"
  fi
}

pkg_version() {
  node -p "require('./package.json').version"
}

set_version() {
  local ver="$1"
  node -e '
    const fs = require("fs");
    const v = process.argv[1];
    const p = JSON.parse(fs.readFileSync("package.json", "utf8"));
    p.version = v;
    fs.writeFileSync("package.json", JSON.stringify(p, null, 2) + "\n");
  ' "$ver"

  python3 - "$ver" <<'PY'
import pathlib, re, sys
ver = sys.argv[1]
gradle = pathlib.Path("android/app/build.gradle")
text = gradle.read_text()
m = re.search(r"versionCode\s+(\d+)", text)
code = int(m.group(1)) + 1 if m else 1
text = re.sub(r'versionCode\s+\d+', f"versionCode {code}", text, count=1)
text = re.sub(r'versionName\s+"[^"]+"', f'versionName "{ver}"', text, count=1)
gradle.write_text(text)

app = pathlib.Path("harmonyos/AppScope/app.json5")
raw = app.read_text()
m = re.search(r'"versionCode"\s*:\s*(\d+)', raw)
hcode = int(m.group(1)) + 1 if m else 1000000
raw = re.sub(r'"versionCode"\s*:\s*\d+', f'"versionCode": {hcode}', raw, count=1)
raw = re.sub(r'"versionName"\s*:\s*"[^"]+"', f'"versionName": "{ver}"', raw, count=1)
app.write_text(raw)
print(f"版本已写为 {ver}（Android versionCode {code}）")
PY
}

bump_patch() {
  node -p "const v=require('./package.json').version.split('.').map(Number); v[2]+=1; v.join('.')"
}

tag_exists() {
  local ref="$1"
  git rev-parse -q --verify "refs/tags/${ref}" >/dev/null 2>&1 && return 0
  git ls-remote --exit-code --tags origin "refs/tags/${ref}" >/dev/null 2>&1
}

commit_if_dirty() {
  local msg="${MSG:-}"
  git add -A
  if git diff --cached --quiet; then
    echo "工作区干净，跳过提交。"
    return 0
  fi
  if [[ -z "$msg" ]]; then
    echo "有未提交改动，请带说明：make $cmd MSG=\"一句话\"" >&2
    git status --short
    exit 1
  fi
  git commit -m "$msg"
}

push_branch() {
  local branch
  branch="$(git rev-parse --abbrev-ref HEAD)"
  git push -u origin "HEAD:refs/heads/${branch}"
}

push_tag() {
  local ref="$1"
  git tag -a "${ref}" -m "${ref}"
  git push origin "${ref}"
}

case "$cmd" in
  help|-h|--help)
    usage
    ;;
  push)
    enable_proxy
    commit_if_dirty
    push_branch
    echo "已推送。Pages：https://nebulasforce.github.io/neonassault/"
    echo "工作流：https://github.com/nebulasforce/neonassault/actions"
    ;;
  release)
    enable_proxy
    ver="${VERSION:-}"
    if [[ -z "$ver" ]]; then
      ver="$(pkg_version)"
      if tag_exists "v$ver"; then
        ver="$(bump_patch)"
        echo "v$(pkg_version) 已存在，自动升到 $ver"
        set_version "$ver"
      fi
    else
      set_version "$ver"
    fi
    commit_if_dirty
    push_branch
    git_ref="v$(pkg_version)"
    if tag_exists "${git_ref}"; then
      echo "tag ${git_ref} 已存在。指定新版本：make release VERSION=x.y.z MSG=\"...\"" >&2
      exit 1
    fi
    push_tag "${git_ref}"
    echo "已推送 ${git_ref}，GitHub Actions 正在打包："
    echo "https://github.com/nebulasforce/neonassault/actions"
    echo "Release: https://github.com/nebulasforce/neonassault/releases/tag/${git_ref}"
    ;;
  tag)
    enable_proxy
    git_ref="v$(pkg_version)"
    if tag_exists "${git_ref}"; then
      echo "tag ${git_ref} 已存在。" >&2
      exit 1
    fi
    push_tag "${git_ref}"
    echo "已推送 ${git_ref}"
    echo "Release: https://github.com/nebulasforce/neonassault/releases/tag/${git_ref}"
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
