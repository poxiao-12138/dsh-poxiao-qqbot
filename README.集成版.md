# 开发与打包

本机开发包名为 `dsh-qqbot-integrated`，发布包名为 `dsh-poxiao-qqbot`。两者使用本工程的源码。

```sh
pnpm install
npm run build
npm run typecheck:client
npm test
```

用 DSH 已配置的本机链接加载开发版。客户端构建后，重开 DSH 即可查看设置页改动。

```sh
npm run pack:release -- 0.2.26
```

打包命令会构建当前代码，把发布包放到工程内的 `releases/`。历史安装包保存在 `releases/archive/`。

## 发版验收：Git 安装和安装包分别检查

0.2.16 从 Git 安装后，DSH 能显示版本，但设置入口消失。打包构建曾把发布包的前端模块 ID 写进仓库的 `lib/client.js`，导致它与仓库的包名不一致。0.2.17 起，发布包前端只构建到临时打包目录。

1. **Git 仓库**：检查待提交的 `package.json` 与 `lib/client.js`。包名和 `__ModuleLoader__.load({ id })` 都应是 `dsh-qqbot-integrated`，且版本为本次版本。
2. **版本固定的 `.tgz`**：解包检查同样两个字段。两者都应是 `dsh-poxiao-qqbot`，且版本与标签一致。
3. **DSH 实装**：分别用 Git 地址和版本固定的 `.tgz` 安装，在 DSH 里核对版本、启用插件并打开「设置 → QQ 机器人」。两个包使用同一个插件 ID，验收时分开安装。构建和单测通过后，仍需单独记录两个入口的实装结果。
4. **推送后**：核对 Gitee 默认分支、版本标签和下载链接。用 Git 重装的用户拿的是默认分支，发标签时也要检查分支上的版本和前端产物。

QQ 接入和宿主调试细节见 [上游项目](https://github.com/tencent-connect/dsh-qqbot)。
