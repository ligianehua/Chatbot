# Chatbot App (Flutter)

Android + iOS 跨平台客户端，基于 Flutter + Riverpod + go_router。

## 目录约定（feature-first）

```
lib/
  core/              # 基础设施（router、theme、network、socket、storage）
  shared/            # 跨 feature 复用 widgets/models
  features/
    auth/            # 注册/登录/忘记密码（阶段 1）
    contacts/        # 通讯录与好友（阶段 1）
    chat/            # 1对1+群+Bot 复用同一聊天 UI（阶段 2）
    groups/          # 群聊（P1）
    bots/            # 创建/详情/市场（阶段 3）
    wallet/          # 钱包与订阅（P1）
    settings/        # 设置
  l10n/              # 国际化 ARB
  main.dart
```

## 本地启动

> 当前仓库**只有 lib/** 代码，platform 目录（android/、ios/、test/）需要本机生成。
>
> 必须有本地 Flutter SDK，参考 https://docs.flutter.dev/get-started/install。

```bash
# 1. 在 app/ 目录补齐 platform 目录（首次执行）
flutter create . --org com.example --project-name chatbot_app --platforms=android,ios

# 2. 装依赖
flutter pub get

# 3. 生成 freezed/json_serializable/drift 等代码
dart run build_runner build --delete-conflicting-outputs

# 4. 启动模拟器或连真机后运行
flutter run
```

## 阶段 0 验收

- [x] `pubspec.yaml` 依赖清单完整
- [x] `lib/main.dart` Tab 框架（消息/通讯录/Bot/我）能打开 4 个空页面
- [x] `lib/core/router/app_router.dart` 路由总入口可见
- [ ] 用户在本机执行 `flutter create .` + `flutter pub get` + `flutter run` 看到 Tab UI

## 阶段 1 已交付

- 网络层：`core/network/dio_client.dart` 含 401 自动刷新 + 并发去重（Completer）
- 安全存储：`core/storage/auth_storage.dart` 用 flutter_secure_storage 存 access/refresh token
- Auth 状态：`features/auth/presentation/auth_provider.dart` (AsyncNotifier) 管理登录态
- Auth 页面：登录、注册、忘记密码（dev 模式可拿到 reset token）
- 路由守卫：未登录跳 `/login`，已登录访问登录页跳 `/chats`
- 通讯录：好友列表 + 加好友（搜索邮箱/ID/昵称）+ 好友请求接受/拒绝
- 设置页：用户信息 + 退出登录

### 连接后端

默认 API 地址 `http://10.0.2.2:3000/api/v1`（Android 模拟器访问宿主机）。
其他场景：

- iOS 模拟器：`flutter run --dart-define=API_BASE_URL=http://localhost:3000/api/v1`
- 真机调试：`flutter run --dart-define=API_BASE_URL=http://<电脑局域网IP>:3000/api/v1`

## 阶段 2 已交付

- `core/socket/socket_client.dart`：Socket.io 客户端封装（自动重连、token 鉴权、事件流暴露）
- `features/chat/data/`：会话/消息 REST API + 模型
- `features/chat/presentation/chats_page.dart`：会话列表（含未读角标、新消息自动刷新）
- `features/chat/presentation/chat_provider.dart`：单会话状态（FamilyAsyncNotifier，加载历史 + socket 实时）
- `features/chat/presentation/chat_detail_page.dart`：聊天页（消息气泡 + 输入框 + 上拉加载历史）
- 通讯录里点好友自动开/复用 direct 会话并跳到聊天页
- 路由：`/chat/:id?title=…`

注意：MVP 阶段消息只在内存缓存，重启后通过 REST 重新加载历史。drift 本地持久化下个迭代再做。

## 后续阶段（见 plan）

阶段 3：Bot 创建表单 + 与 Bot 聊天（流式）
阶段 4：图片消息 + 上架准备
