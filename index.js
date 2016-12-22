const { createFilter } = require('rollup-pluginutils')
const stringify = require('javascript-stringify')
const MagicString = require('magic-string')
const unflatten = require('unflatten')
const hash = require('string-hash')
const mkdirp = require('mkdirp')
const acorn = require('acorn')
const path = require('path')
const fs = require('fs')

const STUB = '$envs_intro'
const CONFIG = 'envs.json'

const envpath = (node, env, str = '') => node.property
? envpath(node.object, env, node.property.name + (str ? '.' + str : ''))
: env + '.' + str

module.exports = (options = {}) => {
  const filter = createFilter(options.include, options.exclude)
  const map = {}
  let importPattern, files, written, vars

  if (options.imports) {
    importPattern = new RegExp(`(${options.imports.join('|')})`)
  }
  if (options.vars) {
    vars = {}
    options.vars.forEach(key => { vars[key] = key })
  }

  return {
    name: 'envs',
    options: opts => {
      if (opts.dest) {
        fs.readFile(path.join(path.dirname(opts.dest, CONFIG)), (err, data) => {
          if (err) written = {}
          else {
            try {
              written = JSON.parse(data).files
            } catch (e) {
              written = {}
            }
          }
        })
      }
    },
    transform: importPattern ? (code, id) => {
      if (!filter(id)) return null
      const match = importPattern.exec(id)
      if (match) {
        if (!vars) vars = {}
        const name = match[0]
        const env = `$env${options.imports.indexOf(name)}`
        const s = new MagicString(code)
        vars[env] = name
        map[name] = env
        s.prepend(`export default ${env}/*`).append('*/')
        const result = { code: s.toString() }
        if (options.sourceMap !== false) result.map = s.generateMap({ hires: true })
        return result
      }
    } : null,
    intro: () => STUB,
    transformBundle (code) {
      if (!vars) return null
      const pattern = new RegExp(`(${Object.keys(vars).join('|')})`.replace('$', '\\$'), 'g')
      const found = {}
      let match
      /* match envs and store any expression using them (@todo: add more) */
      while ((match = pattern.exec(code))) {
        const start = match.index
        const env = match[0]
        const node = acorn.parseExpressionAt(code, start)
        if (node.type === 'BinaryExpression') {
          const op = node.operator
          let l, r
          if (node.left.type === 'Literal') {
            l = node.right
            r = node.left
          } else {
            l = node.left
            r = node.right
          }
          if (op === '==' || op === '===' || op === '!=' || op === '!==') {
            const name = envpath(l, env)
            if (!(name in found)) found[name] = []
            found[name].push(r.value)
          }
        }
      }
      /* create fallbacks for all checks */
      const fallbacks = {}
      for (let name in found) {
        const values = found[name]
        for (let i = values.length - 1, neg; i >= 0; i--) {
          if (values.indexOf(neg = !values[i]) === -1) {
            fallbacks[name] = neg
          }
        }
        values.push(fallbacks[name])
      }
      /* create all possible combinations */
      const objs = [found]
      for (let name in found) {
        for (let i = 0, l = objs.length; i < l; i++) {
          const obj = objs[i]
          const val = obj[name]
          if (typeof val === 'object') {
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
      /* create files object */
      files = {}
      for (let i = objs.length - 1, obj, clone, file; i >= 0; i--) {
        obj = objs[i]
        clone = Object.assign({}, obj)
        for (let name in clone) {
          if (name in fallbacks && fallbacks[name] === clone[name]) {
            delete clone[name]
          }
        }
        file = hash(JSON.stringify(clone)) + '.js'
        files[file] = unflatten(obj)
      }
    },
    ongenerate (options, b) {
      if (!options.dest) return null
      const dir = path.dirname(options.dest)
      mkdirp(dir, err => {
        if (err) return console.log(err)
        for (let file in written) {
          if (!files[file]) {
            fs.unlink(path.join(dir, file), err => {
              if (err) console.log(err)
            })
          }
        }
        for (let file in files) {
          const envs = files[file]
          let str = ''
          for (let name in envs) {
            str += `var ${name} = ${stringify(envs[name])};`
          }
          for (let name in vars) {
            if (!(name in envs)) {
              str += `var ${name} = {};\n`
            }
          }
          const code = `${b.code.replace(STUB, str)}//# sourceMappingURL=${
            path.basename(options.dest)
          }.map`
          fs.writeFile(path.join(dir, file), code, err => {
            if (err) console.log(err)
          })
        }
        fs.writeFile(
          path.join(dir, CONFIG),
          JSON.stringify({ map, files }, false, 2),
          err => { if (err) console.log(err) }
        )
        written = files
      })
    }
  }
}
