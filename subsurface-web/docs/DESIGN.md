好的，现在我为这个方案写一份详尽的设计文档。

---

# Subsurface Web - 纯前端云同步完整设计文档

## 📑 目录

1. [项目概述](#1-项目概述)
2. [架构设计](#2-架构设计)
3. [数据模型](#3-数据模型)
4. [技术栈](#4-技术栈)
5. [模块设计](#5-模块设计)
6. [API 设计](#6-api-设计)
7. [Git 同步机制](#7-git-同步机制)
8. [离线存储方案](#8-离线存储方案)
9. [安全考虑](#9-安全考虑)
10. [实现细节](#10-实现细节)
11. [测试策略](#11-测试策略)
12. [部署方案](#12-部署方案)

---

## 1. 项目概述

### 1.1 项目目标

实现一个**完全运行在浏览器中**的 Subsurface Web 客户端，具有以下特性：

- ✅ 完全离线优先（无需后端服务）
- ✅ 与 Subsurface Cloud 无缝同步
- ✅ 与 Desktop/Mobile 版本完全兼容
- ✅ 支持多设备跨端同步
- ✅ 本地数据完全加密存储
- ✅ 可部署到任何 CDN（GitHub Pages、Vercel、Netlify）

### 1.2 核心使用场景

```
场景 1: 离线编辑
    用户在飞机上编辑潜水记录
    → 数据保存到 IndexedDB
    → 到达有网络时自动同步

场景 2: 跨设备同步
    用户在手机上添加潜水记录
    → Web 端自动拉取最新数据
    → 无需手动同步

场景 3: 冲突解决
    用户在两个设备上同时编辑
    → 自动 3-way merge
    → 保留本地优先版本

场景 4: 纯本地使用
    用户不登录账号
    → 完全本地 Git 仓库
    → 导出为 XML 文件
```

### 1.3 成功标准

| 指标 | 目标 | 验收标准 |
|------|------|--------|
| 离线可用性 | 100% | 断网后仍可编辑和查看 |
| 云同步延迟 | <2s | 包括 merge 和 UI 更新 |
| 存储占用 | <50MB | 1000+ 潜水记录 |
| 兼容性 | Desktop/Mobile | dives.xml 格式 100% 相同 |
| 跨浏览器支持 | Chrome/FF/Safari/Edge | IndexedDB 必须支持 |

---

## 2. 架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────┐
│            用户界面层 (React/Vue)                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  DiveList  DiveDetail  Map  Stats  Settings  │  │
│  └──────────────────────────────────────────────┘  │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────────────────────────────────────────┐
│         业务逻辑层 (Service Layer)                   │
│  ┌────────────────────────────────────────────────┐ │
│  │  SyncManager  DiveService  SiteService        │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────────────────────────────────────────┐
│         存储层 (Storage Layer)                       │
│  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │   Git Service    │  │  IndexedDB Service      │ │
│  │ (isomorphic-git) │  │ (LocalStorageService)   │ │
│  └──────────────────┘  └──────────────────────────┘ │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────────────────────────────────────────┐
│         数据转换层 (Transform Layer)                 │
│  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │  XML Parser      │  │  XML Serializer        │ │
│  │  (xml2js)        │  │  (xml2js)              │ │
│  └──────────────────┘  └──────────────────────────┘ │
└──────────────────┬──────────────────────────────────┘
                   │
                   ↓
        Subsurface Cloud Git Repository
        (现有系统，无需修改)
```

### 2.2 分层说明

#### UI 层
- React/Vue 组件
- 不直接操作数据
- 通过 Service 层交互

#### Service 层
- `SyncManager`: 协调同步操作
- `DiveService`: 潜水数据操作
- `SiteService`: 潜水地点操作
- `TripService`: 旅程操作
- 实现业务规则

#### Storage 层
- `GitService`: Git 操作（基于 isomorphic-git）
- `LocalStorageService`: IndexedDB 操作
- 数据持久化

#### Transform 层
- XML ↔ JSON 转换
- 数据校验
- 格式转换

---

## 3. 数据模型

### 3.1 核心数据结构

#### Dive（潜水记录）
```typescript
interface Dive {
  // 基本信息
  id: number;                    // 唯一 ID (UUID)
  number: number;                // 潜水序号
  when: timestamp;               // 潜水时间
  
  // 位置信息
  diveSite?: DiveSite;          // 潜水地点（可选）
  location?: string;            // 位置文本（备用）
  
  // 时间信息
  duration: {
    seconds: number;            // 潜水时长（秒）
  };
  
  // 深度信息
  depth: {
    max: number;                // 最大深度（毫米）
    mean: number;               // 平均深度（毫米）
  };
  
  // 温度信息
  temperature: {
    air?: number;               // 空气温度（毫开尔文）
    water?: number;             // 水温（毫开尔文）
  };
  
  // 气体信息
  divecomputer?: DiveComputer;  // 潜水电脑
  cylinders?: Cylinder[];       // 气瓶列表
  
  // 注释和标签
  notes?: string;               // 潜水笔记
  buddy?: string;               // 潜伴
  diveguide?: string;           // 潜水导游
  tags?: string[];              // 标签
  
  // 评分
  rating?: number;              // 评分 (0-5)
  visibility?: number;          // 能见度
  
  // 同步状态
  _unsynced?: boolean;          // 是否未同步到云
  _lastModified?: timestamp;    // 最后修改时间
  _hash?: string;               // 数据哈希（用于冲突检测）
}

interface DiveComputer {
  model: string;                // 型号
  deviceid: number;             // 设备 ID
  diveid: number;               // 潜水 ID
  when?: timestamp;             // 记录时间
  divemode: string;             // 潜水模式
  samples?: Sample[];           // 样本数据
}

interface Cylinder {
  type: {
    description: string;        // 描述
    size: number;               // 容量（毫升）
    workingpressure: number;    // 工作压力（毫巴）
  };
  gasmix: GasMix;               // 气体混合
  start: number;                // 起始压力（毫巴）
  end: number;                  // 结束压力（毫巴）
}

interface GasMix {
  o2: number;                   // 氧气百分比 (0-100)
  he: number;                   // 氦气百分比 (0-100)
}

interface Sample {
  time: number;                 // 时间（秒）
  depth: number;                // 深度（毫米）
  pressure?: number[];          // 压力（毫巴）
  temperature?: number;         // 温度（毫开尔文）
  heartbeat?: number;           // 心率（每分钟）
}
```

#### DiveSite（潜水地点）
```typescript
interface DiveSite {
  uuid: number;                 // UUID (8 位十六进制)
  name: string;                 // 名称
  description?: string;         // 描述
  notes?: string;               // 笔记
  location?: {
    latitude: number;           // 纬度
    longitude: number;          // 经度
  };
  taxonomy?: TaxonomyData;       // 地理分类信息
  diveCount?: number;           // 在该地点的潜水数
}

interface TaxonomyData {
  entries: TaxonomyEntry[];     // 分类条目
}

interface TaxonomyEntry {
  category: number;             // 分类 (0=位置, 1=地区, 2=国家)
  value: string;                // 值
  origin: number;               // 来源
}
```

#### DiveTrip（潜水旅程）
```typescript
interface DiveTrip {
  id: string;                   // 唯一 ID
  location: string;             // 旅程地点
  notes?: string;               // 旅程笔记
  when: timestamp;              // 旅程开始时间
  dives: Dive[];                // 包含的潜水
  _unsynced?: boolean;          // 是否未同步
}
```

#### DiveLog（整个潜水日志）
```typescript
interface DiveLog {
  version: number;              // 格式版本 (3)
  program: string;              // 程序名 ("subsurface-web")
  
  // 数据集合
  dives: Dive[];                // 所有潜水
  trips: DiveTrip[];            // 所有旅程
  sites: DiveSite[];            // 所有潜水地点
  
  // 元数据
  _created: timestamp;          // 创建时间
  _modified: timestamp;         // 最后修改时间
  _cloudSha?: string;           // 云端最后 commit SHA
  _localSha?: string;           // 本地最后 commit SHA
}
```

### 3.2 数据关系

```
DiveLog
├─ Dive (1..*)
│  ├─ DiveSite (0..1) [外键关系]
│  ├─ DiveTrip (0..1) [外键关系]
│  ├─ DiveComputer (0..1)
│  ├─ Cylinder (0..*)
│  │  └─ GasMix (1)
│  └─ Sample (0..*)
│
├─ DiveTrip (0..*)
│  └─ Dive (1..*) [从 Dive 引用]
│
└─ DiveSite (0..*)
   ├─ Taxonomy (0..1)
   └─ Dive references (0..*)
```

### 3.3 XML 格式（与 Subsurface 完全兼容）

```xml
<?xml version='1.0' encoding='utf-8'?>
<divelog version='3' program='subsurface-web'>
  <dives>
    <dive number='1' date='2024-01-15' time='10:30' rating='5' visibility='5' 
          divesiteid='a1b2c3d4'>
      <duration>45:30</duration>
      <divemaster/>
      <buddy>John Doe</buddy>
      <diveguide/>
      <suit/>
      <notes>Great dive with sea turtles</notes>
      <location/>
      <coordinates lat='21.123456' lon='-157.654321'/>
      <divecomputer model='Suunto' deviceid='deadbeef' diveid='1'>
        <depth max='25.6 m' mean='15.2 m'/>
        <temperature air='25.0 C' water='24.5 C'/>
        <cylinder o2='21.0' he='0.0' size='11.0 l' workingpressure='230 bar'>
          <start>220 bar</start>
          <end>50 bar</end>
        </cylinder>
        <sample time='0:00' depth='0.0 m' temp='24.5 C' pressure='220 bar'/>
        <!-- ... more samples ... -->
      </divecomputer>
      <picture hash='abc123' filename='IMG_001.jpg'/>
    </dive>
  </dives>
  
  <divesites>
    <site uuid='a1b2c3d4' name='Hanauma Bay' 
          gps='21.123456 -157.654321'>
      <description>Popular dive site</description>
      <notes>Good for beginners</notes>
      <geo cat='0' origin='1' value='Hawaii'/>
      <geo cat='1' origin='1' value='Oahu'/>
      <geo cat='2' origin='1' value='United States'/>
    </site>
  </divesites>
</divelog>
```

---

## 4. 技术栈

### 4.1 核心依赖

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.0.0",
    
    "isomorphic-git": "^1.24.0",
    "dexie": "^3.2.4",
    "xml2js": "^0.6.0",
    
    "react-query": "^3.39.0",
    "zustand": "^4.3.0",
    "zod": "^3.22.0",
    
    "mapbox-gl": "^2.15.0",
    "date-fns": "^2.30.0",
    
    "crypto-js": "^4.1.0",
    "axios": "^1.4.0",
    "@tanstack/react-table": "^8.9.0"
  },
  "devDependencies": {
    "vite": "^4.4.0",
    "@testing-library/react": "^14.0.0",
    "vitest": "^0.34.0",
    "cypress": "^13.2.0",
    "@types/node": "^20.3.0"
  }
}
```

### 4.2 关键库说明

| 库 | 版本 | 用途 | 关键特性 |
|----|------|------|--------|
| **isomorphic-git** | 1.24+ | Git 操作 | 支持 HTTP(S)、IndexedDB、离线 |
| **Dexie** | 3.2+ | IndexedDB 封装 | 类型安全、易用 API |
| **xml2js** | 0.6+ | XML ↔ JSON | 完全兼容 Subsurface XML |
| **React Query** | 3.39+ | 数据缓存 | 自动同步、后台更新 |
| **Zustand** | 4.3+ | 状态管理 | 轻量级、TypeScript 支持 |
| **Mapbox GL** | 2.15+ | 地图显示 | 高性能、离线支持 |

---

## 5. 模块设计

### 5.1 模块树

```
src/
├── types/                     # 类型定义
│   ├── dive.ts               # Dive 类型
│   ├── divesite.ts           # DiveSite 类型
│   ├── trip.ts               # DiveTrip 类型
│   ├── git.ts                # Git 操作类型
│   └── index.ts              # 导出所有类型
│
├── services/                  # 业务服务
│   ├── git/
│   │   ├── GitService.ts     # 核心 Git 操作
│   │   ├── GitAuth.ts        # Git 认证
│   │   ├── GitMerge.ts       # 合并策略
│   │   └── GitUtils.ts       # 工具函数
│   │
│   ├── storage/
│   │   ├── LocalStorageService.ts    # IndexedDB 管理
│   │   ├── DiveStore.ts              # Dives 表
│   │   ├── SiteStore.ts              # Sites 表
│   │   └── TripStore.ts              # Trips 表
│   │
│   ├── sync/
│   │   ├── SyncManager.ts    # 同步协调
│   │   ├── SyncQueue.ts      # 同步队列
│   │   └── ConflictResolver.ts # 冲突解决
│   │
│   ├── transform/
│   │   ├── XmlParser.ts      # XML → JSON
│   │   ├── XmlSerializer.ts  # JSON → XML
│   │   └── Validator.ts      # 数据验证
│   │
│   └── auth/
│       ├── AuthService.ts    # 认证管理
│       ├── CredentialStore.ts # 凭据存储
│       └── CryptoUtil.ts     # 加密工具
│
├── hooks/                     # React Hooks
│   ├── useDives.ts           # 潜水数据 hook
│   ├── useSites.ts           # 地点数据 hook
│   ├── useSync.ts            # 同步状态 hook
│   ├── useAuth.ts            # 认证状态 hook
│   └── useLocalStorage.ts    # 本地存储 hook
│
├── components/                # React 组件
│   ├── DiveList/
│   │   ├── DiveList.tsx      # 列表视图
│   │   ├── DiveCard.tsx      # 卡片组件
│   │   └── DiveListFilters.tsx
│   │
│   ├── DiveDetail/
│   │   ├── DiveDetail.tsx    # 详情页
│   │   ├── DiveEditor.tsx    # 编辑器
│   │   └── ProfileChart.tsx  # 潜水曲线
│   │
│   ├── Map/
│   │   ├── DiveMap.tsx       # 地图显示
│   │   └── MapMarker.tsx     # 标记
│   │
│   ├── Settings/
│   │   ├── Settings.tsx      # 设置页
│   │   ├── CloudAuth.tsx     # 云端认证
│   │   └── SyncSettings.tsx  # 同步设置
│   │
│   └── Common/
│       ├── Header.tsx        # 页面头
│       ├── Nav.tsx           # 导航
│       ├── SyncStatus.tsx    # 同步状态显示
│       └── LoadingSpinner.tsx
│
├── store/                     # Zustand stores
│   ├── diveStore.ts          # Dive 全局状态
│   ├── uiStore.ts            # UI 状态
│   ├── syncStore.ts          # 同步状态
│   └── authStore.ts          # 认证状态
│
├── utils/                     # 工具函数
│   ├── date.ts               # 日期格式化
│   ├── units.ts              # 单位转换
│   ├── logger.ts             # 日志
│   └── error.ts              # 错误处理
│
├── App.tsx                    # 主应用
├── index.tsx                  # 入口
└── styles/                    # 样式文件
    ├── global.css
    └── components/
```

### 5.2 关键模块详解

#### GitService（Git 操作的核心）
```typescript
class GitService {
  // 初始化
  async init(dir: string): Promise<void>
  
  // 仓库操作
  async clone(url: string, dir: string): Promise<void>
  async fetch(url: string): Promise<void>
  async merge(theirs?: string): Promise<void>
  async push(url: string): Promise<void>
  
  // 数据操作
  async readFile(path: string): Promise<string>
  async writeFile(path: string, content: string): Promise<void>
  async commit(message: string): Promise<string>
  
  // 状态查询
  async getCurrentSha(): Promise<string>
  async getRemoteSha(url: string): Promise<string>
  async isConflict(): Promise<boolean>
}
```

#### LocalStorageService（IndexedDB 管理）
```typescript
class LocalStorageService extends Dexie {
  dives: Table<Dive>
  sites: Table<DiveSite>
  trips: Table<DiveTrip>
  metadata: Table<SyncMetadata>
  
  // 潜水操作
  async addDive(dive: Dive): Promise<number>
  async updateDive(id: number, updates: Partial<Dive>): Promise<void>
  async deleteDive(id: number): Promise<void>
  async getDive(id: number): Promise<Dive | undefined>
  async getAllDives(): Promise<Dive[]>
  async queryDives(filter: DiveFilter): Promise<Dive[]>
  
  // 地点操作
  async addSite(site: DiveSite): Promise<void>
  async updateSite(uuid: number, updates: Partial<DiveSite>): Promise<void>
  async getAllSites(): Promise<DiveSite[]>
  
  // 同步元数据
  async getLastSyncTime(): Promise<Date | null>
  async getLastSyncSha(): Promise<string | null>
  async setLastSync(sha: string, time: Date): Promise<void>
}
```

#### SyncManager（同步协调）
```typescript
class SyncManager {
  private gitService: GitService
  private localDb: LocalStorageService
  private autoSync: boolean = false
  private gitLocalOnly: boolean = true  // 离线优先
  
  // 初始化
  async initialize(email?: string, password?: string): Promise<void>
  
  // 同步操作
  async syncWithCloud(): Promise<SyncResult>
  async saveChangesLocal(dives: Dive[]): Promise<void>
  async saveChangesCloud(dives: Dive[]): Promise<void>
  
  // 数据操作（触发同步）
  async addDive(dive: Dive): Promise<void>
  async updateDive(id: number, updates: Partial<Dive>): Promise<void>
  async deleteDive(id: number): Promise<void>
  
  // 状态管理
  setAutoSync(enabled: boolean): void
  setLocalOnly(enabled: boolean): void
  getSyncStatus(): SyncStatus
}
```

---

## 6. API 设计

### 6.1 服务 API

#### Git 服务
```typescript
interface GitService {
  // 初始化和配置
  initRepository(dir: string): Promise<void>
  configureAuth(email: string, password: string): void
  
  // 基本操作
  cloneRepository(url: string): Promise<void>
  fetchFromRemote(url: string): Promise<GitFetchResult>
  mergeWithRemote(strategy?: MergeStrategy): Promise<MergResult>
  pushToRemote(url: string): Promise<GitPushResult>
  
  // 文件操作
  readFile(filepath: string): Promise<string>
  writeFile(filepath: string, content: string): Promise<void>
  
  // 提交操作
  add(filepath: string): Promise<void>
  commit(message: string, author: GitAuthor): Promise<string>
  
  // 状态查询
  getStatus(): Promise<GitStatus>
  getCurrentRef(): Promise<string>
  getRemoteRef(url: string): Promise<string>
  
  // 冲突处理
  isInConflict(): Promise<boolean>
  resolveConflict(strategy: ConflictStrategy): Promise<void>
}

interface GitFetchResult {
  sha: string
  changes: {
    added: string[]
    modified: string[]
    deleted: string[]
  }
}

interface MergeResult {
  success: boolean
  conflicts?: string[]
  conflictStrategy?: 'ours' | 'theirs' | 'manual'
}
```

#### 存储服务
```typescript
interface LocalStorageService {
  // Dive 操作
  dives: {
    create(dive: Dive): Promise<number>
    read(id: number): Promise<Dive | undefined>
    update(id: number, updates: Partial<Dive>): Promise<void>
    delete(id: number): Promise<void>
    list(filter?: DiveFilter): Promise<Dive[]>
    clear(): Promise<void>
  }
  
  // DiveSite 操作
  sites: {
    create(site: DiveSite): Promise<void>
    read(uuid: number): Promise<DiveSite | undefined>
    update(uuid: number, updates: Partial<DiveSite>): Promise<void>
    list(): Promise<DiveSite[]>
  }
  
  // DiveTrip 操作
  trips: {
    create(trip: DiveTrip): Promise<void>
    read(id: string): Promise<DiveTrip | undefined>
    update(id: string, updates: Partial<DiveTrip>): Promise<void>
    list(): Promise<DiveTrip[]>
  }
  
  // 元数据
  metadata: {
    get(key: string): Promise<any>
    set(key: string, value: any): Promise<void>
    delete(key: string): Promise<void>
  }
}
```

#### 同步服务
```typescript
interface SyncManager {
  // 初始化
  init(config: SyncConfig): Promise<void>
  
  // 同步操作
  sync(options?: SyncOptions): Promise<SyncResult>
  manualSync(): Promise<SyncResult>
  
  // 数据修改（自动触发同步）
  add(dive: Dive): Promise<void>
  update(id: number, updates: Partial<Dive>): Promise<void>
  delete(id: number): Promise<void>
  
  // 状态管理
  enableAutoSync(): void
  disableAutoSync(): void
  isAutoSyncEnabled(): boolean
  
  // 状态订阅
  onSyncStatusChange(callback: (status: SyncStatus) => void): () => void
  onDiveChange(callback: (changes: DiveChange[]) => void): () => void
  onConflict(callback: (conflict: DiveConflict) => void): () => void
}

interface SyncResult {
  status: 'success' | 'conflict' | 'error' | 'uptodate'
  dives?: Dive[]
  conflicts?: DiveConflict[]
  error?: string
  timestamp: Date
}
```

### 6.2 React Hooks API

```typescript
// 潜水数据 hook
function useDives(filter?: DiveFilter) {
  return {
    dives: Dive[]
    loading: boolean
    error: Error | null
    add: (dive: Dive) => Promise<void>
    update: (id: number, updates: Partial<Dive>) => Promise<void>
    delete: (id: number) => Promise<void>
    refresh: () => Promise<void>
  }
}

// 地点数据 hook
function useSites() {
  return {
    sites: DiveSite[]
    loading: boolean
    getSiteByUUID: (uuid: number) => DiveSite | undefined
  }
}

// 同步状态 hook
function useSync() {
  return {
    status: 'idle' | 'syncing' | 'error'
    lastSync: Date | null
    unsynced: number
    manualSync: () => Promise<void>
    enableAutoSync: () => void
    disableAutoSync: () => void
    isAutoSyncEnabled: boolean
  }
}

// 认证 hook
function useAuth() {
  return {
    isLoggedIn: boolean
    email: string | null
    login: (email: string, password: string) => Promise<void>
    logout: () => void
    hasCredentials: boolean
  }
}
```

---

## 7. Git 同步机制

### 7.1 同步流程图

```
用户操作
  ↓
┌─────────────────────────────────────┐
│ 1. 保存到本地 IndexedDB             │
│    git_local_only = true            │
│    (立即完成，无延迟)              │
└──────────────┬──────────────────────┘
               ↓
         是否启用自动同步?
         /              \
       YES              NO
        ↓                ↓
┌───────────────────┐  用户等待
│ 2. 提交到本地 Git │  手动同步
│    git add        │
│    git commit     │
└────────┬──────────┘
         ↓
   检查网络连接
    /          \
  有网络      无网络
   ↓           ↓
┌──────────┐  保存到
│3. 拉取   │  本地
│git fetch │  完成
└────┬─────┘
     ↓
┌──────────────────┐
│4. 合并远程更新   │
│git merge         │
│(3-way merge)     │
└────┬─────────────┘
     ↓
  是否有冲突?
  /          \
NO            YES
 ↓             ↓
┌────────┐   ┌─────────────────────┐
│5. 推送 │   │使用 "ours" 策略     │
│git push│   │保留本地版本         │
└───┬────┘   │重新提交和推送       │
    ↓        └────────┬────────────┘
  同步完成           ↓
    ↓            同步完成
   ✓              ✓
```

### 7.2 Git 命令映射

```typescript
// Mobile C++ 方法 ↔ Web JavaScript 方法

// openLocalThenRemote()
async openLocalThenRemote(gitUrl: string) {
  // 1. 检查本地仓库
  const repoExists = await git.status({ fs, dir });
  
  if (!repoExists) {
    // 创建新仓库
    await git.init({ fs, dir })
  }
  
  // 2. 获取当前 SHA
  const currentSha = await git.resolveRef({ fs, dir, ref: 'HEAD' })
  
  // 3. 拉取远程
  await git.fetch({
    fs, http, dir,
    remote: 'origin',
    url: gitUrl,
    onAuth: () => ({ username: email, password })
  })
  
  // 4. 合并
  await git.merge({
    fs, dir,
    ours: 'master',
    theirs: 'origin/master'
  })
  
  // 5. 加载数据
  return loadDives()
}

// saveChangesLocal()
async saveChangesLocal(dives: Dive[]) {
  // 1. 序列化为 XML
  const xml = serializeDivesToXml(dives)
  
  // 2. 写入文件
  await fs.promises.writeFile(`${dir}/dives.xml`, xml)
  
  // 3. Git add
  await git.add({ fs, dir, filepath: 'dives.xml' })
  
  // 4. Git commit
  await git.commit({
    fs, dir,
    message: 'Save changes',
    author: { name: 'Subsurface Web', email: 'web@subsurface' }
  })
}

// saveChangesCloud()
async saveChangesCloud(dives: Dive[]) {
  // 1. 先保存本地
  await saveChangesLocal(dives)
  
  // 2. 如果离线模式，跳过
  if (git_local_only) return
  
  // 3. 拉取最新
  await git.fetch({ /* ... */ })
  
  // 4. 合并
  await git.merge({ /* ... */ })
  
  // 5. 推送
  await git.push({
    fs, http, dir,
    remote: 'origin',
    ref: 'master',
    url: gitUrl,
    onAuth: () => ({ username: email, password })
  })
}
```

### 7.3 冲突解决策略

```typescript
enum ConflictResolutionStrategy {
  // 保留本地版本（默认）
  OURS = 'ours',
  
  // 保留远程版本
  THEIRS = 'theirs',
  
  // 手动解决（显示给用户）
  MANUAL = 'manual'
}

async function resolveConflict(
  localDive: Dive,
  remoteDive: Dive,
  strategy: ConflictResolutionStrategy
): Promise<Dive> {
  switch (strategy) {
    case 'ours':
      // 本地版本优先
      // 但合并远程的某些字段（如 GPS 位置）
      return {
        ...remoteDive,           // 基础字段来自远程
        ...localDive,            // 本地修改覆盖
        _lastModified: Math.max(
          localDive._lastModified || 0,
          remoteDive._lastModified || 0
        )
      }
    
    case 'theirs':
      // 远程版本优先
      return remoteDive
    
    case 'manual':
      // 让用户选择
      return await showConflictDialog(localDive, remoteDive)
  }
}

// 显示冲突对话框（React 组件）
<ConflictDialog
  localDive={local}
  remoteDive={remote}
  onResolve={(resolved) => {
    // 用户选择后的回调
  }}
/>
```

---

## 8. 离线存储方案

### 8.1 IndexedDB 数据库设计

```typescript
// Dexie 数据库定义
class SubsurfaceDB extends Dexie {
  dives: Table<Dive>
  sites: Table<DiveSite>
  trips: Table<DiveTrip>
  metadata: Table<SyncMetadata>
  
  constructor() {
    super('subsurface-web-v1')
    this.version(1).stores({
      // 主键 + 索引
      dives: '++id, date, _lastModified, _unsynced',
      sites: 'uuid, name, _lastModified',
      trips: '++id, when, _lastModified',
      metadata: 'key'
    })
  }
}

interface SyncMetadata {
  key: string
  value: any
  timestamp?: Date
}

// 预定义的元数据 key
const METADATA_KEYS = {
  LAST_SYNC_SHA: 'lastSyncSha',
  LAST_SYNC_TIME: 'lastSyncTime',
  CLOUD_URL: 'cloudUrl',
  CLOUD_EMAIL: 'cloudEmail',
  AUTO_SYNC_ENABLED: 'autoSyncEnabled',
  GIT_LOCAL_ONLY: 'gitLocalOnly',
  VERSION: 'dbVersion'
}
```

### 8.2 存储容量估算

```
IndexedDB 容量:
├─ Chrome/Edge: 50GB 或更多
├─ Firefox: 50GB 或更多
├─ Safari: 50MB (受限)
└─ 其他浏览器: 默认 50MB

Subsurface Web 需求:
├─ 1000 dives × 50KB = 50MB
├─ XML 索引和元数据 = 5MB
└─ Git 对象存储 = 10MB
  ├─ 每个 commit 约 50KB
│ └─ 100 commits = 5MB
│
总计: ~70MB (1000 dives, 100 commits)

结论: 完全足够!
即使 Safari 也能支持 100+ dives
```

### 8.3 数据同步策略

```typescript
// 本地-远程数据同步策略

async function syncLocalWithRemote(): Promise<SyncResult> {
  const localDives = await db.dives.toArray()
  const remoteDives = await gitService.loadDives()
  
  const merged = new Map<number, Dive>()
  
  // 步骤 1: 添加所有远程数据
  for (const dive of remoteDives) {
    merged.set(dive.id, dive)
  }
  
  // 步骤 2: 本地未同步数据覆盖
  for (const dive of localDives) {
    if (dive._unsynced) {
      // 本地版本优先（离线优先原则）
      merged.set(dive.id, {
        ...merged.get(dive.id),
        ...dive,
        _unsynced: true
      })
    }
  }
  
  // 步骤 3: 检测冲突
  const conflicts: DiveConflict[] = []
  for (const dive of localDives) {
    const remoteDive = remoteDives.find(d => d.id === dive.id)
    if (remoteDive && 
        dive._hash !== remoteDive._hash &&
        dive._lastModified > (remoteDive._lastModified || 0)) {
      conflicts.push({
        diveId: dive.id,
        local: dive,
        remote: remoteDive,
        resolution: 'pending'
      })
    }
  }
  
  // 步骤 4: 返回合并结果
  return {
    status: conflicts.length > 0 ? 'conflict' : 'success',
    dives: Array.from(merged.values()),
    conflicts
  }
}
```

### 8.4 存储清理策略

```typescript
// 定期清理过期数据，保持性能

async function cleanupStorage(maxAgeDays: number = 90) {
  const now = Date.now()
  const maxAge = maxAgeDays * 24 * 60 * 60 * 1000
  
  // 清除删除的潜水记录（保留 30 天的"回收站"）
  await db.dives
    .where('_deleted')
    .equals(true)
    .filter(dive => 
      (now - (dive._deletedTime || 0)) > maxAge
    )
    .delete()
  
  // 清除同步完毕的未完成项
  await db.metadata
    .where('key')
    .startsWith('_sync_')
    .filter(m => 
      (now - (m.timestamp?.getTime() || 0)) > 7 * 24 * 60 * 60 * 1000
    )
    .delete()
  
  console.log('[Storage] Cleanup completed')
}

// 每次应用启动时运行
onMount(async () => {
  await cleanupStorage()
})
```

---

## 9. 安全考虑

### 9.1 凭据管理

```typescript
// ⚠️ 安全原则：
// 1. 凭据只在内存中
// 2. 使用 sessionStorage 而非 localStorage
// 3. 页面关闭时自动清除
// 4. 可选择加密存储（生物识别设备）

class SecureCredentialStore {
  private readonly ENCRYPTION_KEY = process.env.REACT_APP_ENCRYPTION_KEY!
  
  /**
   * 保存凭据到 sessionStorage（页面关闭时自动清除）
   */
  saveCredentials(email: string, password: string): void {
    const credentials = JSON.stringify({ email, password })
    
    // 加密存储
    const encrypted = CryptoJS.AES.encrypt(
      credentials,
      this.ENCRYPTION_KEY
    ).toString()
    
    // 只在 sessionStorage 中，不在 localStorage
    sessionStorage.setItem('_creds', encrypted)
  }
  
  /**
   * 读取凭据
   */
  getCredentials(): { email: string; password: string } | null {
    const encrypted = sessionStorage.getItem('_creds')
    if (!encrypted) return null
    
    try {
      const decrypted = CryptoJS.AES.decrypt(
        encrypted,
        this.ENCRYPTION_KEY
      ).toString(CryptoJS.enc.Utf8)
      
      return JSON.parse(decrypted)
    } catch {
      return null
    }
  }
  
  /**
   * 清除凭据
   */
  clearCredentials(): void {
    sessionStorage.removeItem('_creds')
  }
  
  /**
   * 监听页面关闭时清除凭据
   */
  setupAutoCleanup(): void {
    window.addEventListener('beforeunload', () => {
      this.clearCredentials()
    })
  }
}
```

### 9.2 数据加密

```typescript
// 可选的端到端加密

class DiveEncryption {
  /**
   * 对敏感数据进行加密（可选）
   * 用户可以启用本地加密
   */
  async encryptDive(dive: Dive, masterKey: string): Promise<string> {
    const sensitiveFields = ['notes', 'buddy', 'location']
    
    const toEncrypt = {
      ...dive,
      ...Object.fromEntries(
        sensitiveFields.map(field => [
          field,
          CryptoJS.AES.encrypt(dive[field] || '', masterKey).toString()
        ])
      )
    }
    
    return JSON.stringify(toEncrypt)
  }
  
  async decryptDive(encrypted: string, masterKey: string): Promise<Dive> {
    const dive = JSON.parse(encrypted)
    const sensitiveFields = ['notes', 'buddy', 'location']
    
    return {
      ...dive,
      ...Object.fromEntries(
        sensitiveFields.map(field => [
          field,
          field in dive 
            ? CryptoJS.AES.decrypt(dive[field], masterKey)
                .toString(CryptoJS.enc.Utf8)
            : dive[field]
        ])
      )
    }
  }
}
```

### 9.3 网络安全

```typescript
// 仅通过 HTTPS 访问云端

class SecureGitService extends GitService {
  async fetch(url: string, auth: GitAuth): Promise<void> {
    // 确保使用 HTTPS
    if (!url.startsWith('https://')) {
      throw new Error('Only HTTPS is supported for cloud sync')
    }
    
    // 验证证书（isomorphic-git 自动处理）
    await super.fetch(url, auth)
  }
  
  async push(url: string, auth: GitAuth): Promise<void> {
    if (!url.startsWith('https://')) {
      throw new Error('Only HTTPS is supported for cloud sync')
    }
    
    await super.push(url, auth)
  }
}
```

### 9.4 内容安全策略 (CSP)

```html
<!-- index.html -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://tiles.mapbox.com;
  font-src 'self';
  connect-src 'self' https://ssrf-cloud-*.subsurface-divelog.org;
  object-src 'none';
  base-uri 'self';
  form-action 'self'
">
```

---

## 10. 实现细节

### 10.1 React 组件实现示例

#### DiveList 组件
```typescript
// src/components/DiveList/DiveList.tsx
import React, { useState, useCallback, useEffect } from 'react'
import { useDives } from '../../hooks/useDives'
import { useSync } from '../../hooks/useSync'
import DiveCard from './DiveCard'
import DiveListFilters from './DiveListFilters'
import SyncStatus from '../Common/SyncStatus'
import './DiveList.css'

interface DiveListProps {
  initialFilter?: DiveFilter
}

export const DiveList: React.FC<DiveListProps> = ({ initialFilter }) => {
  const [filter, setFilter] = useState<DiveFilter>(initialFilter || {})
  const { dives, loading, error, add, update, delete: deleteDive } = useDives(filter)
  const { status, manualSync } = useSync()
  
  // 处理添加潜水
  const handleAddDive = useCallback(async () => {
    const newDive: Dive = {
      id: Math.random(), // 实际应使用 UUID
      number: (dives.length || 0) + 1,
      when: Date.now(),
      duration: { seconds: 0 },
      depth: { max: 0, mean: 0 },
      temperature: {}
    }
    
    try {
      await add(newDive)
      // UI 自动更新（通过 useDives hook）
    } catch (err) {
      console.error('Failed to add dive:', err)
    }
  }, [add, dives.length])
  
  // 处理删除潜水
  const handleDeleteDive = useCallback(async (id: number) => {
    if (window.confirm('确定要删除这条潜水记录吗？')) {
      try {
        await deleteDive(id)
      } catch (err) {
        console.error('Failed to delete dive:', err)
      }
    }
  }, [deleteDive])
  
  // 处理手动同步
  const handleManualSync = useCallback(async () => {
    try {
      await manualSync()
    } catch (err) {
      console.error('Sync failed:', err)
    }
  }, [manualSync])
  
  return (
    <div className="dive-list-container">
      {/* 头部区域 */}
      <header className="dive-list-header">
        <h1>我的潜水记录</h1>
        <div className="controls">
          <button 
            onClick={handleManualSync}
            disabled={status === 'syncing'}
            className="btn btn-primary"
          >
            {status === 'syncing' ? '同步中...' : '同步云端'}
          </button>
          <button 
            onClick={handleAddDive}
            className="btn btn-success"
          >
            + 添加潜水
          </button>
        </div>
      </header>
      
      {/* 同步状态指示器 */}
      <SyncStatus status={status} />
      
      {/* 过滤器 */}
      <DiveListFilters 
        currentFilter={filter}
        onFilterChange={setFilter}
      />
      
      {/* 内容区域 */}
      {loading ? (
        <div className="loading">加载中...</div>
      ) : error ? (
        <div className="error">加载失败: {error.message}</div>
      ) : dives.length === 0 ? (
        <div className="empty">还没有潜水记录，点击"添加潜水"开始吧</div>
      ) : (
        <div className="dive-grid">
          {dives.map((dive) => (
            <DiveCard
              key={dive.id}
              dive={dive}
              onEdit={() => navigateTo(`/dive/${dive.id}`)}
              onDelete={() => handleDeleteDive(dive.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default DiveList
```

#### useDives Hook
```typescript
// src/hooks/useDives.ts
import { useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { SyncManager } from '../services/sync/SyncManager'
import { Dive, DiveFilter } from '../types'

const syncManager = new SyncManager()

export function useDives(filter?: DiveFilter) {
  const queryClient = useQueryClient()
  const cacheRef = useRef<Dive[]>([])
  
  // 查询潜水列表
  const { data: dives = [], isLoading, error, refetch } = useQuery(
    ['dives', filter],
    async () => {
      const allDives = await syncManager.loadDivesFromCloud()
      
      // 应用过滤
      if (filter) {
        return filterDives(allDives, filter)
      }
      return allDives
    },
    {
      staleTime: 1000 * 60 * 5, // 5 分钟
      cacheTime: 1000 * 60 * 10, // 10 分钟
    }
  )
  
  // 添加潜水
  const addMutation = useMutation(
    async (dive: Dive) => {
      await syncManager.addDive(dive)
    },
    {
      onSuccess: () => {
        // 重新加载列表
        queryClient.invalidateQueries(['dives'])
      }
    }
  )
  
  // 更新潜水
  const updateMutation = useMutation(
    async ({ id, updates }: { id: number; updates: Partial<Dive> }) => {
      await syncManager.updateDive(id, updates)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['dives'])
      }
    }
  )
  
  // 删除潜水
  const deleteMutation = useMutation(
    async (id: number) => {
      await syncManager.deleteDive(id)
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['dives'])
      }
    }
  )
  
  return {
    dives,
    loading: isLoading,
    error: error as Error | null,
    add: addMutation.mutateAsync,
    update: (id: number, updates: Partial<Dive>) =>
      updateMutation.mutateAsync({ id, updates }),
    delete: deleteMutation.mutateAsync,
    refresh: refetch,
    isAdding: addMutation.isLoading,
    isUpdating: updateMutation.isLoading,
    isDeleting: deleteMutation.isLoading
  }
}

function filterDives(dives: Dive[], filter: DiveFilter): Dive[] {
  return dives.filter((dive) => {
    // 按日期范围
    if (filter.startDate && new Date(dive.when) < new Date(filter.startDate)) {
      return false
    }
    if (filter.endDate && new Date(dive.when) > new Date(filter.endDate)) {
      return false
    }
    
    // 按位置
    if (filter.location && dive.diveSite?.name !== filter.location) {
      return false
    }
    
    // 按标签
    if (filter.tags?.length) {
      if (!dive.tags?.some(tag => filter.tags!.includes(tag))) {
        return false
      }
    }
    
    // 按深度范围
    if (filter.minDepth && dive.depth.max < filter.minDepth) {
      return false
    }
    if (filter.maxDepth && dive.depth.max > filter.maxDepth) {
      return false
    }
    
    return true
  })
}
```

### 10.2 XML 解析实现

```typescript
// src/services/transform/XmlParser.ts
import xml2js from 'xml2js'
import { Dive, DiveSite, DiveLog } from '../../types'

export class XmlParser {
  private parser: xml2js.Parser
  private builder: xml2js.Builder
  
  constructor() {
    this.parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
      ignoreAttrs: false
    })
    
    this.builder = new xml2js.Builder({
      rootName: 'divelog',
      xmldec: {
        version: '1.0',
        encoding: 'utf-8'
      },
      attrNameFn: (name: string) => name,
      cdata: false
    })
  }
  
  /**
   * 解析 XML 为 DiveLog
   */
  async parseXml(xmlContent: string): Promise<DiveLog> {
    try {
      const result = await this.parser.parseStringPromise(xmlContent)
      const divelog = result.divelog
      
      return {
        version: parseInt(divelog.$.version || '3'),
        program: divelog.$.program || 'subsurface',
        dives: this.parseDives(divelog.dives?.[0]?.dive || []),
        trips: this.parseTrips(divelog.trips?.[0]?.trip || []),
        sites: this.parseSites(divelog.divesites?.[0]?.site || [])
      }
    } catch (error) {
      throw new Error(`XML parsing failed: ${error}`)
    }
  }
  
  /**
   * 序列化 DiveLog 为 XML
   */
  serializeXml(diveLog: DiveLog): string {
    const obj = {
      $: {
        version: '3',
        program: diveLog.program || 'subsurface-web'
      },
      dives: [
        {
          dive: diveLog.dives.map(d => this.diveToXmlObject(d))
        }
      ],
      divesites: [
        {
          site: diveLog.sites.map(s => this.siteToXmlObject(s))
        }
      ]
    }
    
    return this.builder.buildObject(obj)
  }
  
  /**
   * 解析潜水数组
   */
  private parseDives(diveElements: any[]): Dive[] {
    if (!Array.isArray(diveElements)) {
      diveElements = [diveElements].filter(Boolean)
    }
    
    return diveElements.map(elem => this.parseDive(elem))
  }
  
  /**
   * 解析单个潜水
   */
  private parseDive(elem: any): Dive {
    const dive: Dive = {
      id: parseInt(elem.$.id || Math.random().toString()),
      number: parseInt(elem.$.number || 0),
      when: new Date(elem.$.date + ' ' + elem.$.time).getTime(),
      duration: {
        seconds: this.parseDuration(elem.duration?.[0])
      },
      depth: {
        max: this.parseDepth(
          elem.divecomputer?.[0]?.depth?.[0]?.$.max
        ),
        mean: this.parseDepth(
          elem.divecomputer?.[0]?.depth?.[0]?.$.mean
        )
      },
      temperature: {
        air: this.parseTemp(
          elem.divecomputer?.[0]?.temperature?.[0]?.$.air
        ),
        water: this.parseTemp(
          elem.divecomputer?.[0]?.temperature?.[0]?.$.water
        )
      },
      notes: elem.notes?.[0] || '',
      buddy: elem.buddy?.[0] || '',
      diveguide: elem.diveguide?.[0] || '',
      tags: elem.tags?.[0]?.tag ? 
        (Array.isArray(elem.tags[0].tag) 
          ? elem.tags[0].tag.map((t: any) => t._)
          : [elem.tags[0].tag._]) 
        : [],
      rating: parseInt(elem.$.rating || 0),
      visibility: parseInt(elem.$.visibility || 0)
    }
    
    return dive
  }
  
  /**
   * 潜水对象转 XML 对象
   */
  private diveToXmlObject(dive: Dive): any {
    const date = new Date(dive.when)
    const dateStr = date.toISOString().split('T')[0]
    const timeStr = date.toISOString().split('T')[1].substring(0, 5)
    
    return {
      $: {
        id: dive.id,
        number: dive.number,
        date: dateStr,
        time: timeStr,
        rating: dive.rating || 0,
        visibility: dive.visibility || 0
      },
      duration: [this.formatDuration(dive.duration.seconds)],
      buddy: [dive.buddy || ''],
      diveguide: [dive.diveguide || ''],
      notes: [dive.notes || ''],
      divecomputer: [{
        $: {
          model: 'unknown',
          deviceid: 'deadbeef',
          diveid: '0'
        },
        depth: [{
          $: {
            max: this.formatDepth(dive.depth.max),
            mean: this.formatDepth(dive.depth.mean)
          }
        }],
        temperature: [{
          $: {
            air: dive.temperature.air 
              ? this.formatTemp(dive.temperature.air)
              : '',
            water: dive.temperature.water
              ? this.formatTemp(dive.temperature.water)
              : ''
          }
        }]
      }]
    }
  }
  
  // 辅助解析函数
  private parseDepth(depthStr: string): number {
    // "25.6 m" -> 25600 (mm)
    const match = depthStr?.match(/(\d+\.?\d*)\s*m/)
    return match ? parseFloat(match[1]) * 1000 : 0
  }
  
  private formatDepth(mm: number): string {
    return `${(mm / 1000).toFixed(1)} m`
  }
  
  private parseTemp(tempStr: string): number {
    // "24.5 C" -> 297650 (mK)
    const match = tempStr?.match(/(\d+\.?\d*)\s*C/)
    return match ? (parseFloat(match[1]) + 273.15) * 1000 : 0
  }
  
  private formatTemp(mK: number): string {
    return `${(mK / 1000 - 273.15).toFixed(1)} C`
  }
  
  private parseDuration(durationStr: string): number {
    // "45:30" -> 2730 (seconds)
    const match = durationStr?.match(/(\d+):(\d+)/)
    return match ? parseInt(match[1]) *