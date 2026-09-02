import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    hilog.info(0x0000, 'NeonAssault', 'EntryAbility onCreate');
  }

  onDestroy(): void {
    hilog.info(0x0000, 'NeonAssault', 'EntryAbility onDestroy');
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    const mainWindow = windowStage.getMainWindowSync();
    mainWindow.setWindowLayoutFullScreen(true);
    mainWindow.setWindowKeepScreenOn(true);
    mainWindow.setPreferredOrientation(window.Orientation.AUTO_ROTATION_LANDSCAPE)
      .catch(() => {
        hilog.error(0x0000, 'NeonAssault', 'landscape lock fail');
      });

    windowStage.loadContent('pages/Index', (err) => {
      if (err && err.code) {
        hilog.error(0x0000, 'NeonAssault', `loadContent failed: %{public}s`, JSON.stringify(err) ?? '');
        return;
      }
      hilog.info(0x0000, 'NeonAssault', 'loadContent success');
    });
  }
}
