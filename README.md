Forked from jumpToAliasFile
可以对 webpack, rollup 别名路径或者自定义别名路径进行快速跳转的插件.
### 适用场景
- 自定义文件夹别名和文件夹名称不同, 比如: `"@comp": "src/components"`, 别名`@comp`和文件夹名称`components`是不同的
- .vue 文件, vscode 不能正确识别 .vue 文件的引入

**如果你的自定义文件夹别名和文件夹名称相同, 如`"components": "src/components"`, 别名`components`和文件夹名称`components`是相同的， 通常情况下vscode可以识别到, 不需要使用此插件. 如果vscode不能自动识别, 可以使用此扩展**

![Sample](https://raw.githubusercontent.com/wanfu920/jumpToAliasFile/master/demo.gif)


### Configuration
如果使用的是 webpack, rollup 别名路径, 99% 的情况不需要做任何设置, 插件可以智能的识别出 webpack alias, 并进行自动设置.
- allLiteralAlias: 别名路径映射, 路径为绝对路径
```
"moduleBundlerAliasFile.allLiteralAlias": {
  "@": "/Users/xxx/project/src",
}
```
- webpeckConfigPath: webpack config 文件路径, 路径可以为绝对路径或者相对路径(相对项目根目录)
```
"moduleBundlerAliasFile.webpeckConfigPath": "./webpack.config.json"
```
- rollupConfigPath: rollup config 文件路径, 路径可以为绝对路径或者相对路径(相对项目根目录)
```
"moduleBundlerAliasFile.rollupConfigPath": "./webpack.config.json"
```

### FAQ

### TodoList
1. 增加对其他module bundler的alias支持
2. 监听修改的${moduleBundler}.config.js配置文件从而动态修改alias