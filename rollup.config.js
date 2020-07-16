import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import nodePolyfills from 'rollup-plugin-node-polyfills';

export default {
  input: 'pkg/dist-web/index.js',
  output: {
    file: 'pkg/dist-web/index.bundled.js',
    format: 'iife',
    sourcemap: 'pkg/dist-web/index.bundled.js.map',
    name: 'SmartWeaveSdk'
  },
  plugins: [
    resolve(),
    commonjs(),
    nodePolyfills(),
  ]
}
