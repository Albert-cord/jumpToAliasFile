import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import {IExportToken} from './types';
import {
  Node,
  isFunctionDeclaration,
  isVariableStatement,
  createSourceFile,
  ScriptTarget,
  SyntaxKind,
  getLineAndCharacterOfPosition,
  SourceFileLike,
  isArrowFunction
} from 'typescript';

const extensions = ['.js', '.ts', '.json', '.jsx', '.tsx', '.vue', '.css', '.mcss', '.scss', '.less', '.html'];

async function readDir(dirPath: string) {
  let result = await new Promise((resolve, reject) => {
    fs.readdir(dirPath, (err, result) => {
      if (err) reject(err);
      resolve(result);
    })
  });
  return <string[]>result;
}
async function stat(filePath: string) {
  return await new Promise((resolve, reject) => {
    fs.stat(filePath, (err, result) => {
      if (err) reject(err);
      resolve(result);
    })
  });
}

export async function fixFilePathExtension(filePath: string, workspaceDir: string) {
  // 而且只考虑了linux的实现
  const dirPath = path.join(filePath, '../');
  if(filePath[0] === '/' || filePath[0] === '\\') filePath = filePath.substring(1);
  // const fileName = filePath.replace(dirPath, '');
  let fileName = path.basename(filePath);
  if(fileName === "index" && !filePath.endsWith('/index') && !filePath.endsWith('\\index')) {
    filePath += 'index';
  }
  
  // 含有扩展名, 直接返回
  if (fileName.indexOf('.') > 0  && fs.existsSync(path.resolve(workspaceDir, filePath))) {

    return path.resolve(workspaceDir, filePath);
  }
for (const ext of extensions) {
  if(fs.existsSync(path.resolve(workspaceDir, filePath + ext))) {
    return path.resolve(workspaceDir, filePath + ext);
  }
}
let fsStat = fs.statSync(path.resolve(workspaceDir, filePath));
if(fsStat.isDirectory()) {
  for (const ext of extensions) {
    // 这里不用考虑windows情况，大多都是Linux的情况
    if(fs.existsSync(path.resolve(workspaceDir, filePath + '/index' + ext))) {
      return path.resolve(workspaceDir, filePath + ext);
    }
  }
}


  // 不用这么麻烦,而且有Bug
  // async function traverse(dirPath: string, fileName: string) {
  //   let dir = await readDir(dirPath);
  //   for (let ext of extensions) {
  //     if (dir.indexOf(fileName + ext) > -1) {
  //       return path.join(dirPath, fileName + ext);
  //     }
  //   }
  //   if (dir.indexOf(fileName) !== -1) {
  //     let stats = await stat(path.join(dirPath, fileName)) as fs.Stats;
  //     if (stats.isFile()) {
  //       return path.join(dirPath, fileName);
  //     } else if (stats.isDirectory()) {
  //       return 'dir';
  //     }
  //   }
  // }
  // // 遍历文件所在目录, 匹配文件名.后缀
  // let filePathWithExt = await traverse(dirPath, fileName);
  // if (filePathWithExt === 'dir') {
  //   filePathWithExt = await traverse(filePath, 'index');
  // }
  // if (filePathWithExt && filePathWithExt !== 'dir') return filePathWithExt;
}

export function getRollupConfigAliasFn(plugins: any[]) {
  return plugins.filter(plugin => plugin.name === 'alias');
}

export function registerModuleBundlerAliasIntoVscode(Configuration, DefinitionProvider,context, vscode) {
  const configuration = new Configuration();
  const definitionProvider = new DefinitionProvider(configuration);
  const registerDefinitionProvider = vscode.languages.registerDefinitionProvider({ scheme: 'file', pattern: '**/*.{js,jsx,ts,tsx,vue}' }, definitionProvider);
  context.subscriptions.push(configuration);
  context.subscriptions.push(registerDefinitionProvider);
}

export function extractImportPathFromTextLine(textLine: vscode.TextLine): { path: string, range: vscode.Range } | undefined {
  const pathRegs = [
    /import\s+.*\s+from\s+['"](.*)['"]/,
    /import\s*\(['"](.*)['"]\)/,
    /require\s*\(['"](.*)['"]\)/,
    /import\s+['"](.*)['"]/
  ];
  let execResult: RegExpMatchArray;
  for (const pathReg of pathRegs) {
    execResult = pathReg.exec(textLine.text);
    if (execResult && execResult[1]) {
      const filePath = execResult[1];
      const filePathIndex = execResult[0].indexOf(filePath);
      const start = execResult.index + filePathIndex;
      const end = start + filePath.length;
      return {
        path: filePath,
        range: new vscode.Range(textLine.lineNumber, start, textLine.lineNumber, end),
      };
    }
  }
}

export function getFileZeroLocationFromFilePath(filePath: string) {
  let uri = vscode.Uri.file(filePath);
  let range = new vscode.Range(0, 0, 0, 0);
  let location = new vscode.Location(uri, range);
  return location;
}



export function traverse(
  filename: string,
  fileContent: string,
  needParams: boolean = false
) {
  const exportKeywordList: IExportToken[] = [];
  const result = createSourceFile(
    filename,
    fileContent,
    ScriptTarget.ES2015,
    true
  );
  _traverse(result, exportKeywordList, result, needParams);
  return exportKeywordList;
}
function _traverse(
  node: Node,
  tokenList: IExportToken[],
  source: SourceFileLike,
  needParams: boolean,
  depth = 0
): void {
  getExportKeyword(node, tokenList, source);
  if (depth <= 1) {
    node.forEachChild((n: Node) => {
      _traverse(n, tokenList, source, needParams, depth + 1);
    });
  }
}

function getExportKeyword(
  node: Node,
  tokenList: IExportToken[],
  source: SourceFileLike
) {
  try {
    if (node.modifiers && node.modifiers[0].kind === SyntaxKind.ExportKeyword) {
      if (isVariableStatement(node)) {
        node.declarationList.declarations.forEach(decleration => {
          const exportToken: IExportToken = {
            identifier: decleration.name.getText(),
            description: node.getText(),
            position: getLineAndCharacterOfPosition(source, decleration.pos),
            kind: 'variable'
          };
          // if (
          //   decleration.initializer &&
          //   needParams &&
          //   (isFunctionDeclaration(decleration.initializer) ||
          //     isArrowFunction(decleration.initializer))
          // ) {
          //   exportToken.params = getSignature(decleration.initializer);
          // }
          tokenList.push(exportToken);
        });
      } else if (isFunctionDeclaration(node) || isArrowFunction(node)) {
        const position = getLineAndCharacterOfPosition(
          source,
          node.name!.getStart()
        );
        const exportToken: IExportToken = {
          identifier: node.name!.getText(),
          position,
          description: node.getText(),
          kind: 'function'
        };
        tokenList.push(exportToken);
      }
    }
  } catch (error) {
  }
}