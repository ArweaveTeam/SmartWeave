import esbuild from 'esbuild';
import rimraf from 'rimraf';
const { build } = esbuild;

const clean = async () => {
  return new Promise((resolve) => {
    rimraf('./dist', () => resolve());
  });
};

const runBuild = async (doClean = false) => {
  // Do not clean each time on watch, only on build or first run.
  if (doClean) await clean();

  // Build to browser js
  [
    { minify: false, format: 'iife', name: 'smartweave.js' },
    { minify: true, format: 'iife', name: 'smartweave.min.js' },
    { minify: false, format: 'esm', name: 'smartweave.esm.js' },
    { minify: true, format: 'esm', name: 'smartweave.min.esm.js' },
  ].forEach(({ name, ...spec }) => {
    build({
      entryPoints: ['./src/index.ts'],
      bundle: true,
      outfile: `./dist/${name}`,
      ...spec,
    }).catch((e) => {
      console.log(e);
      process.exit(1);
    });
  });
};

runBuild(true);
