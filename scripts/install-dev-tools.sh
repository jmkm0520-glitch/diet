#!/usr/bin/env bash

set -Eeuo pipefail

APP_DIR="${APP_DIR:-$HOME/Applications}"
HOMEBREW_DIR="${HOMEBREW_DIR:-$HOME/homebrew}"
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
NVM_VERSION="${NVM_VERSION:-v0.40.3}"
NODE_VERSION="${NODE_VERSION:-lts/*}"
ZPROFILE="$HOME/.zprofile"
ZSHRC="$HOME/.zshrc"
CODEX_PETS_DIR="${CODEX_HOME:-$HOME/.codex}/pets"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/install-dev-tools.XXXXXX")"
CODEX_MOUNT_POINT=""

step() {
    printf '\n==================================================\n'
    printf '%s\n' "$1"
    printf '==================================================\n'
}

log() {
    printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$1"
}

fail() {
    printf '오류: %s\n' "$1" >&2
    exit 1
}

append_block_if_missing() {
    local file="$1"
    local marker="$2"
    local block="$3"

    touch "$file"

    if ! grep -Fq "$marker" "$file"; then
        printf '\n%s\n' "$block" >> "$file"
    fi
}

cleanup() {
    if [ -n "$CODEX_MOUNT_POINT" ]; then
        hdiutil detach "$CODEX_MOUNT_POINT" >/dev/null 2>&1 || true
    fi

    rm -rf "$WORK_DIR"
}

trap cleanup EXIT

require_macos() {
    [ "$(uname -s)" = "Darwin" ] || fail "이 스크립트는 macOS에서만 실행할 수 있습니다."
}

install_homebrew() {
    step "STEP 1 : Homebrew 설치"

    if command -v brew >/dev/null 2>&1; then
        BREW_BIN="$(command -v brew)"
        log "Homebrew 이미 설치됨: $BREW_BIN"
    elif [ -x "$HOMEBREW_DIR/bin/brew" ]; then
        BREW_BIN="$HOMEBREW_DIR/bin/brew"
        log "Homebrew 이미 설치됨: $BREW_BIN"
    else
        command -v git >/dev/null 2>&1 || fail "Homebrew 설치에 필요한 git을 찾지 못했습니다."
        git clone https://github.com/Homebrew/brew "$HOMEBREW_DIR"
        BREW_BIN="$HOMEBREW_DIR/bin/brew"
    fi

    local brew_config
    brew_config="# Homebrew (install-dev-tools.sh)
eval \"\$($BREW_BIN shellenv)\""

    append_block_if_missing "$ZPROFILE" "# Homebrew (install-dev-tools.sh)" "$brew_config"
    append_block_if_missing "$ZSHRC" "# Homebrew (install-dev-tools.sh)" "$brew_config"

    eval "$("$BREW_BIN" shellenv)"
    "$BREW_BIN" --version
}

codex_download_url() {
    if [ -n "${CODEX_DMG_URL:-}" ]; then
        printf '%s\n' "$CODEX_DMG_URL"
        return
    fi

    case "$(uname -m)" in
        arm64)
            printf '%s\n' "https://persistent.oaistatic.com/codex-app-prod/Codex.dmg"
            ;;
        x86_64)
            printf '%s\n' "https://persistent.oaistatic.com/codex-app-prod/Codex-latest-x64.dmg"
            ;;
        *)
            fail "지원하지 않는 Mac 아키텍처입니다: $(uname -m)"
            ;;
    esac
}

install_codex_app() {
    step "STEP 2 : Codex 앱 설치"

    if [ -d "$APP_DIR/Codex.app" ] || [ -d "$APP_DIR/ChatGPT.app" ]; then
        log "Codex 데스크톱 앱이 이미 설치되어 있습니다."
        return
    fi

    command -v curl >/dev/null 2>&1 || fail "curl을 찾지 못했습니다."
    command -v hdiutil >/dev/null 2>&1 || fail "hdiutil을 찾지 못했습니다."
    command -v ditto >/dev/null 2>&1 || fail "ditto를 찾지 못했습니다."

    local dmg_file="$WORK_DIR/Codex.dmg"
    local app_path
    local app_name

    mkdir -p "$APP_DIR"
    curl --fail --location --retry 3 --progress-bar \
        --output "$dmg_file" \
        "$(codex_download_url)"

    CODEX_MOUNT_POINT="$(
        hdiutil attach "$dmg_file" -nobrowse -readonly \
            | sed -n 's|^.*\(/Volumes/.*\)$|\1|p' \
            | tail -1
    )"

    [ -n "$CODEX_MOUNT_POINT" ] || fail "Codex DMG를 마운트하지 못했습니다."

    app_path="$(find "$CODEX_MOUNT_POINT" -maxdepth 1 -name '*.app' -print -quit)"
    [ -n "$app_path" ] || fail "Codex DMG에서 앱을 찾지 못했습니다."

    app_name="$(basename "$app_path")"
    ditto "$app_path" "$APP_DIR/$app_name"
    hdiutil detach "$CODEX_MOUNT_POINT"
    CODEX_MOUNT_POINT=""

    log "설치 완료: $APP_DIR/$app_name"
}

install_node() {
    step "STEP 3 : Node.js LTS 설치"

    if [ ! -s "$NVM_DIR/nvm.sh" ]; then
        command -v curl >/dev/null 2>&1 || fail "curl을 찾지 못했습니다."
        curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/$NVM_VERSION/install.sh" | bash
    fi

    [ -s "$NVM_DIR/nvm.sh" ] || fail "nvm 설치 파일을 찾지 못했습니다: $NVM_DIR/nvm.sh"

    local nvm_config
    nvm_config='# nvm (install-dev-tools.sh)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"'

    append_block_if_missing "$ZPROFILE" "# nvm (install-dev-tools.sh)" "$nvm_config"
    append_block_if_missing "$ZSHRC" "# nvm (install-dev-tools.sh)" "$nvm_config"

    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"

    nvm install "$NODE_VERSION"
    nvm alias default "$NODE_VERSION"
    nvm use default

    node --version
    npm --version
}

install_pnpm() {
    step "STEP 4 : pnpm 11 설치"

    if command -v pnpm >/dev/null 2>&1; then
        log "pnpm 이미 설치됨: $(command -v pnpm)"
    else
        npm install --global pnpm@latest-11
        hash -r
    fi

    command -v pnpm >/dev/null 2>&1 || fail "pnpm 명령어를 찾지 못했습니다."
    pnpm --version
}

install_github_cli() {
    step "STEP 5 : GitHub CLI 설치"

    if command -v gh >/dev/null 2>&1; then
        log "GitHub CLI 이미 설치됨: $(command -v gh)"
    else
        "$BREW_BIN" install gh
        hash -r
    fi

    command -v gh >/dev/null 2>&1 || fail "gh 명령어를 찾지 못했습니다."
    gh --version
}

install_vercel_cli() {
    step "STEP 6 : Vercel CLI 설치"

    if command -v vercel >/dev/null 2>&1; then
        log "Vercel CLI 이미 설치됨: $(command -v vercel)"
    else
        npm install --global vercel@latest
        hash -r
    fi

    command -v vercel >/dev/null 2>&1 || fail "vercel 명령어를 찾지 못했습니다."
    vercel --version
}

install_ditto_pet() {
    step "STEP 7 : Ditto Codex pet 설치"

    if [ -d "$CODEX_PETS_DIR/ditto" ]; then
        log "Ditto pet이 이미 설치되어 있습니다: $CODEX_PETS_DIR/ditto"
        return
    fi

    npx codex-pets add ditto
    log "Ditto pet 설치 명령을 실행했습니다."
}

main() {
    require_macos
    mkdir -p "$APP_DIR"

    install_homebrew
    install_codex_app
    install_node
    install_pnpm
    install_github_cli
    install_vercel_cli
    install_ditto_pet

    step "설치 완료"
    printf '새 터미널을 열면 PATH와 셸 설정이 적용됩니다.\n'
}

main "$@"
