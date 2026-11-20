# Export plugins

## 功能

在插件页面新增“导出”入口，支持选择需要导出的插件。

Adds an **Export plugins** row to the Plugins page's add-plugin menu. The
dialog lists every installed plugin with a checkbox, a filter, and a target
folder field; select one or more plugins and confirm to write each one as an
installable bundle directory.

## 使用方法

1. 打开 **Plugins**（插件）页面。
2. 打开 **Add plugin**（添加插件）菜单（`+ / ▾`），点击 **Export plugins**（导出插件）。
3. 勾选需要导出的插件（可用筛选框或 **全选**），然后选择目标文件夹：
   默认是主目录下的 `plugin-exports`，**Browse…** 会打开系统文件夹选择器。
4. 点击 **Export**（导出）。每个选中的插件会写入目标文件夹下**以包名命名的独立子目录**：
   作用域名保留 `@scope` 层级，例如 `@local/account-balance` 会导出到
   `<目标文件夹>/@local/account-balance`。因此多个插件可以共用同一个目标文件夹，
   互不覆盖。

如需重新安装导出的插件：先对同名插件执行 `plugin_manager remove_bundle`，
再对导出目录执行 `plugin_manager install_bundle`。

## 工作原理

- **主机端** (`index.js`)：通过 `ctx.effect` → `ctx.provide` 提供 Cordis 服务
  `pluginExport`。该服务携带运行时 Typert Remote 标记（隐藏在原型上的方法描述符
  和 `typertRemote` 绑定，正是 `@Remote` 装饰器与 `TypertRemoteService` 基类所生成的
  内容），因此 Typert Gateway 会认领 `pluginExport/listPlugins` 与
  `pluginExport/exportPlugin` 两个端点，无需编译器产物。服务扫描 profile 的
  `node_modules`（包括 `@scope` 目录，并跟随目录安装创建的链接）以发现已安装的 bundle。
- **客户端** (`client.js`)：在 `plugins.add.actions` 槽位注册菜单行，在
  `shell.overlay` 槽位注册对话框宿主；通过 `/api` 连接以包级 RPC
  （`ctx.get('connection').rpc.call`）调用上述两个端点，而不是用 `remote.$mount`
  挂载命名空间——后者需要编译器生成的严格输入编解码器。

每个导出目录保留插件的身份与 DSH 接线（`package.json` 的 name、`dsh.bundle` /
`dsh.client`、exports、files），并包含随包发布的运行时文件：`index.js`、
`client.js`、`cordis.patch.yml`、`locale/*.json`、`docs/**`、`icon.svg` 以及
`README.md`（存在时）。重写后的 `package.json` 省略依赖与脚本，因此可作为本地
bundle 安装。

安装本插件后，刷新一次页面即可加载新的客户端部分。
