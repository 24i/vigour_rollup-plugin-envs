const { placeholder, store } = require('./util')
const evaluate = require('static-eval')
const falafel = require('falafel')

module.exports = (code, imports, globals, storage) => falafel({
  source: code,
  sourceType: 'module'
}, node => {
  const type = node.type
  if (type === 'ImportDeclaration' && imports) {
    const source = node.source()
    const split = source.split(' from ')
    const from = split[1]
    if (from) {
      const imported = imports[from.replace(/[",',;]/g, '')]
      if (imported) {
        node.specifiers.forEach(specifier => {
          mydecl('const', node)[specifier.local.name] = imported
        })
        node.update(`const ${split[0].replace('import ', '')} = ${placeholder(imported)};`)
      }
    }
  } else if (type === 'VariableDeclarator') {
    const resolved = node.init && evaluate(node.init, unresolved => {
      const interest = decl(node, globals)[unresolved.name]
      mydecl(node.parent.kind, node)[node.id.name] = interest ? node.init.source().replace(unresolved.name, interest) : false
    })
    if (resolved !== void 0) {
      mydecl(node.parent.kind, node)[node.id.name] = false
    }
  } else if (type === 'BinaryExpression') {
    if (node.operator === '===' || node.operator === '==') {
      test(storage, node, node.right, node.left, test(storage, node, node.left, node.right))
    }
  } else if (type === 'IfStatement') {
    if (node.test.type === 'Identifier' || node.test.type === 'MemberExpression') {
      evaluate(node.test, unresolved => {
        const interest = decl(node, globals)[unresolved.name]
        if (interest) {
          store(storage, node.test.source().replace(unresolved.name, interest), true)
        }
      })
    }
  }
}).toString()

// tests if a is of interest, checks if b is resolvable and stores if so
function test(storage, node, a, b, resolvedB) {
  return evaluate(a, unresolved => {
    const interest = decl(node)[unresolved.name]
    if (interest) {
      if (resolvedB === void 0) {
        resolvedB = evaluate(b)
      }
      if (resolvedB !== void 0) {
        store(storage, a.source().replace(unresolved.name, interest), resolvedB)
      }
    }
  })
}

// this gets the block level scope if const or let
// gets the function level scope if var
function mydecl(kind, node) {
  if (kind === 'var') {
    while (node) {
      if (
        node.type === 'FunctionExpression' ||
        node.type === 'FunctionDeclaration' ||
        node.type === 'Program'
      ) break
      node = node.parent
    }
  } else {
    while (node) {
      if (
        node.type === 'BlockStatement' ||
        node.type === 'Program'
      ) break
      node = node.parent
    }
  }
  return (node[kind] || (node[kind] = {}))
}

// get the merged scope of variables that can be used
function decl(node, globals) {
  const arr = []
  const decl = Object.assign({}, globals)

  while (node) {
    if (node.const) arr.push(node.const)
    if (node.var) arr.push(node.var)
    if (node.let) arr.push(node.let)
    node = node.parent
  }

  for (var i = arr.length - 1; i >= 0; i--) {
    Object.assign(decl, arr[i])
  }

  return decl
}
