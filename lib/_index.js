const { placeholder, store, merge, flatten } = require('./util')
const stringify = require('javascript-stringify')
const walk = require('./walk')
const path = require('path')
const fs = require('fs')

module.exports = function envs (config) {
  const globals = {}
  var imports

  if (config.global) {
    config.global.forEach(key => { globals[key] = key })
  }

  if (config.import) {
    imports = {}
    config.import.forEach(key => { imports[key] = key.replace(/\//g, '|') })
  }

  return {
    transform (code) {
      return code.replace("import ua from 'vigour-ua/navigator';", `const ua = ${placeholder('vigour-ua|navigator')}`)
    },
    ongenerate (settings, bundle) {
      const dirname = path.dirname(settings.dest)
      const storage = {}
      const code = walk(bundle.code, imports, globals, storage)
      // link it
      var prev, first
      for (let i in storage) {
        if (!first) first = i
        if (prev) {
          for (var j in prev) {
            prev[j] = { [i]: storage[i] }
          }
        }
        prev = storage[i]
      }
      if (first) {
        // flatten it
        const flat = flatten({
          [first]: storage[first]
        })
        // populate it
        for (let dest in flat) {
          const env = {}
          const arr = dest.split(':')
          for (let i = 0, l = arr.length; i < l; i += 2) {
            const path = arr[i].split('.')
            let set = arr[i + 1]
            if (set === 'false') set = false
            else if (set === 'true') set = true
            for (let i = path.length - 1; i >= 0; i--) {
              set = { [path[i]]: set }
            }
            merge(env, set)
          }
          flat[dest] = env
          // and write it
          for (let i in env) {
            const specific = code.replace(placeholder(i), stringify(env[i]))
            const file = `${dest}.js`
            fs.writeFile(path.join(dirname, file), specific, err => {
              if (err) console.log(err)
            })
          }
        }
      }
    }
  }
}
