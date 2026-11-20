<p align="center">
  <img src="icon.svg" alt="导出插件图标" width="96" height="96">
</p>

# 导出插件

一个 DeepSeek Harness（DSH）插件：在 **插件页面** 新增「导出插件」入口，将选中的已安装插件导出为可安装的插件目录。

[English](README.md) | 简体中文

## 功能

- **导出任意已安装插件** —— 包括 profile 安装的插件、链接到工作区的目录插件，
  以及随 DSH 安装自带的官方 bundle。
- **多选列表** —— 复选框列表，带筛选框与全选 / 清空。
- **每个插件独立目录** —— 每个插件写入以包名命名的子目录；作用域名保留
  `@scope` 层级，因此多个插件可以共用一个目标文件夹而互不覆盖。
- **系统文件夹选择器** —— 「浏览…」打开系统目录选择框；默认目标为
  `~/plugin-exports`。
- **中英双语界面**。
- **无需构建** —— 两端都是原生 JavaScript。

## 环境要求

- DeepSeek Harness 桌面版。
- 本插件是本地 bundle：无需发布到 npm，也无需构建工具链。

## 安装

1. 打开 DSH 的 **Plugins（插件）** 页面。
2. 打开 **Add plugin（添加插件）** 菜单，选择「从本地目录安装」。
3. 指向本仓库的 `plugin-export` 目录并确认。

安装后会显示为 `@local/plugin-export`。刷新一次页面以加载客户端部分。

## 使用

1. 打开 **Plugins（插件）** 页面。
2. 打开 **Add plugin** 菜单（`+ / ▾`），点击 **Export plugins（导出插件）**。
3. 勾选需要导出的插件 —— 可用筛选框或 **全选**。
4. 选择目标文件夹：默认是主目录下的 `plugin-exports`；点击 **浏览…** 打开系统选择器。
5. 点击 **Export（导出）**。

每个插件写入以包名命名的独立子目录：

```text
plugin-exports/
├─ @local/
│  ├─ account-balance/
│  │  ├─ package.json
│  │  ├─ index.js
│  │  ├─ client.js
│  │  ├─ cordis.patch.yml
│  │  ├─ locale/
│  │  └─ docs/
│  └─ plugin-export/
└─ @liustack/
   └─ modlens/
```

非作用域包则直接落在单层目录（`<目标>/dsh-context`）。

### 重新安装导出的插件

导出的目录就是完整的可安装 bundle。重新安装步骤：

1. 若同名插件已安装，先对其执行 `remove_bundle`。
2. 对导出的子目录执行 `install_bundle`，例如
   `plugin-exports/@local/account-balance`。

## 工作原理

- **主机端**（`index.js`）—— 通过 `ctx.effect` → `ctx.provide` 提供 Cordis 服务
  `pluginExport`。该服务携带运行时 Typert Remote 标记（隐藏在原型上的方法描述符，
  以及 `typertRemote` 绑定 —— 正是 `@Remote` 装饰器与 `TypertRemoteService` 基类
  会生成的内容），因此 Typert Gateway 会认领 `pluginExport/listPlugins` 与
  `pluginExport/exportPlugin` 两个端点，无需编译器产物。
- **客户端**（`client.js`）—— 在 `plugins.add.actions` 槽位注册菜单行，在
  `shell.overlay` 槽位注册对话框宿主；通过 `/api` 连接以包级 RPC
  （`ctx.get('connection').rpc.call`）调用上述两个端点，而不是用 `remote.$mount`
  挂载命名空间 —— 后者需要编译器生成的严格输入编解码器。
- **插件发现** —— 主机端按优先级扫描：profile 的 `node_modules`（来自
  `DSH_PROFILE_DIR`、`DSH_HOME`/`DSH_PROFILE` 组合，或枚举
  `~/.dsh/profiles/*/node_modules`）、由模块自身位置推导的目录（链接安装或工作区
  checkout）、以及安装自带的包树。这样即使宿主进程没有拿到 `DSH_*` 环境变量，
  也能正常发现插件。
- **导出布局** —— 每个插件的文件写入 `<目标>/<包名路径>`。`package.json` 会被
  重写：保留身份与 DSH 接线（`name`、`dsh.bundle`、`dsh.client`、`exports`、
  `files`），去掉依赖与脚本，因此结果可作为本地 bundle 安装。复制的运行时文件：
  `index.js`、`client.js`、`cordis.patch.yml`、`locale/*.json`、`docs/**`、
  `icon.svg`，以及存在时的 `README.md`。

## 已知限制

- 只导出已安装包中实际存在的文件；插件不会执行构建步骤。
- 导出的 `package.json` 有意省略依赖、锁文件与脚本。
- 已在 Windows 桌面版验证；实现使用 Node 路径 API，理论上支持 macOS / Linux，
  但尚未验证。

## 开发说明

| 文件 | 作用 |
| --- | --- |
| `index.js` | 主机端 —— 服务、扫描根、文件导出 |
| `client.js` | 客户端 —— 菜单行、对话框、RPC 桥接 |
| `locale/en.json`、`locale/zh.json` | 插件管理器元数据 |
| `docs/DETAIL.md` | 应用内详情页文档 |
| `icon.svg` | 插件图标 |

用 `node --check index.js client.js` 检查两端语法（任意等价 Node 运行时均可）。

## 许可证

本项目以 MIT 许可证开源

## 赞赏

觉得好用的话，请作者喝杯甜红茶吧～

![赞赏码](BlackTea.png)
