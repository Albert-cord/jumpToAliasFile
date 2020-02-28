import * as vscode from 'vscode';
import Configuration from './Configuration';
import DefinitionProvider from './DefinitionProvider';
// import HoverProvider  from './HoverProvider'

console.log('moduleBundlerAliasFile extension start');
export function activate(context: vscode.ExtensionContext) {
    console.log('moduleBundlerAliasFile extension activing');
    const configuration = new Configuration();
    const definitionProvider = new DefinitionProvider(configuration);
    // const hoverProvider = new HoverProvider(configuration)
    const registerDefinitionProvider = vscode.languages.registerDefinitionProvider({ scheme: 'file', pattern: '**/*.{js,jsx,ts,tsx,vue}' }, definitionProvider);
    // const registerHoverProvider = vscode.languages.registerHoverProvider({ scheme: 'file', pattern: '**/*.{js,jsx,ts,tsx,vue}' }, hoverProvider);

    context.subscriptions.push(configuration);
    context.subscriptions.push(registerDefinitionProvider);
    // context.subscriptions.push(registerHoverProvider);

    console.log('moduleBundlerAliasFile extension actived');
}
