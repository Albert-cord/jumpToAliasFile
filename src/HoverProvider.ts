import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Configuration from './Configuration';
import {traverse} from './util';
import { fixFilePathExtension, extractImportPathFromTextLine, getFileZeroLocationFromFilePath } from './util';

export default class WebpackAliasDefinitionProvider implements vscode.HoverProvider {
  private _workspaceDir: string;
  constructor(private readonly _configuration: Configuration) {
    this._workspaceDir = vscode.workspace.rootPath;
  }

  provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken):Promise<vscode.Hover> {
    return this._getFileRealPosition(document, position);
  }

  private _needJump(document: vscode.TextDocument, filePath: string): boolean {
    if (filePath.startsWith('.') && (
      /\.(less|scss|sass)$/.test(filePath) ||
      document.fileName.endsWith('.vue')
    )) return true;
    return false;
  }

  private async _getAbsoluteFilePath(document: vscode.TextDocument, position: vscode.Position) {
    const textLine = document.lineAt(position)
    const pathObj = extractImportPathFromTextLine(textLine);

    let realFilePath: string;
    if (pathObj && pathObj.range.contains(position)) {
      realFilePath = await this._tranformAliasPath(pathObj.path);
      console.log(realFilePath)

      // 由于 vscode 不能正确识别 vue 文件的正常导入, 所以此处添加对 vue 文件的正常引入支持
      // 由于 vscode 不能正确识别 less scss sass 文件的导入, 添加支持
      if (!realFilePath && this._needJump(document, pathObj.path)) {
        realFilePath = path.resolve(document.fileName, '../', pathObj.path);
      }
    }

    if (realFilePath) {
      realFilePath = await fixFilePathExtension(realFilePath, this._workspaceDir)
    }
    return realFilePath;
  }

  private async _getFileRealPosition(document: vscode.TextDocument, position: vscode.Position) {
    let realFilePath = await this._getAbsoluteFilePath(document, position);
    if (realFilePath) {
      // return getFileZeroLocationFromFilePath(realFilePath)
      return new vscode.Hover(`module "${realFilePath}"`)
    };
  }

  
  private async _tranformAliasPath(aliasPath: string) {
    let alias = this._configuration.alias;
    let replacePath;
    let aliasArr = aliasPath.split('/')
    if(alias.webpackAlias[aliasArr[0]]) {

      let value = alias.webpackAlias[aliasArr[0]];
      if (!value.endsWith('/')) {
        value += '/';
      }
      return aliasPath.replace(aliasArr[0] + '/', value);
    } else {
      for (let index = 0; index < alias.rollupAlias.length; index++) {
        const element = alias.rollupAlias[index];
        replacePath = await element.rollupAliasFunction(aliasPath, 'defaultImportId');
        if(replacePath) return replacePath;
      }
      return aliasPath;
    }
  }

}