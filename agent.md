# myroot AI 使用说明

## 页面操作（AI 直接点击，不需要手敲命令）

1. 先在"设备选择"面板点大按钮选择设备，再点"获取 Root"或"使用本地 .so 执行"。
2. 终端面板输入框已放在页面顶部，输出窗口矮（约 200px），方便页面内滚动和观察。
3. spawn 执行后页面会打印 `PID=...` 和 `LOG=...`。
4. 终端顶部有三个快捷按钮：
   - `查看 PID 日志`：检查进程是否存活并 tail 最近 80 行日志。
   - `检查 PID`：只检查进程是否存活（`kill -0`）。
   - `刷新重跑`：刷新页面重新执行。

## AI 记录的执行结果

- 每次"获取 Root"按钮执行后，从终端输出里读取 `PID=...`、`LOG=...`。
- 用"查看 PID 日志"按钮确认：`alive=0` 表示进程还在；`alive=1` 表示已退出。
- `woshi` 流程的输出文件是 `/data/data/org.mozilla.firefox/files/result`，完成标志是 `result.done`。
- ghostlock 流程的日志是 `/data/data/org.mozilla.firefox/files/ghostlock.log`，看到 `child is root!` 即 W2 提权成功。

## 已修复的关键 bug

网页 spawn 生成的 shell 命令原来把 `KSUD_*` 环境变量赋值放在 `{ ...; }` 复合命令前面，Android `sh` 会直接报
`syntax error: unexpected '}'` 并退出，导致页面一直等不到 `result.done`。
现在环境变量赋值已移进 `{ }` 内、作为 `/system/bin/env` 命令前缀，语法合法。
