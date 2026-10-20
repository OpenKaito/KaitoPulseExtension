// Builds vendor/primus-core with the fork's own webpack.config.js, restricted to
// the entries modules/primus.ts ships. The fork's `pnpm run build` also compiles
// the Primus Home page and zips the whole output; neither reaches this
// extension and together they double the build time.
process.env.NODE_ENV = 'production';
process.env.BABEL_ENV = 'production';
process.env.ASSET_PATH = '/';

const path = require('node:path');

const forkRoot = path.resolve(__dirname, '../vendor/primus-core');

// The fork's manifest transform reads these from the environment, which under
// `pnpm build:vendor` would otherwise carry this repo's package.json values.
const forkPackage = require(path.join(forkRoot, 'package.json'));
process.env.npm_package_version = forkPackage.version;
process.env.npm_package_description = forkPackage.description;

const config = require(path.join(forkRoot, 'webpack.config.js'));

// Must stay in step with VENDOR_RUNTIME_FILES in modules/primus.ts.
const SHIPPED_ENTRIES = ['background', 'pageDecode', 'padoZKAttestationJSSDK', 'catchFavicon'];

const missing = SHIPPED_ENTRIES.filter((name) => !(name in config.entry));
if (missing.length > 0) {
  throw new Error(
    `[vendor-webpack] the fork's webpack.config.js no longer defines: ${missing.join(', ')}`,
  );
}

delete config.chromeExtensionBoilerplate;
config.mode = 'production';
config.context = forkRoot;
config.entry = Object.fromEntries(SHIPPED_ENTRIES.map((name) => [name, config.entry[name]]));
// The only HtmlWebpackPlugin instance emits home.html for the dropped Home entry.
config.plugins = config.plugins.filter((plugin) => plugin.constructor.name !== 'HtmlWebpackPlugin');
// The fork's CopyWebpackPlugin patterns target this absolute path, so output stays here.
config.output.path = path.join(forkRoot, 'build');
config.cache = {
  type: 'filesystem',
  cacheDirectory: path.join(forkRoot, 'node_modules/.cache/webpack-kaito'),
  buildDependencies: { config: [__filename, path.join(forkRoot, 'webpack.config.js')] },
};

module.exports = config;
