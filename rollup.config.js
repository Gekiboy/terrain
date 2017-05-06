// rollup.config.js
import babel from 'rollup-plugin-babel';
import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

export default {
  entry: 'src/main.js',
  dest: 'index.js',
  format: 'iife',
  moduleName: 'terrain',
  plugins: [
    babel(),
    nodeResolve({
      jsnext: true,
      main: true
    }),
    commonjs({
      namedExports: {
        'node_modules/js-priority-queue/priority-queue.js': [ 'PriorityQueue' ]
      }
    })
  ]
};
