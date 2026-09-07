import { RNAbility } from '@rnoh/react-native-openharmony';
{{ARKWEB_IMPORT}}

export default class EntryAbility extends RNAbility {
{{ARKWEB_ON_CREATE}}
  override getPagePath() {
    return 'pages/Index';
  }

  override getRNOHWorkerScriptUrl() {
    return 'entry/ets/workers/RNOHWorker.ets';
  }
}
