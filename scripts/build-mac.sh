#!/usr/bin/env bash
# The Mac build, as scripts/build.ps1 is the Windows one: Studio, the checks, both programs for
# Apple silicon and Intel joined into one file each, and `Superint Video.app` zipped in dist/.
# Runs on a Mac with Rust (rustup), Node.js and npm.
#
#   ./scripts/build-mac.sh [--skip-install] [--skip-checks]
#
# Writes dist/Superint Video.app, dist/Superint-Video-macOS.zip and dist/SHA256SUMS-macos.txt. The
# ZIP has no version in its name, so the README can link the latest one, as it does the setup. The app is signed ad hoc only: Apple silicon runs no unsigned code,
# and without an Apple developer account macOS asks the user once to open it anyway.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

skip_install=0
skip_checks=0
for argument in "$@"; do
  case "$argument" in
    --skip-install) skip_install=1 ;;
    --skip-checks) skip_checks=1 ;;
    *) echo "Unknown option: $argument" >&2; exit 2 ;;
  esac
done

version="$(sed -n 's/^version = "\(.*\)"$/\1/p' Cargo.toml | head -n 1)"
if [ -z "$version" ]; then
  echo "Could not read the package version from Cargo.toml." >&2
  exit 1
fi

(
  cd studio
  if [ "$skip_install" = 0 ]; then npm ci; fi
  if [ "$skip_checks" = 0 ]; then npm run check; fi
  npm run build
)

if [ "$skip_checks" = 0 ]; then
  node --test runtime/scene.test.js
  cargo fmt --all -- --check
  cargo test --locked --lib
fi

targets=(aarch64-apple-darwin x86_64-apple-darwin)
rustup target add "${targets[@]}"
# Rust's own floor for Apple silicon; the Intel build keeps to the same.
export MACOSX_DEPLOYMENT_TARGET=11.0

# rustc writes the source path of every dependency into the program (panic locations). Those
# paths start with the user's folder, which holds the user's name, so the shipped build gets
# short names instead. The last matching remap wins: widest first.
cargo_home="${CARGO_HOME:-$HOME/.cargo}"
flags=(
  "--remap-path-prefix=$HOME=~"
  "--remap-path-prefix=$cargo_home=cargo"
  "--remap-path-prefix=$root=superint-video"
)
encoded="$(IFS=$'\x1f'; echo "${flags[*]}")"
for target in "${targets[@]}"; do
  CARGO_ENCODED_RUSTFLAGS="$encoded" cargo build --locked --release --target "$target"
done

work="$root/target/macos-universal"
rm -rf "$work"
mkdir -p "$work"
for program in superint-video superint-video-app; do
  lipo -create -output "$work/$program" \
    "target/aarch64-apple-darwin/release/$program" \
    "target/x86_64-apple-darwin/release/$program"
  # Nothing shipped may name the build machine's user folder or checkout.
  for local_path in "$HOME" "$root"; do
    if LC_ALL=C grep -a -q -i -F "$local_path" "$work/$program"; then
      echo "$program contains the local path $local_path. Check the --remap-path-prefix flags in scripts/build-mac.sh." >&2
      exit 1
    fi
  done
done

tool="$work/superint-video"
"$tool" schema > "$work/video.schema.json"
if [ "$(cat "$work/video.schema.json")" != "$(tr -d '\r' < docs/video.schema.json)" ]; then
  echo "Rust schema changed. Export cargo run -- schema to docs/video.schema.json, run node scripts/generate-types.mjs, then rebuild." >&2
  exit 1
fi
if [ "$skip_checks" = 0 ]; then
  node studio/verify-api.mjs "$tool"
fi

# The app: the launcher people double-click, the command-line tool next to it, and what the
# Windows ZIP holds besides, in the bundle's resources, where the skills are looked for.
app="dist/Superint Video.app"
resources="$app/Contents/Resources"
rm -rf "$app"
mkdir -p "$app/Contents/MacOS" "$resources/docs"
cp "$work/superint-video-app" "$app/Contents/MacOS/superint-video-app"
cp "$tool" "$app/Contents/MacOS/superint-video"
sed "s/@VERSION@/$version/g" packaging/macos/Info.plist > "$app/Contents/Info.plist"
plutil -lint "$app/Contents/Info.plist" > /dev/null
cp packaging/macos/app.icns "$resources/app.icns"
cp README.md README.en.md SECURITY.md CONTRIBUTING.md CHANGELOG.md THIRD_PARTY_NOTICES.md LICENSE "$resources/"
for document in HANDBUCH.md ENTWICKLER.md DEVELOPERS.md FORMAT.md INTERFACES.md THIRD_PARTY_LICENSES.txt; do
  cp "docs/$document" "$resources/docs/$document"
done
cp "$work/video.schema.json" "$resources/docs/video.schema.json"
cp -R docs/images "$resources/docs/images"
cp -R skills "$resources/skills"
cp -R prompts "$resources/prompts"
# Finder's and the build's extra attributes would break the signature.
xattr -cr "$app"
codesign --force --deep --sign - "$app"
codesign --verify --deep --strict "$app"

archive="Superint-Video-macOS.zip"
rm -f "dist/$archive"
ditto -c -k --keepParent "$app" "dist/$archive"
(cd dist && shasum -a 256 "$archive" > SHA256SUMS-macos.txt)
echo "Built dist/$archive ($version)"
