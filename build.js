const { build } = require('esbuild');
const rimraf = require('rimraf');

const clean = async () => {
  return new Promise(resolve => {
    rimraf('./dist', () => resolve());
  });
}

const runBuild = async (doClean = false) => {
  // Do not clean each time on watch, only on build or first run.
  if(doClean) await clean();
 
  // Build to browser js
  build({
    entryPoints: ['./src/index.ts'],
    minify: false,
    bundle: true,
    outfile: './dist/smartweave.js',
    platform: 'browser'
  }).catch((e) => {
    console.log(e);
    process.exit(1)
  });

  // Minified version
  build({
    entryPoints: ['./src/index.ts'],
    minify: true,
    bundle: true,
    outfile: './dist/smartweave.min.js',
    platform: 'browser'
  }).catch((e) => {
    console.log(e);
    process.exit(1)
  });
};
runBuild(true);

module.exports = runBuild;