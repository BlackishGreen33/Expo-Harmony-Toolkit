import { hapTasks } from '@ohos/hvigor-ohos-plugin';
import { createRNOHModulePlugin } from '@rnoh/hvigor-plugin';

export default {
  system: hapTasks,
  plugins: [
    createRNOHModulePlugin({
      // Expo Harmony Toolkit writes autolinking artifacts during sync/build.
      // Disable hvigor-side autolinking so it does not rewrite them with stale templates.
      autolinking: null,
      codegen: {
        rnohModulePath: './oh_modules/@rnoh/react-native-openharmony',
      },
    }),
  ],
};
