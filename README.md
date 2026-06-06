# 样品库知识库管理系统

轻量、易迁移的样品库知识库管理系统，用于记录产品主数据、研发试验配方及成功率。

## 启动

```bash
pip install -r requirements.txt
python startup.py
```

或开发模式：

```bash
uvicorn app:app --reload --port 8000
```

## 迁移

复制整个文件夹到目标电脑，执行上述启动命令即可。数据库 `data/kitchen.db` 会随文件夹一起迁移。
