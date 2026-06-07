# 样品库知识库管理系统

轻量、易迁移的本地样品库知识库系统，用于记录产品主数据、研发试验配方、配方组合历史和成功率。当前版本作为 MVP 可用版，适合在 Windows 电脑上本地运行和整体迁移。

## 主要功能

- 产品管理：维护品号、品名、规格、当前数量、状态和备注。
- 配方记录：按产品记录试验日期、配方名称、原料辅料、状态、用量和备注。
- 配方复制：从已有配方快速生成一条待观察复测记录，保留原料辅料组合。
- 原料查询：配方列表支持按原料/辅料名称反查，录入时会提示常用原料和单位。
- 库存流水：支持在产品详情中调整库存，并记录变动前后、原因和操作人。
- 成功率查询：按同一产品、同一配方组合统计试验次数、成功次数和成功率，并支持最小试验次数筛选。
- 数据校验：限制非法状态、负数库存/用量，并对不存在的记录返回明确错误。
- 备份：将当前数据库打包到 `backups/`，保留安全恢复点；数据库缺失时不会生成空备份。
- 导出：将产品列表、配方记录、成功率、导入模板或 JSON 数据导出到 `exports/` 专用目录。
- 导入：支持导入本系统导出的 JSON 文件或备份 ZIP，导入前会自动备份当前数据库。
- 退出：页面右上角“退出”会确认后备份当前数据，并停止后台端口和 Python 进程。
- 离线依赖：`dependencies/` 存放 Windows 迁移时可直接安装的依赖包。

## 快速启动

Windows 日常使用推荐直接双击：

```text
兴达样品库知识库.lnk
```

也可以双击启动脚本：

```text
启动样品库知识库.bat
```

启动脚本会执行这些动作：

1. 进入项目目录。
2. 检查 Python 依赖是否已安装。
3. 如缺少依赖，优先从 `dependencies/` 离线安装。
4. 使用 `pythonw.exe` 或 `python.exe` 启动 `startup.py`。
5. 打开本地系统页面，默认地址为 `http://127.0.0.1:7777/`。

首次启动如果需要安装依赖，可能会比平时慢一些。若没有自动弹出页面，可手动访问：

```text
http://127.0.0.1:7777/
```

## 登录

系统采用简单用户名登录，不设置密码。输入的用户名会用于记录创建人和登录记录。

## 手动运行

已安装依赖后，可用命令行启动：

```bash
python startup.py
```

开发调试可使用：

```bash
uvicorn app:app --reload --host 127.0.0.1 --port 7777
```

首次手动安装依赖：

```bash
pip install -r requirements.txt
```

如果目标电脑无法联网，可使用本地依赖目录：

```bash
python -m pip install --no-index --find-links dependencies -r requirements.txt
```

## 导出目录

导出文件集中放在 `exports/`，便于识别和取用：

```text
exports/
  产品列表/
  配方记录/
  成功率/
  导入模板/
  JSON数据/
  _latest/
```

其中 `_latest/` 会保存每类导出的最新文件。历史导出文件仍保留在对应分类目录中。

## 导入说明

页面顶部点击“导入”，可选择：

- JSON：由“导出 JSON”生成的数据文件。
- ZIP：由“备份”生成的数据库备份包。

导入会替换当前数据库，不是追加合并。系统会在导入前自动备份当前数据库，降低误操作风险。

## 退出系统

点击页面右上角红色“退出”按钮：

- 取消：停留在当前页面，不做退出操作。
- 确认退出：先备份当前数据库，再停止后台端口和 Python 进程。

## 数据和文件结构

```text
data/kitchen.db              本地 SQLite 数据库
backups/                     数据库备份 ZIP
exports/                     Excel 和 JSON 导出文件
dependencies/                离线依赖包
docs/                        使用指南和截图
logs/                        启动和运行日志
兴达样品库知识库.lnk          Windows 快捷启动入口
启动样品库知识库.bat          Windows 启动脚本
兴达logo.ico                 Windows 图标
```

`data/`、`backups/`、`exports/`、`logs/` 属于运行数据目录，默认不纳入 Git 版本管理。

## 迁移到其他电脑

迁移时复制整个项目文件夹，不要只复制单个程序文件。建议至少带上：

- `data/`
- `dependencies/`
- `backups/`
- `exports/`
- `兴达样品库知识库.lnk`
- `启动样品库知识库.bat`
- `兴达logo.ico`

到新电脑后双击 `兴达样品库知识库.lnk` 启动。若依赖缺失，启动脚本会尝试从 `dependencies/` 安装。

## 使用指南

更完整的图文说明见：

```text
docs/兴达样品库知识库使用指南.docx
```

## 常见问题

### 双击后页面没有打开

先等待 10 到 30 秒。如果仍未打开，查看：

```text
logs/launcher.log
logs/startup.log
```

也可以手动访问：

```text
http://127.0.0.1:7777/
```

### 端口被占用

优先在页面右上角点击“退出”。如果页面无法打开，可重启电脑后再启动。

### 导入失败

确认导入文件是本系统导出的 JSON，或 `backups/` 中生成的 ZIP 备份。

### 导出后找不到文件

优先查看：

```text
exports/_latest/
```

## 测试

本地检查可运行：

```bash
Get-ChildItem tests\check_*.py | ForEach-Object { python $_.FullName }
python -m py_compile startup.py app.py export.py import_data.py shutdown.py auth.py backup.py db.py
```
