/**
 * Hand-crafted sanitized lockfile fixtures (v2 and v3) modeled after real
 * rollup, esbuild, swc, lightningcss, sharp, and fsevents packages.
 */

export const COMPLETE_V3_LOCKFILE = {
  name: 'complete-app',
  version: '1.0.0',
  lockfileVersion: 3,
  packages: {
    '': {
      name: 'complete-app',
      version: '1.0.0',
      dependencies: { esbuild: '^0.24.0' },
    },
    'node_modules/esbuild': {
      version: '0.24.0',
      optionalDependencies: {
        '@esbuild/darwin-arm64': '0.24.0',
        '@esbuild/darwin-x64': '0.24.0',
        '@esbuild/linux-arm64': '0.24.0',
        '@esbuild/linux-x64': '0.24.0',
        '@esbuild/win32-x64': '0.24.0',
      },
    },
    'node_modules/@esbuild/darwin-arm64': { version: '0.24.0', cpu: ['arm64'], os: ['darwin'], optional: true },
    'node_modules/@esbuild/darwin-x64': { version: '0.24.0', cpu: ['x64'], os: ['darwin'], optional: true },
    'node_modules/@esbuild/linux-arm64': { version: '0.24.0', cpu: ['arm64'], os: ['linux'], optional: true },
    'node_modules/@esbuild/linux-x64': { version: '0.24.0', cpu: ['x64'], os: ['linux'], optional: true },
    'node_modules/@esbuild/win32-x64': { version: '0.24.0', cpu: ['x64'], os: ['win32'], optional: true },
  },
};

export const MAC_ONLY_ROLLUP_V3 = {
  name: 'mac-only-app',
  version: '1.0.0',
  lockfileVersion: 3,
  packages: {
    '': {
      name: 'mac-only-app',
      version: '1.0.0',
      dependencies: { rollup: '^4.0.0' },
    },
    'node_modules/rollup': {
      version: '4.68.8',
      optionalDependencies: {
        '@rollup/rollup-darwin-arm64': '4.68.8',
        '@rollup/rollup-linux-x64-gnu': '4.68.8',
        '@rollup/rollup-linux-x64-musl': '4.68.8',
        '@rollup/rollup-win32-x64-msvc': '4.68.8',
        fsevents: '~2.3.3',
      },
    },
    'node_modules/@rollup/rollup-darwin-arm64': {
      version: '4.68.8',
      cpu: ['arm64'],
      os: ['darwin'],
      optional: true,
    },
  },
};

export const LIBC_AND_NEGATION_V2 = {
  name: 'libc-app',
  version: '1.0.0',
  lockfileVersion: 2,
  packages: {
    '': {
      name: 'libc-app',
      version: '1.0.0',
      dependencies: { lightningcss: '^1.0.0' },
    },
    'node_modules/lightningcss': {
      version: '1.25.0',
      optionalDependencies: {
        'lightningcss-linux-x64-gnu': '1.25.0',
        'lightningcss-linux-x64-musl': '1.25.0',
        'lightningcss-not-win32': '1.25.0',
      },
    },
    'node_modules/lightningcss-linux-x64-gnu': {
      version: '1.25.0',
      os: ['linux'],
      cpu: ['x64'],
      libc: ['glibc'],
      optional: true,
    },
    'node_modules/lightningcss-linux-x64-musl': {
      version: '1.25.0',
      os: ['linux'],
      cpu: ['x64'],
      libc: ['musl'],
      optional: true,
    },
    'node_modules/lightningcss-not-win32': {
      version: '1.25.0',
      os: ['!win32'],
      cpu: ['arm64', 'x64'],
      libc: ['!musl'],
      optional: true,
    },
  },
};

export const WORKSPACE_AND_NESTED_V3 = {
  name: 'monorepo',
  version: '1.0.0',
  lockfileVersion: 3,
  packages: {
    '': {
      name: 'monorepo',
      workspaces: ['packages/app'],
    },
    'packages/app': {
      name: '@mono/app',
      version: '1.0.0',
      dependencies: { sharp: '^0.33.0' },
    },
    'node_modules/@mono/app': {
      resolved: 'packages/app',
      link: true,
    },
    'packages/app/node_modules/sharp': {
      version: '0.33.0',
      optionalDependencies: {
        '@img/sharp-linux-x64': '0.33.0',
        '@img/sharp-universal': '0.33.0',
      },
    },
    'packages/app/node_modules/@img/sharp-linux-x64': {
      version: '0.33.0',
      os: ['linux'],
      cpu: ['x64'],
      optional: true,
    },
    'node_modules/@img/sharp-universal': {
      version: '0.33.0',
      optional: true,
    },
  },
};
