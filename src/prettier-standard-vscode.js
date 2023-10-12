#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

function setup () {
  const ctx = {}
  ctx.prettier = require('prettier')
  const eslint = require('eslint')
  ctx.linter = new eslint.Linter()
  ctx.linter.defineParser('typescript', require('@typescript-eslint/parser'))
  ctx.linter.defineParser('vue', require('vue-eslint-parser'))

  return ctx
}

// -- Formatter ------------------------------------------------------------- //

function format ({ prettier, linter }, filePath, languageId) {
  try {
    const ignorePath = findUp(filePath, '.prettierignore')
    if (prettier.getFileInfo.sync(filePath, { ignorePath }).ignored) {
      const name = path.basename(filePath)
      console.error('Not formatting a file excluded by .prettierignore')
      console.error(`file: ${name}`)
      console.error(`.prettierignore: ${ignorePath}`)
      return
    }
    let text = fs.readFileSync(filePath, { encoding: 'utf8' })
    const prettierConfig = getPrettierConfig(prettier, filePath, { languageId })
    text = prettier.format(text, prettierConfig)
    if (Object.keys(eslintLanguages).includes(languageId)) {
      text = linter.verifyAndFix(text, eslintConfig({ languageId })).output
    }
    const tempPath = filePath + '.prettier'
    fs.writeFileSync(tempPath, text, 'utf8')
    fs.renameSync(tempPath, filePath)
  } catch (error) {
    const name = path.basename(filePath)
    console.error(`Error while formatting: ${name}`)
    console.error(error)
    return ''
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
  trailingComma: 'none',
  endOfLine: 'auto'
}

function getPrettierConfig(prettier, filePath, { languageId }) {
  const opts = { editorconfig: true, useCache: false }
  let config = {}
  if (filePath) config = prettier.resolveConfig.sync(filePath, opts) || {}
  config = { ...defaultPrettierConfig, ...config }
  config.filepath = '(stdin)'
  config.parser = prettierLanguages[languageId]
  return config
}

// -- ESLint --------------------------------------------------------------- -//

const eslintLanguages = {
  javascript: 'typescript',
  javascriptreact: 'typescript',
  typescript: 'typescript',
  typescriptreact: 'typescript',
  vue: 'vue'
}

// TODO:: allow loading config from host project
const eslintConfig = ({ languageId }) => ({
  parser: eslintLanguages[languageId],
  parserOptions: {
    ecmaVersion: 2022,
    ecmaFeatures: { jsx: true },
    sourceType: 'module'
  },
  env: { es2021: true, node: true },
  globals: { document: 'readonly', navigator: 'readonly', window: 'readonly' },
  rules: { 'space-before-function-paren': ['error', 'always'] }
})

// -- Helpers --------------------------------------------------------------- //

function findUp(directory, file, prev) {
  if (directory === prev) return
  const candidate = path.join(directory, file)
  if (fs.existsSync(candidate)) return candidate
  return findUp(path.join(directory, '..'), file, directory)
}

const EXTENSION_LANGUAGES = {
  '.json': 'json',
  '.vue': 'vue'
}

const FALLBACK_EXTENSION_LANGUAGE = 'typescript'
async function cli () {
  const ctx = setup()

  for (const arg of process.argv.slice(2)) {
    const filePath = path.resolve(arg)

    const language = EXTENSION_LANGUAGES[path.extname(filePath)] ?? FALLBACK_EXTENSION_LANGUAGE
    format(ctx, filePath, language)
  }
}

cli()
