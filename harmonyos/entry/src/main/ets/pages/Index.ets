import { webview } from '@kit.ArkWeb';
import { deviceInfo } from '@kit.BasicServicesKit';
import { promptAction } from '@kit.ArkUI';

@Entry
@Component
struct Index {
  controller: webview.WebviewController = new webview.WebviewController();
  @State progress: number = 0;
  @State loaded: boolean = false;
  private lastBackTime: number = 0;

  aboutToAppear(): void {
    // 开发期打开 Web 调试（发布前可关闭）
    this.controller.setWebDebuggingAccess(true);
    // WebAudio 需要放开静音，否则游戏音效不会响
    this.controller.setAudioMuted(false);
  }

  /**
   * 返回键：优先回退网页历史，无历史时 2 秒内连按两次退出
   */
  onBackPress(): boolean {
    if (this.controller.accessBackward()) {
      this.controller.backward();
      return true; // 事件已消费
    }
    const now = Date.now();
    if (now - this.lastBackTime < 2000) {
      return false; // 交给系统退出
    }
    this.lastBackTime = now;
    promptAction.showToast({ message: '再按一次退出霓虹突袭', duration: 2000 });
    return true;
  }

  build() {
    Stack() {
      Web({ src: $rawfile('web/index.html'), controller: this.controller })
        .width('100%')
        .height('100%')
        .backgroundColor('#05070f')
        // 基础能力：rawfile 子资源与本地图片必须放开
        .javaScriptAccess(true)
        .domStorageAccess(true)
        .fileAccess(true)
        .imageAccess(true)
        .databaseAccess(false)
        .mixedMode(MixedMode.All)
        // 游戏不需要缩放 / 定位 / 文本选择
        .zoomAccess(false)
        .geolocationAccess(false)
        .textSelectionAccess(false)
        .overScrollMode(OverScrollMode.NEVER)
        .cacheMode(CacheMode.Default)
        .userAgent('Mozilla/5.0 (Linux; HarmonyOS; NEON ASSAULT) AppleWebKit/537.36 Chrome/114 Mobile Safari/537.36')
        .javaScriptProxy({
          object: {
            platform: () => deviceInfo.osFullName,
            keepAwake: () => {}
          },
          name: 'HarmonyOSBridge',
          methodList: ['platform', 'keepAwake'],
          controller: this.controller
        })
        .onProgressChange((event) => {
          if (event) {
            this.progress = event.newProgress;
          }
        })
        .onPageEnd(() => {
          this.loaded = true;
          console.info('NeonAssault page end');
        })
        .onErrorReceive((event) => {
          console.error(`NeonAssault web error: ${event?.error?.getErrorInfo()}`);
        })

      // 首帧加载进度条：避免白屏观感
      if (!this.loaded) {
        Column() {
          Progress({ value: this.progress, total: 100, type: ProgressType.Linear })
            .width('60%')
            .color('#7df9ff')
        }
        .width('100%')
        .height('100%')
        .justifyContent(FlexAlign.Center)
        .backgroundColor('#05070f')
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#05070f')
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM, SafeAreaEdge.START, SafeAreaEdge.END])
  }
}
