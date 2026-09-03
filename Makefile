# 霓虹突袭 · 提交与发版
#
#   make push MSG="说明"                 提交并推送（触发 GitHub Pages）
#   make release MSG="说明"              提交 + 打 tag + 等待 APK / Win / mac 挂上 Release
#   make release VERSION=1.2.1 MSG="说明"
#   make release WAIT=0 MSG="说明"       推完即返回
#   make tag                             仅按当前版本打 tag 推送
#   make wait                            等待当前版本打包结束
#   make deploy-tencent                  构建 web + 同步安装包 → Docker nginx（腾讯云）
#   make deploy-tencent SKIP_RELEASES=1  只热更网页，不重新拉 GitHub 安装包
#
# 本机 127.0.0.1:7890 有代理时会自动走代理，避免直连 GitHub 卡住。

.PHONY: help push release tag wait deploy-tencent sync-releases

MSG ?=
VERSION ?=
TAG ?=
WAIT ?= 1
WAIT_TIMEOUT ?= 2400
PROXY_PORT ?= 7890
REMOTE_HOST ?= root@118.25.79.136
REMOTE_DIR ?= /data/neonassault
NGINX_IMAGE ?= docker.m.daocloud.io/library/nginx:1.27-alpine
SKIP_RELEASES ?= 0
RELEASE_TAG ?=

help:
	@./scripts/na-git.sh help

push:
	@MSG="$(MSG)" PROXY_PORT="$(PROXY_PORT)" ./scripts/na-git.sh push

release:
	@MSG="$(MSG)" VERSION="$(VERSION)" WAIT="$(WAIT)" WAIT_TIMEOUT="$(WAIT_TIMEOUT)" PROXY_PORT="$(PROXY_PORT)" ./scripts/na-git.sh release

tag:
	@WAIT="$(WAIT)" WAIT_TIMEOUT="$(WAIT_TIMEOUT)" PROXY_PORT="$(PROXY_PORT)" ./scripts/na-git.sh tag

wait:
	@TAG="$(TAG)" WAIT=1 WAIT_TIMEOUT="$(WAIT_TIMEOUT)" PROXY_PORT="$(PROXY_PORT)" ./scripts/na-git.sh wait

sync-releases:
	@RELEASE_TAG="$(RELEASE_TAG)" ./deploy/sync-releases.sh

deploy-tencent:
	@REMOTE_HOST="$(REMOTE_HOST)" REMOTE_DIR="$(REMOTE_DIR)" NGINX_IMAGE="$(NGINX_IMAGE)" \
	SKIP_RELEASES="$(SKIP_RELEASES)" RELEASE_TAG="$(RELEASE_TAG)" \
	./deploy/push-and-deploy.sh
