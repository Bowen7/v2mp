const path = require('path')
const hash = require('hash-sum')
const qs = require('qs')
const selector = require('./selector')
const loaderUtils = require('loader-utils')
const walk = require('./walk')
const utils = require('../utils/index')
const helper = require('./helper')
const componentNormalizerPath = require.resolve(
  '../runtime/componentNormalizer'
)
const coreOptionsPath = require.resolve('../core/options.js')
let appPath

module.exports = function(source) {
  const loaderContext = this
  // 不要缓存，否则watch时监听不到emitFile的文件改变
  loaderContext.cacheable(false)
  const { context, resourcePath, resourceQuery } = this
  const rawQuery = resourceQuery.slice(1)
  const loaderQuery = qs.parse(rawQuery)

  const { type } = loaderQuery
  if (type) {
    if (type === 'script') {
      const script = selector(source, type)
      const { code } = walk(script)
      // console.log(script, code)
      return code
    }
    return selector(source, type)
  }

  const stringifyRequest = r => loaderUtils.stringifyRequest(loaderContext, r)

  const script = selector(source, 'script')
  const { app, pages, components, configs, code } = walk(script)
  if (app) {
    appPath = context
    configs.pages = pages.map(page => {
      const pagePath = path.join(context, page)
      return utils.replaceExt(path.relative(appPath, pagePath), '')
    })
  } else {
    configs.usingComponents = components
  }

  // emit wxss json js
  const shortFilePath = path.relative(appPath, resourcePath)
  const fileName = path.relative(context, resourcePath)

  const style = selector(source, 'style')
  const stylePath = utils.replaceExt(shortFilePath, '.wxss')
  helper.emitStyleFiles(loaderContext, style, stylePath, appPath)

  const jsonPath = utils.replaceExt(shortFilePath, '.json')
  this.emitFile(jsonPath, JSON.stringify(configs))

  const jsPath = utils.replaceExt(shortFilePath, '.js')
  const bundlePath = 'bundle.js'
  const relativeBundlePath = path.relative(path.dirname(jsPath), bundlePath)

  const scopeId = app ? 'app' : hash(shortFilePath)

  this.emitFile(
    jsPath,
    `const loadSource = require('${relativeBundlePath}').default;loadSource('${scopeId}')`
  )
  if (app) {
    return `
${code}
import { loadSource } from ${stringifyRequest(`!${coreOptionsPath}`)};
export default loadSource;
`
  } else {
    const template = selector(source, 'template')
    const templatePath = utils.replaceExt(shortFilePath, '.wxml')
    this.emitFile(templatePath, template)

    return `
import options from './${fileName}?type=script';
import normalizer from ${stringifyRequest(`!${componentNormalizerPath}`)};
const component = normalizer(options, '${scopeId}');
export default component;
`
  }
}