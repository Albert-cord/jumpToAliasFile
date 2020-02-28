import * as fs from 'fs';
import * as path from 'path';

import {excludePaths} from '../../constants';
import {ModuleBundlerAliasSearcher} from '../ModuleBundlerAliasSearcher';

import {mockRollupPluginContextResolve} from '../../mockContext';

import { ConfigPaths, RollupAlias} from '../../types';
import {getRollupConfigAliasFn} from '../../util';

/**
 * 自动寻找 rollup alias 算法
 *
 * 1. 确定当前工作目录使用到了 rollup
 *
 * 先寻找项目目录中 package.json
 *  仅搜寻当前目录和次级目录下的 package.json
 * 遍历 package.json 中的 script, 找出 rollup 命令使用到的 config 文件
 * 如果没有找到 rollup config 文件, 启用搜寻当前目录下的所有 rollup 开发的文件, 提取出 alias
 */
export default class RollupAliasSearcher extends ModuleBundlerAliasSearcher {
  protected _projects: Map<string, { pkg: any }> = new Map();
  constructor(protected readonly _workspaceDir: string) {
    // this._projects = 
    super(_workspaceDir);
    try {
      const rootWorkspacePackagePath = path.join(this._workspaceDir, 'package.json');
      if (fs.existsSync(rootWorkspacePackagePath)) {
        this._setProject(rootWorkspacePackagePath);
      } else {
        // const files = fs.readdirSync(this._workspaceDir).filter(f => {
        //   if (excludePaths.indexOf(f) > -1) return false;
        //   if (f.includes('.')) return false;
        //   return true;
        // });
        // for (let file of files) {
        //   const subWorkspacePackagePath = path.join(this._workspaceDir, file, 'package.json');
        //   if (fs.existsSync(subWorkspacePackagePath)) {
        //     this._setProject(subWorkspacePackagePath);
        //   }
        // }
      }
    } catch (error) {
    }
  }
  protected _setProject(pkgPath: string) {
    let pkg = require(pkgPath);
    if (
      (pkg.dependencies && pkg.dependencies.rollup) ||
      (pkg.devDependencies && pkg.devDependencies.rollup)
    ) {
      this._projects.set(path.join(pkgPath, '../'), { pkg });
    }
  }
  public getDefaultAlias() {
    let alias: RollupAlias = [];
    try {
      if (this._projects.size) {
        let rollupConfigPaths = this._getConfigPathsFromPackage();
        rollupConfigPaths.push(...this._getConfigsFromFileSearch());
        let rollupConfigs : RollupAlias = this._getConfigs(rollupConfigPaths);
        if (rollupConfigs.length) {
          alias = this._getAliasFromModuleBundlerConfigs(rollupConfigs);
        }
      }
    } catch (error) {
    }
    return alias;
  }
  protected _getConfigs(rollupConfigPaths: ConfigPaths) {
    let newrollupConfigPaths: Map<string, string> = new Map();
    for (const {configPath, projectDir} of rollupConfigPaths) {
      newrollupConfigPaths.set(configPath, projectDir);
    }
    let rollupConfigs: any[] = [];
    for (let [rollupConfigPath, projectDir] of newrollupConfigPaths) {
      try {
        // 修复 create react app 使用 process.cwd() 导致路径获取不正确问题
        // 修复 process.cwd() = projectDir
        process.cwd = () => projectDir;
        process.env.NODE_ENV = process.env.NODE_ENV || 'development';
        const rollupConfig = {
          pathName: rollupConfigPath,
          config: require(rollupConfigPath)
        }
        if (rollupConfig) {
          rollupConfigs.push(rollupConfig);
        }
      } catch (error) {
      }
    }
    return rollupConfigs;
  }
  protected _getConfigPathsFromPackage() {
    let rollupConfigPaths: ConfigPaths = [];
    for(let [projectDir, { pkg }] of this._projects) {
      for (let key of Object.keys(pkg.scripts || {})) {
        const script = pkg.scripts[key];
        let rollupConfigPath = this._getConfigPathsFromScript(script, projectDir);
        if (rollupConfigPath) {
          rollupConfigPaths.push({ configPath: rollupConfigPath, projectDir });
        }
      }
    }
    return rollupConfigPaths;
  }
  protected _getConfigPathsFromScript(script: string, projectDir: string) {
    let tokens = script.split(' ').filter(t => t);
    const rollupIndex = tokens.indexOf('rollup');
    if (rollupIndex > -1) {
      let rollupConfigPath: string;
      const configIndex = tokens.indexOf('-c');
      if (configIndex > rollupIndex && configIndex < tokens.length - 1) {
        rollupConfigPath = tokens[configIndex + 1];
      } else {
        rollupConfigPath = './rollup.config.js';
      }
      rollupConfigPath = path.join(projectDir, rollupConfigPath);
      return rollupConfigPath;
    }
  }

  protected _getRollupConfigAliasFn(plugins: any[]) {
    return getRollupConfigAliasFn(plugins);
  }

  protected _getAliasFromModuleBundlerConfigs(rollupConfigs: any[]) {
    let alias: RollupAlias = [];
    // 多个rollup函数怎么破?
    // 那整一个数组吧，都存进去，更新覆盖应该考虑加个名?

    for(let {config: rollupConfig, pathName} of rollupConfigs) {
      if(Array.isArray(rollupConfig)) {
        rollupConfig.forEach(rollupCfg => {
          if (rollupCfg && rollupCfg.plugins) {
            if(this._getRollupConfigAliasFn(rollupCfg.plugins).length) {
              alias.push({name: pathName, rollupAliasFunction: this._getRollupConfigAliasFn(rollupCfg.plugins)[0].resolveId.bind(mockRollupPluginContextResolve)})
            }
          }
        })
      } else {
        if (rollupConfig && rollupConfig.plugins) {
          if(this._getRollupConfigAliasFn(rollupConfig.plugins).length) {
            alias.push({name: pathName, rollupAliasFunction: this._getRollupConfigAliasFn(rollupConfig.plugins)[0].resolveId.bind(mockRollupPluginContextResolve)})
          }
        }
      }
    }
    return alias;
  }
  protected _getConfigsFromFileSearch() {
    let rollupConfigPaths: ConfigPaths = [];
    for(let [projectDir, { pkg }] of this._projects) {
      let rollupConfigPath = this._traverseGetModuleBundlerConfigsFromFileSearch(projectDir);
      if (rollupConfigPath.length) {
        rollupConfigPaths.push(...rollupConfigPath.map(t => ({configPath: t, projectDir})));
      }
    }
    return rollupConfigPaths;
  }
  protected _traverseGetModuleBundlerConfigsFromFileSearch(filePath: string, deep = 1, maxDeep = 5) {
    if (deep > maxDeep) {
      return [];
    }
    if (!fs.statSync(filePath).isDirectory()) return [];

    // 去除 node_modules test 文件夹, 非 .js 后缀文件, 以及 .开头文件
    let files = fs.readdirSync(filePath)
      .filter(t => {
        excludePaths.indexOf(t) === -1 || t.endsWith('.js') || !t.startsWith('.')
        if (excludePaths.indexOf(t) > -1) return false;
        if (t.includes('.')) {
          if (t.startsWith('.')) return false;
          if (!t.endsWith('.js')) return false;
        }
        return true;
      });
    let dirs = files.filter(t => !t.endsWith('.js'));
    files = files.filter(t => t.endsWith('.js'));

    let rollupConfigPaths: string[] = [];
    for (let file of files) {
      let rollupConfigPath = this._getConfigPathFromFilePath(path.join(filePath, file));
      if (rollupConfigPath) {
        rollupConfigPaths.push(rollupConfigPath);
      }
    }

    for(let dir of dirs) {
      let subrollupConfigPaths = this._traverseGetModuleBundlerConfigsFromFileSearch(path.join(filePath, dir), deep + 1);
      rollupConfigPaths.push(...subrollupConfigPaths);
    }
    return rollupConfigPaths;
  }
  protected _getConfigPathFromFilePath(filePath: string) {
    const tokens = filePath.split('/');
    const fileName = tokens[tokens.length - 1];
    if (/^rollup\..*\.js$/.test(fileName)) {
      return filePath;
    }
  }
}

// export default function createModuleBundlerAliasSearch(_workspaceDir: string) {
//   return new RollupAliasSearcher(_workspaceDir);
// }