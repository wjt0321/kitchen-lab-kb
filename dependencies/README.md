# 离线依赖包

这个文件夹用于存放 `requirements.txt` 对应的 Python 依赖包。当前目录已经放入本项目运行所需的本地依赖包，迁移到新电脑后可直接离线安装。

## 已覆盖的顶层依赖

`requirements.txt` 当前包含：

- `fastapi`
- `uvicorn[standard]`
- `pywebview`
- `openpyxl`
- `pydantic`

本目录中除了这些顶层依赖，还包含它们的传递依赖和构建依赖，例如 `starlette`、`anyio`、`pydantic_core`、`pythonnet`、`watchfiles`、`websockets`、`setuptools` 等。

## 离线安装命令

在项目根目录运行：

```bat
python -m pip install --no-index --find-links dependencies -r requirements.txt
```

双击 `启动样品库知识库.bat` 时，如果检测到依赖缺失，也会优先从这里安装。

## 快速校验

在项目根目录运行：

```bat
python -c "import fastapi, uvicorn, webview, openpyxl, pydantic; print('dependencies ok')"
```

看到 `dependencies ok` 说明主要依赖已经能被 Python 导入。

## 注意事项

- 当前包主要按 Windows + Python 3.14 x64 环境准备，其中部分 wheel 文件带有 `cp314` 和 `win_amd64` 标记。
- 如果新电脑使用不同 Python 大版本、32 位 Python 或非 Windows 系统，可能需要重新下载匹配版本的 wheel。
- 如果修改了 `requirements.txt`，请同步更新本目录，否则离线安装可能缺包。
- 不要删除本目录中的 `.whl` 或 `.tar.gz` 文件；迁移时请连同整个项目一起复制。

## 重新生成依赖包

在有网络的电脑上，可用下面命令重新下载：

```bat
python -m pip download -r requirements.txt -d dependencies
```

下载完成后，建议在断网环境或使用 `--no-index` 参数重新安装一次，确认目录完整。
