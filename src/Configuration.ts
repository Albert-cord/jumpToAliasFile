import * as vscode from 'vscode';
import * as path from 'path';
import WebpackAliasSearcher from './moduleBundlerSkips/webpack/WebpackAliasSearcher';
import RollupAliasSearcher from './moduleBundlerSkips/rollup/RollupAliasSearcher';
import {getRollupConfigAliasFn} from './util';
import {mockRollupPluginContextResolve} from './mockContext'
import {Alias, RollupAlias} from './types';



export default class WebpackAliasConfiguration {
  private _workspaceDir: string;
  private _configuration: vscode.WorkspaceConfiguration;
  private _listenConfigChangeDispose: { dispose(): any };
  private _webpackAliasSearcher: WebpackAliasSearcher;
  private _rollupAliasSearcher: RollupAliasSearcher;
  public alias: Alias;
  constructor() {
    // 虽然rootPath deprecated 但是新的workspaceFolders不好用
    // this._workspaceDir = vscode.workspace.workspaceFolders['first'] || process.cwd();
    this._workspaceDir = vscode.workspace.rootPath

    this._syncConfiguration();
    this._listenConfigChange();
    this.alias = this._getAlias();
    if (!this.alias.webpackAlias || !Object.keys(this.alias.webpackAlias).length) {
      // 不存在 alias 时, 走自动寻找 alias 策略
      this._webpackAliasSearcher = new WebpackAliasSearcher(this._workspaceDir);

      let webpackAlias = this._webpackAliasSearcher.getDefaultAlias();

      this.alias = {webpackAlias: {...this.alias.webpackAlias, ...webpackAlias}, rollupAlias: this.alias.rollupAlias};
    }

    if(!this.alias.rollupAlias.length) {
      this._rollupAliasSearcher = new RollupAliasSearcher(this._workspaceDir);
      let rollupAlias = this._rollupAliasSearcher.getDefaultAlias();
      this.alias = {webpackAlias: this.alias.webpackAlias, rollupAlias:this.alias.rollupAlias.concat(rollupAlias)};
    }
    this._setAlias(this.alias);
    console.log(JSON.stringify(this.alias))
  }

  private _syncConfiguration() {
    let oldWebpeckConfigPath: string;
    let oldRollupConfigPath: string;

    if (this._configuration) {
      oldWebpeckConfigPath = this._configuration.get('webpeckConfigPath');
      oldRollupConfigPath = this._configuration.get('rollupConfigPath');
    }
    try {
      this._configuration = vscode.workspace.getConfiguration('moduleBundlerAliasFile', vscode.Uri.file(this._workspaceDir));
      let newWebpeckConfigPath: string = this._configuration.get('webpeckConfigPath');
      let newRollupConfigPath: string = this._configuration.get('rollupConfigPath');
  
      if (newWebpeckConfigPath && newWebpeckConfigPath !== oldWebpeckConfigPath) {
        // webpeckConfigPath 发生了变化, 读取 webpackConfig 文件中的 alias, 设置到 alias 中
        this._syncWebpeckConfigAlias(newWebpeckConfigPath);
      }
      if(newRollupConfigPath && newRollupConfigPath !== oldRollupConfigPath) {
        this._syncRollupConfigAlias(newRollupConfigPath);
      }
    } catch (error) {
      console.log(`error: ${error}`);
    }

  }
  private _listenConfigChange() {
    this._listenConfigChangeDispose = vscode.workspace.onDidChangeConfiguration(this._syncConfiguration.bind(this));
  }

  private _getRollupConfigAliasFn(plugins: any[]) {
    return getRollupConfigAliasFn(plugins);
  }

  private _syncRollupConfigAlias(rollupConfigPath: string) {
    let rollupConfig: any;
    let alias = [];
    try {
      rollupConfig = require(path.join(this._workspaceDir, rollupConfigPath));
    } catch (error) {

    }

    if(Array.isArray(rollupConfig)) {
      rollupConfig.forEach(rollupCfg => {
        if (rollupCfg && rollupCfg.plugins) {
          if(this._getRollupConfigAliasFn(rollupCfg.plugins).length) {
            alias.push({name: rollupConfigPath, rollupAliasFunction: this._getRollupConfigAliasFn(rollupCfg.plugins)[0].resolveId.bind(mockRollupPluginContextResolve)})
          }
        }
      })
    } else {
      if (rollupConfig && rollupConfig.plugins) {
        if(this._getRollupConfigAliasFn(rollupConfig.plugins).length) {
          alias.push({name: rollupConfigPath, rollupAliasFunction: this._getRollupConfigAliasFn(rollupConfig.plugins)[0].resolveId.bind(mockRollupPluginContextResolve)})
        }
      }
    }

    this.alias = this.alias || {webpackAlias: {}, rollupAlias: []};
    this.alias.rollupAlias = this.alias.rollupAlias || [];
    this.alias.rollupAlias = [...this.alias.rollupAlias, ...alias];
  }
  private _syncWebpeckConfigAlias(webpeckConfigPath: string) {
    let webpackConfig: any;
    try {
      webpackConfig = require(path.join(this._workspaceDir, webpeckConfigPath));
    } catch (error) {

    }
    if (webpackConfig && webpackConfig.resolve && webpackConfig.resolve.alias && typeof webpackConfig.resolve.alias === 'object') {
      this.alias = { webpackAlias: {...this.alias.webpackAlias, ...webpackConfig.resolve.alias}, rollupAlias: this.alias.rollupAlias};
    }
  }

  private _setAlias(alias: Alias) {
    console.log(alias)
    if (alias && Object.keys(alias).length) {
      try {
        this._configuration.update('allLiteralAlias', alias.webpackAlias);
      } catch (error) {
        console.log(`error: ${error}`)
      }
    }
  }

  private _getAlias():Alias {
    try {
      return {webpackAlias: this._configuration.get<any>('allLiteralAlias'), rollupAlias: []} || {webpackAlias: {}, rollupAlias: []};
    } catch (error) {
      console.log(`error: ${error}`)
      return {webpackAlias: {}, rollupAlias: []};
    }
  }
  dispose() {
    this._listenConfigChangeDispose.dispose();
  }
}