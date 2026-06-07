# 离线依赖包

这个文件夹用于存放 `requirements.txt` 对应的 Python 依赖包，迁移到新电脑后可直接离线安装：

```bat
python -m pip install --no-index --find-links dependencies -r requirements.txt
```

双击 `启动样品库知识库.bat` 时，如果检测到依赖缺失，也会优先从这里安装。
