# PingTo load agent

Not part of the Chrome zip. Users download **one** file for their OS from GitHub Releases. The extension tab **Load test** offers the matching link and SHA-256.

Listens on `http://127.0.0.1:8788` only.

| OS | File |
|----|------|
| Windows x64 | `pingto-loadtest-windows-amd64.exe` |
| Windows ARM | `pingto-loadtest-windows-arm64.exe` |
| macOS Intel | `pingto-loadtest-macos-amd64` |
| macOS Apple Silicon | `pingto-loadtest-macos-arm64` |
| Linux x64 | `pingto-loadtest-linux-amd64` |
| Linux ARM | `pingto-loadtest-linux-arm64` |

Verify: `Get-FileHash .\file.exe -Algorithm SHA256` or `shasum -a 256 file`. Builds are unsigned until Authenticode / notarization.

`git tag v1.0.0 && git push origin v1.0.0` publishes via CI. Catalog: `releases/latest/download/latest.json`.
