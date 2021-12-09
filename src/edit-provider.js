const fs = require('fs')
const { workspace, window, Range, TextEdit } = require('vscode')

const { getPrettierParser } = require('./language-map')

function fullDocumentRange (document) {
  const lastLineId = document.lineCount - 1
  return new Range(0, 0, lastLineId, document.lineAt(lastLineId).text.length)
}
const MODULES = ['@ksmithut/prettier-standard', 'prettier-standard']

module.exports = class PrettierEditProvider {
  constructor () {
    this.prettier = import('@ksmithut/prettier-standard')
    this.loadPackagedVersion().catch(error => {
      console.error('Error loading packaged prettier-standard', error)
    })
  }

  async loadPackagedVersion () {
    const PATH = `node_modules/{${MODULES.join(',')}}/package.json`
    const [uri] = await workspace.findFiles(PATH)
    if (!uri) return
    const packageJSON = JSON.parse(
      await fs.promises.readFile(uri.fsPath, 'utf-8')
    )
    const rootPath = uri.fsPath.replace(/\/package\.json$/, '')
    const mainPath = `${rootPath}/${packageJSON.main}`
    const prettier = await import(mainPath)
    if (prettier && prettier.resolveConfig && prettier.resolveConfig.sync) {
      this.prettier = prettier
    }
  }

  getConfigPath (document) {
    if (!document.isUntitled) return document.fileName
    const { uri } = (workspace.workspaceFolders || [])[0] || {}
    if (uri && uri.scheme === 'file') return uri.fsPath
  }

  async getConfig (document) {
    const prettier = await this.prettier
    const opts = { editorconfig: true, useCache: false }
    const path = this.getConfigPath(document)
    const config = (path && prettier.resolveConfig.sync(path, opts)) || {}
    config.filepath = '(stdin)'
    config.parser = getPrettierParser(document.languageId)
    return config
  }

  async format (document, range) {
    try {
      const prettier = await this.prettier
      const text = range ? document.getText(range) : document.getText()
      const newText = prettier.format(text, await this.getConfig(document))
      return [TextEdit.replace(range || fullDocumentRange(document), newText)]
    } catch (e) {
      console.error(e)
      window.showErrorMessage(e.message)
      return []
    }
  }

  provideDocumentRangeFormattingEdits (document, range) {
    return this.format(document, range)
  }

  provideDocumentFormattingEdits (document) {
    return this.format(document)
  }
}
