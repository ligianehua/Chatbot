# Chatbot Backend

NestJS + Prisma + PostgreSQL + Redis + Socket.io 的聊天 APP 后端。

## 目录约定

```
src/
  prisma/             # PrismaService (数据库连接)
  health.controller   # /api/v1/health 健康检查
  app.module.ts       # 模块装配根
  main.ts             # 入口
prisma/
  schema.prisma       # 所有数据库表定义
docker-compose.yml    # 本地 PostgreSQL + Redis
.env.example          # 环境变量模板
```

## 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 复制环境变量
cp .env.example .env

# 3. 启动 PostgreSQL + Redis
npm run db:up

# 4. 生成 Prisma Client + 应用初始迁移
npm run prisma:generate
npm run prisma:migrate

# 5. 启动开发服务
npm run start:dev
```

服务监听 `http://localhost:3000/api/v1`，健康检查 `GET /api/v1/health`。

## 阶段 0 验收

- [x] `npm run build` 通过
- [x] `node dist/main.js` 启动成功
- [x] `/api/v1/health` 返回 `{status:"ok", db:"up|down", uptime, timestamp}`
- [x] Prisma schema 通过 `prisma validate`
- [x] `docker compose up -d` 可起 PostgreSQL + Redis（需要 docker daemon）

## 后续阶段（见 plan）

阶段 1：auth + users + friends 模块
阶段 2：chat-gateway (Socket.io) + conversations + messages
阶段 3：bots + llm 网关
阶段 4：上传 + 内容审核 + 上架准备
