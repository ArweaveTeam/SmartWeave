import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

export default {
  input: 'our-contracts/community.js',
  output: {
    file: 'build/community.js',
    format: 'cjs'
  },
  plugins: [
    resolve(),
    commonjs()
  ]
}
