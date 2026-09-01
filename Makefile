# 霓虹突袭 · 提交与发版
#
#   make push MSG="说明"                 提交并推送（触发 GitHub Pages）
#   make release MSG="说明"              提交 + 打 tag（触发 APK / Win / mac / 鸿蒙 Release）
#   make release VERSION=1.2.1 MSG="说明"
#   make tag                             仅按当前版本打 tag 推送
#
# 本机 127.0.0.1:7890 有代理时会自动走代理，避免直连 GitHub 卡住。

.PHONY: help push release tag

MSG ?=
VERSION ?=
PROXY_PORT ?= 7890

help:
	@./scripts/na-git.sh help

push:
	@MSG="$(MSG)" PROXY_PORT="$(PROXY_PORT)" ./scripts/na-git.sh push

release:
	@MSG="$(MSG)" VERSION="$(VERSION)" PROXY_PORT="$(PROXY_PORT)" ./scripts/na-git.sh release

tag:
	@PROXY_PORT="$(PROXY_PORT)" ./scripts/na-git.sh tag
