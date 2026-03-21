# Rhythm Annotating

一个本地优先的节奏记谱编辑器，基于 Next.js 构建，支持：

- 音频波形与频谱预览
- NoteLane 编辑
- 本地自动存档
- 内部 JSON 文本导入导出
- 自定义快捷键
- Web 静态发布
- Electron 桌面打包

## 开发

```bash
pnpm install
pnpm dev
```

默认 Web 构建会保留 GitHub Pages 用的 `basePath`。

## Web 构建

```bash
pnpm build
```

输出目录是 `out/`。

## 桌面构建

桌面版走的是：

1. 使用桌面专用配置执行 Next 静态导出
2. 生成 `dist-desktop-renderer/`
3. 由 Electron 加载本地 `index.html`
4. 使用 Electron Forge 打包

### 本地启动桌面版

```bash
pnpm desktop:start
```

### 只构建桌面 renderer

```bash
pnpm build:desktop:renderer
```

### 当前平台打包

```bash
pnpm desktop:package
pnpm desktop:make
```

### 六种目标脚本

当前仓库内置了 6 个 zip 目标脚本：

```bash
pnpm desktop:make:win:x64
pnpm desktop:make:win:arm64
pnpm desktop:make:mac:x64
pnpm desktop:make:mac:arm64
pnpm desktop:make:linux:x64
pnpm desktop:make:linux:arm64
```

说明：

- 当前配置明确跳过签名和公证。
- 这 6 个脚本统一使用 `@electron-forge/maker-zip`，优先保证多平台/多架构产物链路稳定。
- 我已经在当前仓库上实际验证过 `pnpm desktop:make:win:x64` 可产出桌面包。
- 不同目标平台/架构的最终成功率仍然取决于宿主环境和 Electron 官方二进制可用性。

## 快捷键

在顶部工具栏打开“快捷键”弹窗后，可以为这些动作绑定快捷键：

- 时间轴缩放和平移
- 浏览、强拍、弱拍、长条、选择、粘贴模式
- 单拍等分增加/减少

支持留空禁用。允许临时冲突，但保存时会阻止冲突快捷键。

## 文本导入

当前只支持内部 JSON 格式，并且会覆盖当前 NoteLane。

支持的输入形态：

- 导出的 `NoteLaneData`
- 包含 `lane` 字段的内部导出对象
- 纯 `chartData` 数组

导入时会做：

- JSON 解析错误提示
- 基础字段校验
- 谱面结构校验
- 渲染前二次校验

## 备注

- 桌面构建依赖项目级 `.npmrc` 中的 `node-linker=hoisted`
- Electron 二进制通过 `pnpm rebuild electron` 安装
