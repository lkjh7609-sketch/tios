#!/bin/sh
# 위젯·워치가 함께 쓰는 순수 계산(ios/App/Shared)을 맥에서 바로 시험한다 — Xcode 없이 swiftc만 있으면 된다.
#   sh ios/Tests/run.sh
set -e
cd "$(dirname "$0")"
OUT=$(mktemp -d)
# 시험 파일은 main.swift여야 최상위 코드가 실행된다
cp TripLogicTests.swift "$OUT/main.swift"
swiftc -O -o "$OUT/triptest" ../App/Shared/TripModels.swift ../App/Shared/TripLogic.swift ../App/Shared/TripStrings.swift "$OUT/main.swift"
"$OUT/triptest" | grep -v '^ok'
