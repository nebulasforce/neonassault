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
  make release MSG="说明"           提交、打 tag、等待 APK / Win / mac / 鸿蒙挂上 Release
  make release VERSION=1.2.1 MSG="说明"
  make release WAIT=0 MSG="说明"    推完即返回，不等待打包
  make tag                          用当前 package.json 版本打 tag 并推送（不提交）
  make wait                         等待当前版本的 GitHub Actions 打包结束

环境：若本机 127.0.0.1:7890 有代理，会自动走它，避免直连 GitHub 卡住。
EOF
}

github_repo() {
  local url
  url="$(git remote get-url origin 2>/dev/null || true)"
  url="${url%.git}"
  url="${url#git@github.com:}"
  url="${url#https://github.com/}"
  url="${url#ssh://git@github.com/}"
  echo "$url"
}

# 查询 tag 对应的 Release 工作流和资源。stdout 为 KEY=value。
release_status() {
  local repo="$1" ref="$2"
  python3 - "$repo" "$ref" <<'PY'
import json, sys, urllib.error, urllib.request
repo, tag = sys.argv[1], sys.argv[2]
headers = {"User-Agent": "neonassault-release-wait", "Accept": "application/vnd.github+json"}

def get(url):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

try:
    runs = get(f"https://api.github.com/repos/{repo}/actions/runs?per_page=15")
except Exception as e:
    print("STATE=error")
    print("ERROR=" + str(e).replace("\n", " "))
    sys.exit(0)

run = None
for r in runs.get("workflow_runs", []):
    if r.get("name") == "Release packages" and r.get("head_branch") == tag:
        run = r
        break
if not run:
    print("STATE=pending")
    print("CONCLUSION=")
    print("RUN=")
else:
    print(f"STATE={run.get('status') or 'unknown'}")
    print(f"CONCLUSION={run.get('conclusion') or ''}")
    print(f"RUN={run.get('html_url') or ''}")

try:
    rel = get(f"https://api.github.com/repos/{repo}/releases/tags/{tag}")
except urllib.error.HTTPError as e:
    if e.code == 404:
        print("ASSETS=")
        print("DRAFT=")
        print("URL=")
        sys.exit(0)
    print("ASSETS=")
    print("DRAFT=")
    print("URL=")
    sys.exit(0)
except Exception:
    print("ASSETS=")
    print("DRAFT=")
    print("URL=")
    sys.exit(0)

names = [a["name"] for a in rel.get("assets") or []]
print("ASSETS=" + ",".join(names))
print("DRAFT=" + str(bool(rel.get("draft"))).lower())
print(f"URL={rel.get('html_url') or ''}")
PY
}

wait_for_packages() {
  local ref="$1"
  local repo elapsed now start
  local wait_on="${WAIT:-1}"
  local timeout="${WAIT_TIMEOUT:-2400}"
  repo="$(github_repo)"

  echo "工作流：https://github.com/${repo}/actions"
  echo "Release：https://github.com/${repo}/releases/tag/${ref}"

  if [[ "$wait_on" != "1" ]]; then
    echo "WAIT=0，不等待打包。"
    return 0
  fi

  echo "→ 等待 GitHub Actions 把 APK / Win / mac / 鸿蒙挂上 ${ref}（最多 $((timeout / 60)) 分钟，WAIT=0 可跳过）"
  start="$(date +%s)"
    local state conclusion run_url assets draft rel_url err
    while true; do
    now="$(date +%s)"
    elapsed=$((now - start))
    if (( elapsed > timeout )); then
      echo "等待超时。进度：https://github.com/${repo}/actions" >&2
      exit 1
    fi

    state=pending
    conclusion=
    run_url=
    assets=
    draft=
    rel_url=
    err=
    while IFS= read -r line; do
      case "$line" in
        STATE=*) state="${line#STATE=}" ;;
        CONCLUSION=*) conclusion="${line#CONCLUSION=}" ;;
        RUN=*) run_url="${line#RUN=}" ;;
        ASSETS=*) assets="${line#ASSETS=}" ;;
        DRAFT=*) draft="${line#DRAFT=}" ;;
        URL=*) rel_url="${line#URL=}" ;;
        ERROR=*) err="${line#ERROR=}" ;;
      esac
    done < <(release_status "$repo" "$ref" || true)

    printf '… %sm%ss  ' "$((elapsed / 60))" "$((elapsed % 60))"
    if [[ "$state" == "error" ]]; then
      printf '查询 GitHub 失败，重试'
      [[ -n "$err" ]] && printf '（%s）' "$err"
    else
      printf 'Actions=%s' "$state"
      [[ -n "$conclusion" ]] && printf '/%s' "$conclusion"
    fi
    printf '\n'

    if [[ "$state" == "completed" && "$conclusion" == "failure" ]]; then
      echo "打包失败：${run_url:-https://github.com/${repo}/actions}" >&2
      exit 1
    fi

    if [[ ",$assets," == *",neonassault-android-universal.apk,"* && "$draft" == "false" ]]; then
      echo
      echo "打包完成：${rel_url:-https://github.com/${repo}/releases/tag/${ref}}"
      echo "下载："
      local f
      IFS=',' read -ra _assets <<< "$assets"
      for f in "${_assets[@]}"; do
        [[ -n "$f" ]] && echo "  https://github.com/${repo}/releases/download/${ref}/${f}"
      done
      return 0
    fi

    if [[ "$state" == "completed" && "$conclusion" == "success" ]]; then
      echo "CI 显示成功，但 Release 上还没有 APK（多半是 Immutable Releases 没挂上文件）。" >&2
      echo "${run_url:-https://github.com/${repo}/actions}" >&2
      exit 1
    fi

    sleep 25
  done
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
    echo "已推送 ${git_ref}"
    wait_for_packages "${git_ref}"
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
    wait_for_packages "${git_ref}"
    ;;
  wait)
    enable_proxy
    git_ref="${TAG:-v$(pkg_version)}"
    wait_for_packages "${git_ref}"
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
