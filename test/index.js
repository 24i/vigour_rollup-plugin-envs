const test = require('tape')
const rollup = require('rollup')
const envs = require('../')

test('bundle', t => {
  t.plan(1)
  rollup.rollup({
    entry: 'test/file.js',
    plugins: [
      envs({
        imports: ['import.js']
      })
    ]
  }).then(bundle => {
    bundle.write({
      dest: 'test/dist/index.js'
    })
    t.pass()
  }).catch(err => t.fail(err))
})
