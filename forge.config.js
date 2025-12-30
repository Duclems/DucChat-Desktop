const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

const path = require('path');

module.exports = {
  packagerConfig: {
    asar: true,
    // Icône de l'application pour Windows (.ico requis)
    icon: path.resolve(__dirname, 'public/icons/logo/app.ico'),
    // Nom du produit (déjà dans package.json mais peut être redéfini ici)
    name: 'DucChat',
    // Copier les icônes dans resources/ pour qu'elles soient accessibles en production
    // extraResource copie les fichiers/dossiers dans resources/ (en dehors de app.asar)
    // Copier uniquement les fichiers d'icônes nécessaires (pas les .md)
    extraResource: [
      path.resolve(__dirname, 'public/icons/logo/app.ico'),
      path.resolve(__dirname, 'public/icons/logo/DucVoice.png'),
      path.resolve(__dirname, 'public/icons/logo/DucVoice.svg'),
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        // S'assurer que l'icône est utilisée pour l'installateur
        // L'icône de l'app est déjà définie dans packagerConfig.icon
        setupIcon: path.resolve(__dirname, 'public/icons/logo/app.ico'),
        loadingGif: undefined, // Pas de GIF de chargement
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
        // If you are familiar with Vite configuration, it will look really familiar.
        build: [
          {
            // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
            entry: 'src/main.js',
            config: 'vite.main.config.mjs',
            target: 'main',
          },
          {
            entry: 'src/preload.js',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.mjs',
          },
        ],
      },
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
