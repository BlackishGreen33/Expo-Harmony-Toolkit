const V2_SAMPLE_LANE_GROUPS = [
  {
    id: 'managed-verified',
    projects: [
      {
        id: 'official-minimal',
        root: 'examples/official-minimal-sample',
        entry: 'index.js',
        targetTier: 'verified',
        expectedCoverageProfile: 'managed-core',
        expectedEligibility: 'eligible',
        marker: 'EXPO_HARMONY_V2_SAMPLE:official-minimal',
      },
      {
        id: 'official-app-shell',
        root: 'examples/official-app-shell-sample',
        entry: 'index.js',
        targetTier: 'verified',
        expectedCoverageProfile: 'managed-core',
        expectedEligibility: 'eligible',
        marker: 'EXPO_HARMONY_V2_SAMPLE:official-app-shell',
      },
      {
        id: 'official-ui-stack',
        root: 'examples/official-ui-stack-sample',
        entry: 'index.js',
        targetTier: 'verified',
        expectedCoverageProfile: 'managed-core',
        expectedEligibility: 'eligible',
        marker: 'EXPO_HARMONY_V2_SAMPLE:official-ui-stack',
      },
    ],
  },
  {
    id: 'preview-foundation',
    projects: [
      {
        id: 'official-native-capabilities',
        root: 'examples/official-native-capabilities-sample',
        entry: 'index.js',
        targetTier: 'preview',
        expectedCoverageProfile: 'managed-native-heavy',
        expectedEligibility: 'eligible',
        marker: 'EXPO_HARMONY_V2_SAMPLE:official-native-capabilities',
        capabilityRoutePrefix: '/',
        capabilityRouteDirectory: 'app',
      },
    ],
  },
  {
    id: 'bare',
    projects: [
      {
        id: 'official-bare',
        root: 'examples/official-bare-sample',
        entry: 'index.js',
        targetTier: 'experimental',
        expectedCoverageProfile: 'bare',
        expectedEligibility: 'eligible',
        marker: 'EXPO_HARMONY_V2_SAMPLE:official-bare',
      },
    ],
  },
  {
    id: 'wave-a',
    projects: [
      {
        id: 'official-wave-a',
        root: 'examples/official-wave-a-sample',
        entry: 'index.js',
        targetTier: 'experimental',
        expectedCoverageProfile: 'third-party-native-heavy',
        expectedEligibility: 'eligible',
        marker: 'EXPO_HARMONY_V2_SAMPLE:official-wave-a',
        capabilityRoutePrefix: '/third-party-wave-a/',
        capabilityRouteDirectory: 'app/third-party-wave-a',
        capabilityRouteFiles: {
          '/gesture-handler': 'app/third-party-wave-a/gesture-handler.tsx',
        },
      },
    ],
  },
  {
    id: 'wave-b',
    projects: [
      {
        id: 'official-wave-b',
        root: 'examples/official-wave-b-sample',
        entry: 'index.js',
        targetTier: 'experimental',
        expectedCoverageProfile: 'third-party-native-heavy',
        expectedEligibility: 'eligible',
        marker: 'EXPO_HARMONY_V2_SAMPLE:official-wave-b',
        capabilityRoutePrefix: '/third-party-wave-b/',
        capabilityRouteDirectory: 'app/third-party-wave-b',
      },
    ],
  },
];

const V2_SAMPLE_PROJECTS = V2_SAMPLE_LANE_GROUPS.flatMap((group) => group.projects);

module.exports = {
  V2_SAMPLE_LANE_GROUPS,
  V2_SAMPLE_PROJECTS,
};
