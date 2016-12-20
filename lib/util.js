exports.placeholder = string => `"$REPLACE:${string}"`
exports.flatten = flatten
exports.store = store
exports.merge = merge

function flatten (o) {
  const obj = {}
  for (let i in o) {
    if (typeof o[i] === 'object') {
      const flat = flatten(o[i])
      for (let x in flat) {
        obj[`${i}:${x}`] = flat[x]
      }
    } else {
      obj[i] = o[i]
    }
  }
  return obj
}

function store (storage, str, set) {
  merge(storage, {
    [str]: {
      [set]: true,
      [!set]: true
    }
  })
}

function merge (a, b) {
  for (let key in b) {
    let ak = a[key]
    let bk = b[key]
    if (ak && typeof ak === 'object') {
      merge(ak, bk)
    } else {
      a[key] = bk
    }
  }
}