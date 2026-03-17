#!/bin/bash
# 获取当前脚本所在目录
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# 赋予 start.sh 执行权限 (以防万一)
chmod +x ./start.sh

# 运行主启动脚本
./start.sh
