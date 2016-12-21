const MagicString = require('magic-string')
const stringify = require('javascript-stringify')
const { createFilter } = require('rollup-pluginutils')
const { merge, flatten } = require('./util')
const quickhash = require('quick-hash')
const acorn = require('acorn')

module.exports = (options = {}) => {
  const filter = createFilter( options.include, options.exclude )
  const pattern = new RegExp('(' + options.imports.join( '|' ) + ')')
  const envs = {}

  return {
    name: 'envs',
    intro: () => '$ENVS_INTRO',
    transform (code, id) {
      if (!filter(id)) return null;
      const match = pattern.exec(id)
      if (match) {
        const name = match[0]
        const env = `$ENVS_${options.imports.indexOf(name)}`
        envs[env] = name
        return `export default ${env}`
      }
    },
    transformBundle (code) {
      const pattern = new RegExp(`(${Object.keys(envs).join('|')})`.replace('$', '\\$'), 'g')
      const notequals = []
      const equals = []
      const exists = {}

      var match, start, node, env, op, value

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
          if (op === '==' || op === '===') {
            value = toValue(l, r.value)
            hash = env + JSON.stringify(value)
            if (!exists[hash]) equals.push({ name: env, hash, value })
          } else if (op === '!=' || op === '!==') {
            value = toValue(l, r.value)
            hash = env + '!' + JSON.stringify(value)
            if (!exists[hash]) notequals.push({ name: env, hash, value })
          }
        }
      }

      // const combos = {}
      // // lets make all possible combos
      // for (var i = 0; i < equals.length; i++) {
      //   const a = equals[i]
      //   for (var j = 0; j < equals.length; j++) {
      //     const b = equals[i]
      //     const combo = clone(a)
      //     merge(combo, b)
      //     hash = JSON.stringify(combo)

      //   }
      // }


      // ok lets just return one
      return code.replace('$ENVS_INTRO', `var ${equals[0].name} = ${stringify(equals[0].value)}`)

      // return
      // remove duplicates

      // the tricky part
      // console.log(JSON.stringify(equals, false, 2))
      // const environments = []
      // for (let i = equals.length - 1; i >= 0; i--) {
      //   const env = equals[i]

        // if (!(env.name in obj)) {
        //   obj[env.name] = [env.value]
        // } else {
        //   const values = obj[env.name]
        //   let mergable
        //   for (let i = values.length - 1; i >= 0; i--) {
        //     if (mergable = !negates(values[i], env.value)) {
        //       merge(values[i], env.value)
        //       break
        //     }
        //   }
        //   if (!mergable) values.push(env.value)
        // }
      // }


      // const obj = {}
      // // for all equals get the minimum amount
      // for (let i = equals.length - 1; i >= 0; i--) {
      //   const env = equals[i]
      //   if (!(env.name in obj)) {
      //     obj[env.name] = [env.value]
      //   } else {
      //     const values = obj[env.name]
      //     let mergable
      //     for (let i = values.length - 1; i >= 0; i--) {
      //       if (mergable = !negates(values[i], env.value)) {
      //         merge(values[i], env.value)
      //         break
      //       }
      //     }
      //     if (!mergable) values.push(env.value)
      //   }
      // }
      // // for all notequals get the minimum amount
      // for (let i = notequals.length - 1; i >= 0; i--) {
      //   const env = notequals[i]
      //   if (!(env.name in obj)) {
      //     obj[env.name] = [negative(env.value)]
      //   } else {
      //     const values = obj[env.name]
      //     let opposite
      //     for (let i = values.length - 1; i >= 0; i--) {
      //       if (opposite = negates(values[i], env.value)) {
      //         break
      //       }
      //     }
      //     if (!opposite) values.push(env.value)
      //   }
      // }
      // for (let i = equals.length - 1; i >= 0; i--) {
      //   const env = equals[i]
      //   const values = obj[env.name]
      //   for (let i = values.length - 1; i >= 0; i--) {
      //     if (!negates(values[i], env.value)) {
      //       values.push(env.value)
      //     }
      //   }
      // }
      // also do negates here for the non equals
      // if existing equals thing negates a non equals thing => dont do anything with non equals
      // console.log(JSON.stringify(obj, false, 2))
      // // const envs = {}
      // for (let name in obj) {
      //   // create the environments

      // }

      // // replacement = 'POOP'//String( values[ match[1] ] )
      // // magicString.overwrite(start, end, replacement)

      // if ( !hasReplacements ) return null

      // let result = { code: magicString.toString() }
      // if ( options.sourceMap !== false ) result.map = magicString.generateMap({ hires: true })

      // console.log('111')

      // return result
    }
  }
}

function negative (value) {
  if (typeof value === 'object') {
    for (i in value) {
      value[i] = negative(value[i])
    }
    return value
  }
  return !value
}

function clone (a) {
  if (typeof a === 'object') {
    var b = {}
    for (let key in a) {
      b[key] = clone(a[key])
    }
    return b
  }
  return a
}

function negates (a, b) {
  if (typeof a === 'object' && typeof b === 'object') {
    for (let key in b) {
      if (key in a) {
        if (negates(a[key], b[key])) return true
      }
    }
  } else if (a !== b) {
    return true
  }
}

function toValue (node, value) {
  return node.property
  ? toValue (node.object, {[node.property.name]:value})
  : value
}

// function toPath (obj) {
//   var arr = []
//   while (typeof obj === 'object') {
//     for (var i in obj) {
//       arr.push(i)
//       obj = obj[i]
//     }
//   }
//   arr.push(obj)
//   return arr
// }

// var FAIL = {}
// var ME = {}

// function toVal (node) {
//   if (node.type === 'Identifier') {

//   } else if (node.type === 'MemberExpression') {
//     val = {}
//     if (node.property.type === 'Identifier') {
//       val[node.property.name] = toVal(node.property)
//     }
//   }
//   return val
// }


// function walk (node, env) {
//   console.log('walk:', node.type, node)
//   if (node.type === 'BinaryExpression'|| node.type === 'LogicalExpression') {
//     if (op === '&&') return true
//     if (op === '||') return true

//     var val = walk(node.left, env)
//     if (val === ME) val = walk(node.right, env)

//     console.log('HEYOOO')

//     var op = node.operator
//     if (op === '==') return val
//     if (op === '===') return val
//     if (op === '!=') return !val
//     if (op === '!==') return !val
//   } else if (node.type === 'Identifier') {
//     if (node.name === env) {
//       return ME
//     } return FAIL
//   } else if (node.type === 'MemberExpression') {
//     var obj = walk(node.object, env)
//     if (obj === ME) {
//       console.log('isme!', node.property.type, node.property.name)
//       if (node.property.type === 'Identifier') {
//         obj[node.property.name] = {}
//       }
//     }
//     var prop = walk(node.property, env)
//     console.log('prop', prop)
//     if (prop === FAIL) return FAIL
//     return obj
//   }
// }