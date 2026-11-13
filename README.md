# 生肖观察

中文开奖记录、生肖参考、遗漏统计及逐期模拟工具。

## 当前功能

- 平码动态轮换：三个候选生肖、十二生肖排序、逐期命中统计。
- 遗漏统计整页切换：仅特码、平特码（全部7码）；六个维度等权评分、前十号码及49码排序。
- 折线图与柱状图：遗漏走势、排名历史频率、累计盈亏、命中分布。
- 回测支持单肖、二连肖、三连肖分别开关和调整金额。倍数固定，特殊倍数按各期生肖1切换。
- 号码前十的特码账本按每号10元、47倍含本金独立结算；七码模式另展示全部开奖号命中统计。
- 逐期预测只使用目标期之前的开奖记录；结果公布后再核对。

## 技术栈

React 19、TypeScript、Vinext / Vite、Cloudflare Workers；R2绑定名为`BUCKET`。

## 本地运行

建议使用Node.js 24和项目指定的pnpm版本。

```bash
npm install -g pnpm@11.25.0
pnpm install --frozen-lockfile
```

将`.dev.vars.example`复制为`.dev.vars`，设置本地访问密码、会话签名密钥和更新令牌。示例值只供填写参考，不是线上密钥。

```bash
pnpm dev
```

开发服务默认使用5173端口，以终端实际输出为准。构建使用`pnpm build`，构建后可使用`pnpm start`运行本地Worker。

项目保留Sites配套的Worker、R2及预览配置。迁移到其他平台时，需要适配这些绑定；仅上传静态HTML不能运行后端接口。

## 验证

使用Node.js 24可直接运行模型检查，无需先启动网站：

```bash
node scripts/verify-models.mjs
node scripts/verify-all-omissions.mjs
node scripts/verify-bet-methods.mjs
node scripts/verify-omission-performance.mjs
```

`scripts/verify-causality.mjs`包含进一步的历史数据隔离检查，`research/`保留历次研究记录。历史模拟结果不代表未来命中概率。

## 数据与密钥

- `lib/seed.json`是源码内的历史启动快照；线上新增开奖记录保存在R2中，不包含在本次源码同步中。
- `ACCESS_PASSWORD`：访问密码。
- `SESSION_SECRET`：会话签名密钥。
- `UPDATE_TOKEN`：后端数据更新接口密钥。
- 线上密钥继续由托管环境管理，未写入仓库。
- `.dev.vars`、`.env*`、依赖目录及构建输出不应提交。

## 同步来源

本次同步来自当前已发布的Sites源码，版本22，源提交`63e77450ebdbe466c4c07e540da7633faa0509d0`。
原站：https://zodiac-observer-ks.lks960722.chatgpt.site

本次仅同步源码，没有修改原站部署。自动更新入口的历史说明见`AUTOMATION.md`，早期README保存在`docs/README-legacy.md`，其中旧算法介绍不代表当前功能。
