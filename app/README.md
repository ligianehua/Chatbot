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

## 阶段 3 已交付

- `features/bots/data/`：Bot 模型 + API（CRUD + open conversation）
- `features/bots/presentation/bots_page.dart`：我的 Bot 列表（点击即开聊天）
- `features/bots/presentation/bot_edit_page.dart`：创建表单（姓名/性别/年龄/职位/简介/system prompt/温度滑块/开场白）
- 复用 `chat_detail_page.dart` 与 Bot 聊天，区别仅在 `senderId == null` 时左对齐
- 流式渲染：`bot:start` 插入流式占位气泡，`bot:chunk` 逐 token 追加，`bot:done` 替换为落库消息

## 阶段 4 已交付

- `image_picker` + `url_launcher` 依赖
- `features/chat/data/uploads_api.dart`：multipart 图片上传，自动把服务端返回的相对 URL 解析为绝对地址
- `chat_detail_page.dart`：左下图片按钮，pick → upload → 通过 socket 发送 `type:image`，本地预览先用 `Image.file`，服务端 url 返回后切换 `CachedNetworkImage`
- 会话列表 preview 显示 `[图片]`/`[语音]` 等
- `features/settings/data/legal_api.dart` + `legal_page.dart`：从后端拉取隐私/用户协议
- `delete_account_page.dart`：复选框 + 二次确认弹窗 + 调 `DELETE /users/me` + 自动登出
- 路由：登录页底部公开链接到 `/legal/*`（App Store 审核需要不登录就能访问）

## 阶段 5 已交付（P1 群聊）

- `features/groups/data/`：群信息 + 成员模型 + API
- `features/groups/presentation/group_create_page.dart`：从好友列表多选 → 创建群（创建后直接跳进群聊天）
- `features/groups/presentation/group_info_page.dart`：群信息（成员列表+角色标签）、退群（普通成员）、解散（群主）
- 通讯录页顶部加「新建群聊」入口
- 聊天页 AppBar 在群聊时显示信息图标，跳转 `/groups/:id`
- 会话列表 ChatsPage 把 type/peerId 透传到聊天页，群信息按钮才能工作

## 阶段 6 已交付（P1 Bot 市场 + 订阅 + 钱包）

- `features/bots/data/bot_models.dart`：扩展 `priceType` / `priceCents` / `creator`，含 `priceLabel` 显示
- `features/bots/data/bots_api.dart`：marketplace / subscribed / subscribe / unsubscribe
- `features/bots/presentation/bots_page.dart`：重构为三 TabBar 子页（**我的 / 已订阅 / 发现**），「发现」带搜索框
- `features/bots/presentation/bot_detail_page.dart`：详情页（头像 + 简介 + 创建者 + 价格 + 「订阅」/「开始聊天」按钮），付费有二次确认弹窗；余额不足提示去钱包充值
- `features/bots/presentation/bot_edit_page.dart`：「分享与价格」开关 + 价格类型下拉（免费 / 月订阅 / 一次性）+ 价格输入
- `features/wallet/data/wallet_api.dart`：余额 / 交易记录 / DEV 充值
- `features/wallet/presentation/wallet_page.dart`：余额卡片 + 充值快捷按钮（\$1 / \$5 / \$10 / \$50）+ 交易明细列表
- 设置页加入「钱包」入口
- 路由：`/bots/:id`、`/wallet`

## 阶段 7 已交付（OAuth 登录）

- `sign_in_with_apple` + `google_sign_in` 依赖
- `features/auth/data/oauth_service.dart`：封装两个平台 SDK，返回 `(idToken, nickname?)`
- `auth_api.dart` + `auth_provider.dart`：新增 `oauth()` API 调用和 `signInWithApple()` / `signInWithGoogle()` notifier 方法，登录后存 token 与邮箱密码登录一致
- 登录页加「使用 Apple 登录」（仅 iOS/macOS 显示）和「使用 Google 登录」按钮
- 退出登录时同步清理 Google Sign-In 会话

### 上线前需要做的平台配置

iOS（Apple Sign-In）：
- Xcode → Signing & Capabilities 加 "Sign in with Apple"
- Apple Developer Portal 启用 Service ID
- 后端 `APPLE_AUDIENCES` 填 bundle id + Service ID

Android / iOS（Google Sign-In）：
- Firebase / Google Cloud Console 配 OAuth client（每个平台一套）
- iOS `Info.plist` 加 `REVERSED_CLIENT_ID` URL scheme
- Android `google-services.json` 放对位置
- 后端 `GOOGLE_CLIENT_IDS` 列出全部 client id

## 阶段 8 已交付（Apple IAP + Google Play Billing）

- `in_app_purchase ^3.2.0` 依赖
- `features/wallet/data/iap_api.dart`：catalog + redeem
- `features/wallet/data/iap_service.dart`：包装 `in_app_purchase`，订阅 purchaseStream，自动 POST 后端 `/iap/redeem`，成功后用 Stream 广播余额更新
- `features/wallet/presentation/wallet_page.dart`：从后端拉 productId → 查 store 拿真实 ProductDetails → 渲染商品卡片（店端本地化价格）；购买完成 → 后端校验 → 自动刷新余额
- DEV 快捷充值按钮用 `kDebugMode` 包住，**release build 不可见**（Apple/Google 都禁止应用内不走 IAP 收钱）

### 上线前需要做的配置

iOS：
1. App Store Connect → 创建 4 个 **Consumable** IAP，productId 与后端 catalog 完全一致：
   - `wallet_topup_100` / `wallet_topup_500` / `wallet_topup_1000` / `wallet_topup_5000`
2. Xcode → Signing & Capabilities 加 "In-App Purchase"
3. 准备 Paid Apps 协议 + 银行账户

Android：
1. Play Console → Monetize → In-app products → 创建 **Managed Products**（productId 同上）
2. `in_app_purchase` 已经把 billing client 拉进来了
3. 上传过一次签名 AAB 后才能在 Console 看见商品

后端：
1. 不填 `IAP_MODE`（走真实 verifier）
2. 配 `APPLE_IAP_BUNDLE_IDS` / `GOOGLE_PLAY_PACKAGE_NAME` / `GOOGLE_PLAY_SERVICE_KEY_B64`

### 已知短板

- 中断的购买（kill app 后 store 已扣款但 redemption 没送达）只在用户下次进入「钱包」页时被发现并补单。生产建议把 `iapServiceProvider.start()` 提到 App 启动时立即恢复
- 退款 / 取消订阅自动反账还没接 Apple/Google 的 server notification webhook（已在后端 README 列了 TODO）

## 阶段 9 已交付（推送通知 FCM）

- `firebase_core` + `firebase_messaging` 依赖
- `core/push/push_setup.dart`：
  - `initFirebase()`：main 启动时调用，单次初始化
  - `register()`：登录后调用，请求通知权限 → 拿 FCM token → 生成或读出稳定 deviceId → POST `/users/me/devices`
  - 订阅 `onTokenRefresh`（token 轮换时自动重新注册）
  - 暴露 `onMessageOpened` / `onForegroundMessage` 钩子供路由层做深链
- `main.dart`：通过 `ref.listen` 监听 auth 状态，**用户登录后自动注册推送**
- 容错：Firebase 没配置时 `initFirebase()` 抛错被吞掉，App 仍可运行

### 上线前需要做的配置

iOS：
1. Apple Developer Portal 申请 APNs Authentication Key (.p8)
2. Firebase Console → 项目设置 → Cloud Messaging → iOS → 上传 .p8 / Team ID / Key ID
3. Xcode → Capabilities 加 "Push Notifications" + "Background Modes → Remote notifications"
4. `ios/Runner/Info.plist` 加 `FirebaseAppDelegateProxyEnabled = NO`（如手动管理）+ 拷贝 GoogleService-Info.plist

Android：
1. Firebase Console → 项目设置 → Android app → 下载 `google-services.json` 到 `android/app/`
2. `android/build.gradle` 加 classpath、`android/app/build.gradle` 加 apply plugin
3. Android 13+ 在 `AndroidManifest.xml` 声明 `POST_NOTIFICATIONS` 权限（`firebase_messaging` 已申请）

### 已知短板

- 通知 tap → 深链跳转还没接到 go_router（已留 `onMessageOpened` 钩子，下次提交可补）
- 国内 Android 用户拿不到 FCM（防火墙）；上线时建议把 `firebase_messaging` 包在 `kIsWeb || Platform.isIOS` 检查里，国内 Android 走小米/华为推送（待办）

## 后续阶段（见 plan）

P1 待办：图片审核接阿里云内容安全 / OpenAI Moderation
