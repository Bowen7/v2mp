const path = require('path')
const parser = require('@babel/parser')
const generate = require('@babel/generator').default
const traverse = require('@babel/traverse').default
const ast2obj = require('./ast2obj')
const utils = require('../utils')
const walk = script => {
  const importSource = {}
  let pages
  let components
  let configs = {}
  // 实际用到的components
  let usingComponents
  let app = false
  const ast = parser.parse(script, { sourceType: 'module' })

  traverse(ast, {
    CallExpression(nodePath) {
      const node = nodePath.node
      const { callee } = node
      if (callee.name !== 'createApp') {
        return
      }
      // 调用了createApp就是app.vue
      // 所以一个项目只能有一个地方调用createApp
      app = true
      const argumentsPath = nodePath.get('arguments.0')
      const properties = argumentsPath.get('properties')
      properties.forEach(prop => {
        const propNode = prop.node
        const { key, value } = propNode
        const { name = '' } = key
        if (name === '_configs') {
          configs = ast2obj(value)
          prop.remove()
        }
        if (name === '_pages') {
          pages = ast2obj(value) || []
        }
      })
    },
    ImportDeclaration(nodePath) {
      const node = nodePath.node
      const { specifiers, source } = node
      const { value } = source
      if (path.extname(value) === '.vue') {
        const specifier = specifiers[0]
        const { local = {} } = specifier
        const { name = '' } = local
        importSource[name] = utils.replaceExt(value, '')
      }
    },
    ExportDefaultDeclaration(nodePath) {
      const declarationPath = nodePath.get('declaration')
      if (declarationPath.type !== 'ObjectExpression') {
        return
      }
      const properties = declarationPath.get('properties')
      properties.forEach(prop => {
        const propNode = prop.node
        const { key, value } = propNode
        const { name = '' } = key
        if (name === '_configs') {
          configs = ast2obj(value)
          prop.remove()
        }
        if (name === '_components') {
          components = ast2obj(value) || {}
        }
      })
    }
  })
  if (app) {
    pages = pages.map(page => {
      return importSource[page]
    })
  } else {
    usingComponents = {}
    for (const componentName in components) {
      const importName = components[componentName]
      const importPath = importSource[importName]
      if (importPath) {
        usingComponents[componentName] = importPath
      }
    }
  }

  const code = generate(ast).code
  return {
    app,
    pages,
    components: usingComponents,
    configs,
    code
  }
}
module.exports = walk
