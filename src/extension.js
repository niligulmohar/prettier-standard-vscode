const { languages, window, workspace, Range, TextEdit } = require('vscode')

const output = window.createOutputChannel('Prettier Standard')

// -------------------------------------------------------------------------- //

exports.activate = async function (context) {
  const ctx = {}
  ctx.prettier = await loadModule('prettier', require('prettier'), ctx => {
    if (typeof ctx.pkg.format !== 'function') {
      return 'missing prettier.format(text, config)'
    }
    if (typeof ctx.pkg.resolveConfig !== 'function') {
      return 'missing prettier.resolveConfig(path, opts)'
    }
  })
  const eslint = await loadModule('eslint', require('eslint'), ctx => {
    if (!require(ctx.uri.fsPath).version?.startsWith('8.')) {
      return 'we only support major version 8'
    }
  })
  ctx.linter = new eslint.Linter()
  ctx.linter.defineParser('typescript', require('@typescript-eslint/parser'))

  const langs = Object.keys(prettierLanguages).flatMap(language => [
    { scheme: 'file', language },
    { scheme: 'untitled', language }
  ])
  // For formatting VSCode Settings
  langs.push({ scheme: 'vscode-userdata', language: 'jsonc' })

  context.subscriptions.push(
    languages.registerDocumentRangeFormattingEditProvider(langs, {
      provideDocumentRangeFormattingEdits: (...args) => format(ctx, ...args),
      provideDocumentFormattingEdits: (...args) => format(ctx, ...args)
    })
  )
}

exports.deactivate = function () {}

// -- Formatter ------------------------------------------------------------- //

async function format (ctx, document, range) {
  try {
    let text = range ? document.getText(range) : document.getText()
    text = prettierFormat(text, document, ctx)
    text = eslintFormat(text, document, ctx)
    return [TextEdit.replace(range || fullDocumentRange(document), text)]
  } catch (error) {
    output.appendLine(error)
    window.showErrorMessage(error.message)
    return []
  }
}

// -- Prettier -------------------------------------------------------------- //

// Use this snippet to re-generate this list:
// prettier.getSupportInfo().languages.flatMap(a => a.vscodeLanguageIds.map(b => [b, a.parsers[0]])).reduce((acc, [key, val]) => key in acc ? acc : ({...acc, [key]: val}), {})
// When you update this list, also update activationEvents in package.json
const prettierLanguages = {
  javascript: 'babel',
  mongo: 'babel',
  javascriptreact: 'babel',
  typescript: 'typescript',
  typescriptreact: 'typescript',
  json: 'json-stringify',
  jsonc: 'json',
  json5: 'json5',
  css: 'css',
  postcss: 'css',
  less: 'less',
  scss: 'scss',
  handlebars: 'glimmer',
  graphql: 'graphql',
  markdown: 'markdown',
  mdx: 'mdx',
  html: 'angular',
  vue: 'vue',
  yaml: 'yaml',
  ansible: 'yaml',
  'home-assistant': 'yaml'
}
prettierLanguages.tailwindcss = 'tailwindcss'

const defaultPrettierConfig = {
  semi: false,
  singleQuote: true,
  jsxSingleQuote: true,
  arrowParens: 'avoid',
  trailingComma: 'none'
}

function getPrettierConfig (document, prettier) {
  const opts = { editorconfig: true, useCache: false }
  const path = getFilePath(document)
  let config = {}
  if (path) config = prettier.resolveConfig.sync(path, opts) || {}
  config = { ...defaultPrettierConfig, ...config }
  config.filepath = '(stdin)'
  config.parser = prettierLanguages[document.languageId]
  return config
}

function prettierFormat (text, document, { prettier }) {
  const prettierConfig = getPrettierConfig(document, prettier)
  return prettier.format(text, prettierConfig)
}

// -- ESLint --------------------------------------------------------------- -//

const eslintLanguages = [
  'javascript',
  'javascriptreact',
  'typescript',
  'typescriptreact'
]

// TODO:: allow loading config from host project
const eslintConfig = {
  parser: 'typescript',
  parserOptions: {
    ecmaVersion: 2022,
    ecmaFeatures: { jsx: true },
    sourceType: 'module'
  },
  env: { es2021: true, node: true },
  globals: { document: 'readonly', navigator: 'readonly', window: 'readonly' },
  rules: { 'space-before-function-paren': ['error', 'always'] }
}

function eslintFormat (text, document, { linter }) {
  if (!eslintLanguages.includes(document.languageId)) return text
  return linter.verifyAndFix(text, eslintConfig).output
}

// -- Helpers --------------------------------------------------------------- //

function fullDocumentRange (document) {
  const lastLineId = document.lineCount - 1
  return new Range(0, 0, lastLineId, document.lineAt(lastLineId).text.length)
}

function getFilePath (document) {
  if (!document.isUntitled) return document.fileName
  const [space] = workspace.workspaceFolders ?? []
  if (space?.uri?.scheme === 'file') return space.uri.fsPath
}

async function loadModule (name, builtin, check) {
  const PATH = `node_modules/${name}/package.json`
  const [uri] = await workspace.findFiles(PATH)
  if (uri) {
    const pkg = require(uri.fsPath.replace(/\/package\.json$/, ''))
    const error = check({ uri, pkg })
    if (!error) return pkg
    output.appendLine(
      `Failed to load ${name} from your project. Falling back to the one bundled with the extension. Reason: ${error}`
    )
  }
  return builtin
}
