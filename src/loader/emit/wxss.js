const NodeTemplatePlugin = require('webpack/lib/node/NodeTemplatePlugin')
const NodeTargetPlugin = require('webpack/lib/node/NodeTargetPlugin')
const LibraryTemplatePlugin = require('webpack/lib/LibraryTemplatePlugin')
const SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin')
const path = require('path')
const NativeModule = require('module')
const utils = require('../../utils')
const selector = require('../../utils/selector')
const exec = (loaderContext, code, filename) => {
  const _module = new NativeModule(filename, loaderContext)
  _module._compile(code, filename)
  return _module.exports
}
const getMainCompilation = compilation => {
  while (compilation.compiler.parentCompilation) {
    compilation = compilation.compiler.parentCompilation
  }
  return compilation
}
const emitWxss = (loaderContext, source, shortFilePath) => {
  return new Promise((resolve, reject) => {
    const { attrs = {} } = selector(source, 'style')
    const { lang = 'css' } = attrs

    const loaderCallback = loaderContext.async()
    const mainCompilation = getMainCompilation(loaderContext._compilation)
    const outputOptions = {
      filename: 'css/css.js'
    }
    const compilerName = 'EMPJS_COMPILER'

    const childCompiler = mainCompilation.createChildCompiler(
      compilerName,
      outputOptions,
      [
        new NodeTemplatePlugin(outputOptions),
        new NodeTargetPlugin(),
        new LibraryTemplatePlugin('EMPJS_PLUGIN', 'commonjs2'),
        new SingleEntryPlugin(
          loaderContext.rootContext,
          utils.stringifyQuery(loaderContext.resource, {
            type: 'style',
            lang
          })
        )
      ]
    )
    childCompiler.hooks.afterCompile.tapAsync(
      'EMPJS_PLUGIN',
      (childCompilation, callback) => {
        const { assets } = childCompilation
        for (const key in assets) {
          if (path.extname(key) === '.js') {
            const _source = assets[key].source()
            let result = ''
            try {
              result = exec(loaderContext, _source, loaderContext.resource)
            } catch (error) {
              return loaderCallback(error)
            }
            const style = result.toString()
            const wxssPath = utils.replaceExt(shortFilePath, '.wxss')
            loaderContext.emitFile(wxssPath, style)
          }
        }
        childCompilation.assets = {}
        resolve()
        callback()
      }
    )
    childCompiler.runAsChild((err, entries, childCompilation) => {
      if (err) {
        return loaderCallback(err)
      }
      if (childCompilation.errors.length > 0) {
        return loaderCallback(childCompilation.errors[0])
      }
      childCompilation.fileDependencies.forEach(dep => {
        loaderContext.addDependency(dep)
      }, loaderContext)
      childCompilation.contextDependencies.forEach(dep => {
        loaderContext.addContextDependency(dep)
      }, loaderContext)
    })
  })
}
module.exports = emitWxss
