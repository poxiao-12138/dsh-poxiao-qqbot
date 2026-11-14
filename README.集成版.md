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
npm run pack:release -- 0.2.14
```

打包命令会构建当前代码，把发布包放到工程内的 `releases/`。历史安装包保存在 `releases/archive/`。

QQ 接入和宿主调试细节见 [上游项目](https://github.com/tencent-connect/dsh-qqbot)。

## 安装（给最终用户）

设置页安装和公开安装包地址见 [主 README](./README.md)。通过 Git 仓库地址安装会读取所选提交的包名和版本。
