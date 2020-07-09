import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import nodePolyfills from 'rollup-plugin-node-polyfills'

export default {
  input: 'our-contracts/community.js',
  output: {
    file: 'build/community.js',
    format: 'cjs'
  },
  plugins: [
    resolve({ preferBuiltins: false }),
    commonjs(),
    json(),
    nodePolyfills()
  ]
}
