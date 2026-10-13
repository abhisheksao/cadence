// Declares react-native-background-actions' service as a media-playback foreground service.
// Android 14+ refuses to start a foreground service without a declared type (research R5).
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const SERVICE = 'com.asterinet.react.bgactions.RNBackgroundActionsTask';

module.exports = function withBackgroundActions(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.service = (app.service ?? []).filter((s) => s.$['android:name'] !== SERVICE);
    app.service.push({
      $: {
        'android:name': SERVICE,
        'android:foregroundServiceType': 'mediaPlayback',
        'android:exported': 'false',
      },
    });
    return cfg;
  });
};
