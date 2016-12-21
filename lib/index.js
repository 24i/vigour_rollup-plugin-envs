const { createFilter } = require('rollup-pluginutils')
const stringify = require('javascript-stringify')
const unflatten = require('unflatten')
const acorn = require('acorn')
const path = require('path')
const fs = require('fs')

const STUB = '$envs_intro'

function escape ( str ) {
  return str.replace( /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&' );
}

module.exports = (options = {}) => {
  const filter = createFilter( options.include, options.exclude )
  const imports = options.imports
  const pattern = new RegExp('(' + imports.join( '|' ) + ')')
  const envs = {}
  let originalCode

  return {
    name: 'envs',
    intro: () => STUB,
    transform (code, id) {
      if (!filter(id)) return null;
      const match = pattern.exec(id)
      if (match) {
        const name = match[0]
        const env = `$env_${imports.indexOf(name)}`
        envs[env] = name
        return `export default ${env}`
      }
    },
    transformBundle (code) {
      originalCode = code
      const pattern = new RegExp(`(${Object.keys(envs).join('|')})`.replace('$', '\\$'), 'g')
      const found = {}
      var match, start, node, name, env, op

      while (match = pattern.exec( code )) {
        start = match.index
        env = match[0]
        node = acorn.parseExpressionAt(code, start)
        if (node.type === 'BinaryExpression'|| node.type === 'LogicalExpression') {
          let l, r
          if (node.left.type === 'Literal') {
            l = node.right
            r = node.left
          } else {
            l = node.left
            r = node.right
          }
          op = node.operator
          if (op === '==' || op === '===' || op === '!=' || op === '!==') {
            name = envPath(l, env)
            if (!(name in found)) found[name] = []
            found[name].push(r.value)
          }
        }
      }

      const fallbacks = {}
      for (name in found) {
        const values = found[name]
        // add a fallback for each match
        for (let i = values.length - 1, neg; i >= 0; i--) {
          if (values.indexOf(neg = !values[i]) === -1) fallbacks[name] = neg
        }
        values.push(fallbacks[name])
      }
      const objs = [found]
      for (name in found) {
        for (let i = 0, l = objs.length; i < l; i++) {
          const obj = objs[i]
          const val = obj[name]
          if (val.constructor === Array) {
            for (let j = val.length - 1, clone; j >= 0; j--) {
              clone = Object.assign({}, obj)
              clone[name] = val[j]
              objs.push(clone)
            }
            objs.splice(i--, 1)
            l++
          }
        }
      }

      const targets = {}
      for (let i = objs.length - 1, obj, clone, file; i >= 0; i--) {
        obj = objs[i]
        clone = Object.assign({}, obj)
        for (name in clone) {
          if (name in fallbacks && fallbacks[name] === clone[name]) {
            delete clone[name]
          }
        }
        file = JSON.stringify(clone) + '.js'
        targets[file] = unflatten(obj)
      }

      return JSON.stringify(targets, false, 2)
    },
    onwrite (options, b) {
      const dir = path.dirname(options.dest)
      const targets = JSON.parse(b.code)
      for (let file in targets) {
        const envs = targets[file]
        let str = ''
        for (let name in envs) {
          str = `var ${name} = ${stringify(envs[name])};\n`
        }
        const code = originalCode.replace(STUB, str)
        const dest = path.join(dir, file)
        fs.writeFile(dest, code, err => {
          if (err) console.log(err)
        })
      }
    }
  }
}

function envPath (node, str = '') {
  return node.property
  ? envPath(node.object, str + '.' + node.property.name)
  : str
}
