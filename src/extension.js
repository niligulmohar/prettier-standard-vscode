const fs = require('node:fs')
const path = require('node:path')
const { languages, window, workspace, Range, TextEdit } = require('vscode')

const pkgJson = require('../package.json')

const output = window.createOutputChannel('Prettier Standard')

// -------------------------------------------------------------------------- //

exports.activate = async function (context) {
  output.appendLine(`Extension Name: ${pkgJson.displayName}`)
  output.appendLine(`Extension ID: ${pkgJson.publisher}.${pkgJson.name}`)
  output.appendLine(`Extension Version: ${pkgJson.version}`)
  const ctx = {}
  ctx.prettier = await loadModule('prettier', require('prettier'), ctx => {
    if (typeof ctx.pkg.format !== 'function') {
      return 'missing prettier.format(text, config)'
    }
    if (typeof ctx.pkg.resolveConfig !== 'function') {
      return 'missing prettier.resolveConfig(filePath, opts)'
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

async function format ({ prettier, linter }, document, range) {
  try {
    const filePath = getFilePath(document)
    const ignorePath = await findUp(filePath, '.prettierignore')
    if (prettier.getFileInfo.sync(filePath, { ignorePath }).ignored) {
      const name = document.isUntitled ? 'untitled file' : document.fileName
      output.appendLine('Not formatting a file excluded by .prettierignore')
      output.appendLine(`file: ${name}`)
      output.appendLine(`.prettierignore: ${ignorePath}`)
      return
    }
    let text = range ? document.getText(range) : document.getText()
    const prettierConfig = getPrettierConfig(prettier, filePath, document)
    text = prettier.format(text, prettierConfig)
    if (eslintLanguages.includes(document.languageId)) {
      text = linter.verifyAndFix(text, eslintConfig).output
    }
    return [TextEdit.replace(range || fullDocumentRange(document), text)]
  } catch (error) {
    const name = document.isUntitled ? 'untitled file' : document.fileName
    output.appendLine(`Error while formatting: ${name}`)
    output.appendLine(error)
    window.showErrorMessage('Error formatting file', 'See details').then(a => {
      if (a === 'See details') output.show()
    })
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
prettierLanguages.tailwindcss = 'css'

const defaultPrettierConfig = {
  semi: false,
  singleQuote: true,
  jsxSingleQuote: true,
  arrowParens: 'avoid',
  trailingComma: 'none'
}

function getPrettierConfig (prettier, filePath, { languageId }) {
  const opts = { editorconfig: true, useCache: false }
  let config = {}
  if (filePath) config = prettier.resolveConfig.sync(filePath, opts) || {}
  config = { ...defaultPrettierConfig, ...config }
  config.filepath = '(stdin)'
  config.parser = prettierLanguages[languageId]
  return config
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

function findUp (directory, file, prev) {
  if (directory === prev) return
  const candidate = path.join(directory, file)
  if (fs.existsSync(candidate)) return candidate
  return findUp(path.join(directory, '..'), file, directory)
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
