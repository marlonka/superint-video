# Third-party notices

Dependency versions below are taken from Cargo.lock/cargo metadata and studio/package-lock.json for this source revision. License expressions are upstream package declarations. This inventory includes development dependencies and platform-specific lockfile entries; it is not a claim that every listed package is linked into every executable.

Superint Video source is licensed under the MIT License (see [LICENSE](LICENSE)).

## Retained license texts

Complete available upstream LICENSE, COPYING, COPYRIGHT and NOTICE files are retained in [docs/THIRD_PARTY_LICENSES.txt](docs/THIRD_PARTY_LICENSES.txt), grouped only when their text is identical. Preserve that file with redistributed application builds. The build script copies it with these notices. The inventory below retains each upstream license expression, including dual-license choices and combined requirements.

Svelte runtime code is embedded in the Studio bundle under its upstream MIT license. Vite, its plugins, TypeScript, Prettier and their tooling dependencies are development dependencies. Rust dependencies include runtime libraries, derive/build tools and target-specific dependencies.

The include_dir crate packages omit their repository-level license file. That MIT license is retained from the exact [upstream source revision recorded in the crates](https://raw.githubusercontent.com/Michael-F-Bryan/include_dir/d742c6fffce99ee89da91b934e7ce6fb2a82680c/LICENSE).

## Bundled preset assets

| Asset | Where | License |
|---|---|---|
| Nunito variable font | `presets/flat-explainer/kit/fonts/Nunito.ttf`; embedded in the executable and copied into projects created from the preset | SIL Open Font License 1.1, Copyright 2014 The Nunito Project Authors. Full text in `presets/flat-explainer/kit/fonts/OFL.txt`, which travels with the font into every project. |
| Jost, Courier Prime, JetBrains Mono, Caveat, Fraunces (latin subsets, WOFF2) | `presets/miniature-3d/kit/fonts/` (JetBrains Mono also in `presets/launch/kit/fonts/`, its licence beside it as `JetBrainsMono-OFL.txt`); embedded in the executable and copied into projects created from the preset | SIL Open Font License 1.1. Copyright 2020 The Jost Project Authors, 2015 The Courier Prime Project Authors, 2020 The JetBrains Mono Project Authors, 2014 The Caveat Project Authors, 2020 The Fraunces Project Authors. Full texts in `presets/miniature-3d/kit/fonts/licenses/` |
| Geist variable font (latin, latin-ext subsets, WOFF2) | `presets/blank/kit/fonts/` and `presets/launch/kit/fonts/`; embedded in the executable and copied into projects created from the preset | SIL Open Font License 1.1, Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font). Full text in `presets/blank/kit/fonts/OFL.txt`. |

## Adapted skill content

`skills/superint-launch/` adapts rules, film shapes, handovers, art directions and the review checklist from [cinetic](https://github.com/Leonxlnx/cinetic) (snapshot `2d63a34f8cba3b197a04c9428b8353625a77b3b2`), rewritten for Superint Video. cinetic is licensed under the MIT License:

```text
MIT License

Copyright (c) 2026 Leonxlnx

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Separately installed runtime tools

| Tool | Distribution in this repository | License information |
|---|---|---|
| Chrome / Chromium / Edge | Not bundled; executable selected by the user or SUPERINT_CHROME | The installed browser and its components retain their own vendor/upstream terms. Chrome version observed during the Windows demo render: 154.0.8037.98. |
| FFmpeg and ffprobe | Not bundled; invoked from PATH or SUPERINT_FFMPEG / SUPERINT_FFPROBE | Observed Windows tools: `9.0.2-full_build-www.gyan.dev`. License depends on the user-installed build and enabled libraries. Inspect that distribution's bundled notices and `ffmpeg -L` / `ffmpeg -buildconf` before redistributing it. |
| System/local fonts | Not bundled | Fonts retain their own licenses. Demo asset generation reads an installed font; it does not copy the font file. |

## Rust dependency inventory

| Package | Locked version | Declared license |
|---|---|---|
| adler2 | 2.0.1 | 0BSD OR MIT OR Apache-2.0 |
| aho-corasick | 1.1.5 | Unlicense OR MIT |
| anstream | 1.0.0 | MIT OR Apache-2.0 |
| anstyle-parse | 1.0.0 | MIT OR Apache-2.0 |
| anstyle-query | 1.1.5 | MIT OR Apache-2.0 |
| anstyle-wincon | 3.0.11 | MIT OR Apache-2.0 |
| anstyle | 1.0.14 | MIT OR Apache-2.0 |
| anyhow | 1.0.104 | MIT OR Apache-2.0 |
| async-tungstenite | 0.32.1 | MIT |
| atomic-waker | 1.1.2 | Apache-2.0 OR MIT |
| autocfg | 1.5.1 | Apache-2.0 OR MIT |
| axum-core | 0.5.6 | MIT |
| axum | 0.8.9 | MIT |
| base64 | 0.22.1 | MIT OR Apache-2.0 |
| base64 | 0.23.1 | MIT OR Apache-2.0 |
| bitflags | 1.3.2 | MIT/Apache-2.0 |
| bitflags | 2.13.2 | MIT OR Apache-2.0 |
| block-buffer | 0.10.4 | MIT OR Apache-2.0 |
| block-buffer | 0.12.1 | MIT OR Apache-2.0 |
| bumpalo | 3.20.3 | MIT OR Apache-2.0 |
| bytemuck | 1.25.2 | Zlib OR Apache-2.0 OR MIT |
| byteorder-lite | 0.1.0 | Unlicense OR MIT |
| bytes | 1.12.1 | MIT |
| cc | 1.11.1 | MIT OR Apache-2.0 |
| cfg_aliases | 0.2.2 | MIT |
| cfg-if | 1.0.5 | MIT OR Apache-2.0 |
| chromiumoxide_cdp | 0.9.1 | MIT OR Apache-2.0 |
| chromiumoxide_pdl | 0.9.1 | MIT OR Apache-2.0 |
| chromiumoxide_types | 0.9.1 | MIT OR Apache-2.0 |
| chromiumoxide | 0.9.1 | MIT OR Apache-2.0 |
| clap_builder | 4.6.7 | MIT OR Apache-2.0 |
| clap_derive | 4.6.7 | MIT OR Apache-2.0 |
| clap_lex | 1.1.1 | MIT OR Apache-2.0 |
| clap | 4.6.7 | MIT OR Apache-2.0 |
| colorchoice | 1.0.5 | MIT OR Apache-2.0 |
| const-oid | 0.10.3 | Apache-2.0 OR MIT |
| constant_time_eq | 0.6.1 | CC0-1.0 OR MIT-0 OR Apache-2.0 |
| core_detect | 1.0.0 | MIT/Apache-2.0 |
| core-foundation-sys | 0.8.7 | MIT OR Apache-2.0 |
| core-foundation | 0.10.1 | MIT OR Apache-2.0 |
| cpufeatures | 0.2.17 | MIT OR Apache-2.0 |
| cpufeatures | 0.3.1 | MIT OR Apache-2.0 |
| crc32fast | 1.5.5 | MIT OR Apache-2.0 |
| crypto-common | 0.1.7 | MIT OR Apache-2.0 |
| crypto-common | 0.2.2 | MIT OR Apache-2.0 |
| dasp_frame | 0.11.0 | MIT OR Apache-2.0 |
| dasp_sample | 0.11.0 | MIT OR Apache-2.0 |
| data-encoding | 2.11.1 | MIT |
| digest | 0.10.7 | MIT OR Apache-2.0 |
| digest | 0.11.3 | MIT OR Apache-2.0 |
| displaydoc | 0.2.7 | MIT OR Apache-2.0 |
| dunce | 1.0.5 | CC0-1.0 OR MIT-0 OR Apache-2.0 |
| dyn-clone | 1.0.20 | MIT OR Apache-2.0 |
| ebur128 | 0.1.11 | MIT |
| either | 1.19.0 | MIT OR Apache-2.0 |
| encoding_rs | 0.8.44 | (Apache-2.0 OR MIT) AND BSD-3-Clause |
| equivalent | 1.0.3 | Apache-2.0 OR MIT |
| errno | 0.3.15 | MIT OR Apache-2.0 |
| fastrand | 2.5.0 | Apache-2.0 OR MIT |
| fdeflate | 0.3.7 | MIT OR Apache-2.0 |
| find-msvc-tools | 0.1.15 | MIT OR Apache-2.0 |
| flate2 | 1.1.11 | MIT OR Apache-2.0 |
| fnv | 1.0.7 | Apache-2.0 / MIT |
| foreign-types-shared | 0.1.1 | MIT/Apache-2.0 |
| foreign-types | 0.3.2 | MIT/Apache-2.0 |
| form_urlencoded | 1.2.2 | MIT OR Apache-2.0 |
| futures-channel | 0.3.34 | MIT OR Apache-2.0 |
| futures-core | 0.3.34 | MIT OR Apache-2.0 |
| futures-executor | 0.3.34 | MIT OR Apache-2.0 |
| futures-io | 0.3.34 | MIT OR Apache-2.0 |
| futures-macro | 0.3.34 | MIT OR Apache-2.0 |
| futures-sink | 0.3.34 | MIT OR Apache-2.0 |
| futures-task | 0.3.34 | MIT OR Apache-2.0 |
| futures-timer | 3.0.4 | MIT/Apache-2.0 |
| futures-util | 0.3.34 | MIT OR Apache-2.0 |
| futures | 0.3.34 | MIT OR Apache-2.0 |
| generic-array | 0.14.7 | MIT |
| getrandom | 0.2.17 | MIT OR Apache-2.0 |
| getrandom | 0.3.4 | MIT OR Apache-2.0 |
| getrandom | 0.4.3 | MIT OR Apache-2.0 |
| h2 | 0.4.20 | MIT |
| hashbrown | 0.17.1 | MIT OR Apache-2.0 |
| heck | 0.5.0 | MIT OR Apache-2.0 |
| hex | 0.4.3 | MIT OR Apache-2.0 |
| hound | 3.5.1 | Apache-2.0 |
| http-body-util | 0.1.5 | MIT |
| http-body | 1.1.0 | MIT |
| http | 1.5.0 | MIT OR Apache-2.0 |
| httparse | 1.10.1 | MIT OR Apache-2.0 |
| httpdate | 1.0.3 | MIT OR Apache-2.0 |
| hybrid-array | 0.4.15 | MIT OR Apache-2.0 |
| hyper-rustls | 0.27.10 | Apache-2.0 OR ISC OR MIT |
| hyper-tls | 0.6.0 | MIT/Apache-2.0 |
| hyper-util | 0.1.21 | MIT |
| hyper | 1.12.0 | MIT |
| icu_collections | 2.4.0 | Unicode-3.0 |
| icu_locale_core | 2.4.0 | Unicode-3.0 |
| icu_normalizer_data | 2.4.0 | Unicode-3.0 |
| icu_normalizer | 2.4.0 | Unicode-3.0 |
| icu_properties_data | 2.4.0 | Unicode-3.0 |
| icu_properties | 2.4.0 | Unicode-3.0 |
| icu_provider | 2.4.0 | Unicode-3.0 |
| idna_adapter | 1.2.2 | Apache-2.0 OR MIT |
| idna | 1.1.0 | MIT OR Apache-2.0 |
| image | 0.25.10 | MIT OR Apache-2.0 |
| include_dir_macros | 0.7.4 | MIT |
| include_dir | 0.7.4 | MIT |
| indexmap | 2.14.2 | Apache-2.0 OR MIT |
| ipnet | 2.12.2 | MIT OR Apache-2.0 |
| is_terminal_polyfill | 1.70.2 | MIT OR Apache-2.0 |
| itoa | 1.0.19 | MIT OR Apache-2.0 |
| js-sys | 0.3.107 | MIT OR Apache-2.0 |
| libc | 0.2.191 | MIT OR Apache-2.0 |
| linux-raw-sys | 0.12.1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| litemap | 0.8.3 | Unicode-3.0 |
| lock_api | 0.4.14 | MIT OR Apache-2.0 |
| log | 0.4.35 | MIT OR Apache-2.0 |
| matchit | 0.8.4 | MIT AND BSD-3-Clause |
| memchr | 2.8.3 | Unlicense OR MIT |
| mime_guess | 2.0.5 | MIT |
| mime | 0.3.18 | MIT OR Apache-2.0 |
| miniz_oxide | 0.8.9 | MIT OR Zlib OR Apache-2.0 |
| miniz_oxide | 0.9.1 | MIT OR Zlib OR Apache-2.0 |
| mio | 1.2.4 | MIT |
| moxcms | 0.8.1 | BSD-3-Clause OR Apache-2.0 |
| multer | 3.1.0 | MIT |
| multiversion_no_op | 1.0.0 | Apache-2.0 OR MIT |
| native-tls | 0.2.18 | MIT OR Apache-2.0 |
| nix | 0.31.3 | MIT |
| num-traits | 0.2.19 | MIT OR Apache-2.0 |
| once_cell_polyfill | 1.70.2 | MIT OR Apache-2.0 |
| once_cell | 1.21.4 | MIT OR Apache-2.0 |
| openssl-macros | 0.1.1 | MIT/Apache-2.0 |
| openssl-probe | 0.2.2 | MIT OR Apache-2.0 |
| openssl-sys | 0.9.118 | MIT |
| openssl | 0.10.82 | Apache-2.0 |
| parking_lot_core | 0.9.12 | MIT OR Apache-2.0 |
| parking_lot | 0.12.5 | MIT OR Apache-2.0 |
| percent-encoding | 2.3.2 | MIT OR Apache-2.0 |
| pin-project-lite | 0.2.17 | Apache-2.0 OR MIT |
| pkg-config | 0.3.34 | MIT OR Apache-2.0 |
| png | 0.18.1 | MIT OR Apache-2.0 |
| potential_utf | 0.1.6 | Unicode-3.0 |
| ppv-lite86 | 0.2.21 | MIT OR Apache-2.0 |
| proc-macro2 | 1.0.107 | MIT OR Apache-2.0 |
| pxfm | 0.1.30 | BSD-3-Clause OR Apache-2.0 |
| quote | 1.0.47 | MIT OR Apache-2.0 |
| r-efi | 5.3.0 | MIT OR Apache-2.0 OR LGPL-2.1-or-later |
| r-efi | 6.0.0 | MIT OR Apache-2.0 OR LGPL-2.1-or-later |
| rand_chacha | 0.9.0 | MIT OR Apache-2.0 |
| rand_core | 0.9.5 | MIT OR Apache-2.0 |
| rand | 0.9.5 | MIT OR Apache-2.0 |
| redox_syscall | 0.5.18 | MIT |
| ref-cast-impl | 1.0.27 | MIT OR Apache-2.0 |
| ref-cast | 1.0.27 | MIT OR Apache-2.0 |
| regex-automata | 0.4.18 | MIT OR Apache-2.0 |
| regex-syntax | 0.8.11 | MIT OR Apache-2.0 |
| regex | 1.13.1 | MIT OR Apache-2.0 |
| reqwest | 0.13.5 | MIT OR Apache-2.0 |
| ring | 0.17.14 | Apache-2.0 AND ISC |
| rustix | 1.1.6 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| rustls-pki-types | 1.16.0 | MIT OR Apache-2.0 |
| rustls-webpki | 0.103.17 | ISC |
| rustls | 0.23.46 | Apache-2.0 OR ISC OR MIT |
| rustversion | 1.0.23 | MIT OR Apache-2.0 |
| ryu | 1.0.23 | Apache-2.0 OR BSL-1.0 |
| same-file | 1.0.6 | Unlicense/MIT |
| schannel | 0.1.30 | MIT |
| schemars_derive | 1.2.3 | MIT |
| schemars | 1.2.3 | MIT |
| scopeguard | 1.2.0 | MIT OR Apache-2.0 |
| security-framework-sys | 2.17.0 | MIT OR Apache-2.0 |
| security-framework | 3.7.0 | MIT OR Apache-2.0 |
| serde_core | 1.0.229 | MIT OR Apache-2.0 |
| serde_derive_internals | 0.30.0 | MIT OR Apache-2.0 |
| serde_derive | 1.0.229 | MIT OR Apache-2.0 |
| serde_json | 1.0.154 | MIT OR Apache-2.0 |
| serde_path_to_error | 0.1.20 | MIT OR Apache-2.0 |
| serde_spanned | 1.1.3 | MIT OR Apache-2.0 |
| serde_urlencoded | 0.7.1 | MIT/Apache-2.0 |
| serde | 1.0.229 | MIT OR Apache-2.0 |
| sha1 | 0.10.7 | MIT OR Apache-2.0 |
| sha2 | 0.11.1 | MIT OR Apache-2.0 |
| shlex | 2.0.1 | MIT OR Apache-2.0 |
| signal-hook-registry | 1.4.8 | MIT OR Apache-2.0 |
| simd-adler32 | 0.3.10 | MIT |
| simdutf8 | 0.1.5 | MIT OR Apache-2.0 |
| slab | 0.4.12 | MIT |
| smallvec | 1.16.5 | MIT OR Apache-2.0 |
| socket2 | 0.6.5 | MIT OR Apache-2.0 |
| spin | 0.9.9 | MIT |
| stable_deref_trait | 1.2.1 | MIT OR Apache-2.0 |
| strsim | 0.11.1 | MIT |
| subtle | 2.6.1 | BSD-3-Clause |
| syn | 2.0.119 | MIT OR Apache-2.0 |
| syn | 3.0.10 | MIT OR Apache-2.0 |
| sync_wrapper | 1.0.2 | Apache-2.0 |
| synstructure | 0.14.0 | MIT |
| tempfile | 3.27.0 | MIT OR Apache-2.0 |
| thiserror-impl | 2.0.21 | MIT OR Apache-2.0 |
| thiserror | 2.0.21 | MIT OR Apache-2.0 |
| tinystr | 0.8.5 | Unicode-3.0 |
| tokio-macros | 2.7.2 | MIT |
| tokio-native-tls | 0.3.1 | MIT |
| tokio-rustls | 0.26.6 | MIT OR Apache-2.0 |
| tokio-stream | 0.1.19 | MIT |
| tokio-util | 0.7.20 | MIT |
| tokio | 1.54.1 | MIT |
| toml_datetime | 1.1.3+spec-1.1.0 | MIT OR Apache-2.0 |
| toml_parser | 1.1.5+spec-1.1.0 | MIT OR Apache-2.0 |
| toml_writer | 1.2.0+spec-1.1.0 | MIT OR Apache-2.0 |
| toml | 1.2.1+spec-1.1.0 | MIT OR Apache-2.0 |
| tower-http | 0.6.11 | MIT |
| tower-layer | 0.3.3 | MIT |
| tower-service | 0.3.3 | MIT |
| tower | 0.5.3 | MIT |
| tracing-attributes | 0.1.31 | MIT |
| tracing-core | 0.1.36 | MIT |
| tracing | 0.1.44 | MIT |
| try-lock | 0.2.5 | MIT |
| tungstenite | 0.28.0 | MIT OR Apache-2.0 |
| typed-path | 0.13.0 | MIT OR Apache-2.0 |
| typenum | 1.20.1 | MIT OR Apache-2.0 |
| unicase | 2.10.0 | MIT OR Apache-2.0 |
| unicode-ident | 1.0.27 | (MIT OR Apache-2.0) AND Unicode-3.0 |
| untrusted | 0.9.0 | ISC |
| url | 2.5.8 | MIT OR Apache-2.0 |
| utf-8 | 0.7.6 | MIT OR Apache-2.0 |
| utf8_iter | 1.1.0 | Apache-2.0 OR MIT |
| utf8parse | 0.2.2 | Apache-2.0 OR MIT |
| utf_types | 1.0.0 | Apache-2.0 OR MIT |
| uuid | 1.29.2 | Apache-2.0 OR MIT |
| vcpkg | 0.2.15 | MIT/Apache-2.0 |
| version_check | 0.9.5 | MIT/Apache-2.0 |
| walkdir | 2.5.0 | Unlicense/MIT |
| want | 0.3.2 | MIT |
| wasi | 0.11.1+wasi-snapshot-preview1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| wasip2 | 1.0.4+wasi-0.2.12 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| wasm-bindgen-futures | 0.4.80 | MIT OR Apache-2.0 |
| wasm-bindgen-macro-support | 0.2.130 | MIT OR Apache-2.0 |
| wasm-bindgen-macro | 0.2.130 | MIT OR Apache-2.0 |
| wasm-bindgen-shared | 0.2.130 | MIT OR Apache-2.0 |
| wasm-bindgen | 0.2.130 | MIT OR Apache-2.0 |
| wasm-streams | 0.5.0 | MIT OR Apache-2.0 |
| web-sys | 0.3.107 | MIT OR Apache-2.0 |
| which | 8.0.6 | MIT |
| winapi-util | 0.1.11 | Unlicense OR MIT |
| windows_aarch64_gnullvm | 0.52.6 | MIT OR Apache-2.0 |
| windows_aarch64_msvc | 0.52.6 | MIT OR Apache-2.0 |
| windows_i686_gnu | 0.52.6 | MIT OR Apache-2.0 |
| windows_i686_gnullvm | 0.52.6 | MIT OR Apache-2.0 |
| windows_i686_msvc | 0.52.6 | MIT OR Apache-2.0 |
| windows_x86_64_gnu | 0.52.6 | MIT OR Apache-2.0 |
| windows_x86_64_gnullvm | 0.52.6 | MIT OR Apache-2.0 |
| windows_x86_64_msvc | 0.52.6 | MIT OR Apache-2.0 |
| windows-link | 0.2.1 | MIT OR Apache-2.0 |
| windows-registry | 0.6.1 | MIT OR Apache-2.0 |
| windows-result | 0.4.1 | MIT OR Apache-2.0 |
| windows-strings | 0.5.1 | MIT OR Apache-2.0 |
| windows-sys | 0.52.0 | MIT OR Apache-2.0 |
| windows-sys | 0.61.2 | MIT OR Apache-2.0 |
| windows-targets | 0.52.6 | MIT OR Apache-2.0 |
| winnow | 1.0.5 | MIT |
| winresource | 0.1.34 | MIT |
| wit-bindgen | 0.57.1 | Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT |
| writeable | 0.6.4 | Unicode-3.0 |
| yoke-derive | 0.8.4 | Unicode-3.0 |
| yoke | 0.8.4 | Unicode-3.0 |
| zerocopy-derive | 0.8.63 | BSD-2-Clause OR Apache-2.0 OR MIT |
| zerocopy | 0.8.63 | BSD-2-Clause OR Apache-2.0 OR MIT |
| zerofrom-derive | 0.1.8 | Unicode-3.0 |
| zerofrom | 0.1.8 | Unicode-3.0 |
| zeroize_derive | 1.5.0 | Apache-2.0 OR MIT |
| zeroize | 1.9.1 | Apache-2.0 OR MIT |
| zerotrie | 0.2.5 | Unicode-3.0 |
| zerovec-derive | 0.11.7 | Unicode-3.0 |
| zerovec | 0.11.9 | Unicode-3.0 |
| zip | 9.5.1 | MIT |
| zlib-rs | 0.6.8 | Zlib |
| zmij | 1.0.23 | MIT |
| zune-core | 0.5.3 | MIT OR Apache-2.0 OR Zlib |
| zune-jpeg | 0.5.15 | MIT OR Apache-2.0 OR Zlib |

## Studio build dependency inventory

| Package | Locked version | Declared license |
|---|---|---|
| @emnapi/core | 2.0.0-beta.2 | MIT |
| @emnapi/runtime | 2.0.0-beta.2 | MIT |
| @emnapi/wasi-threads | 2.2.0 | MIT |
| @jridgewell/gen-mapping | 0.3.13 | MIT |
| @jridgewell/remapping | 2.3.5 | MIT |
| @jridgewell/resolve-uri | 3.1.2 | MIT |
| @jridgewell/sourcemap-codec | 1.6.0 | MIT |
| @jridgewell/trace-mapping | 0.3.31 | MIT |
| @napi-rs/wasm-runtime | 1.2.6 | MIT |
| @oxc-project/types | 0.156.0 | MIT |
| @rolldown/binding-android-arm-eabi | 1.2.19 | MIT |
| @rolldown/binding-android-arm64 | 1.2.19 | MIT |
| @rolldown/binding-darwin-arm64 | 1.2.19 | MIT |
| @rolldown/binding-darwin-x64 | 1.2.19 | MIT |
| @rolldown/binding-freebsd-x64 | 1.2.19 | MIT |
| @rolldown/binding-linux-arm-gnueabihf | 1.2.19 | MIT |
| @rolldown/binding-linux-arm64-gnu | 1.2.19 | MIT |
| @rolldown/binding-linux-arm64-musl | 1.2.19 | MIT |
| @rolldown/binding-linux-ppc64-gnu | 1.2.19 | MIT |
| @rolldown/binding-linux-s390x-gnu | 1.2.19 | MIT |
| @rolldown/binding-linux-x64-gnu | 1.2.19 | MIT |
| @rolldown/binding-linux-x64-musl | 1.2.19 | MIT |
| @rolldown/binding-openharmony-arm64 | 1.2.19 | MIT |
| @rolldown/binding-wasm32-wasi | 1.2.19 | MIT |
| @rolldown/binding-win32-arm64-msvc | 1.2.19 | MIT |
| @rolldown/binding-win32-x64-msvc | 1.2.19 | MIT |
| @rolldown/pluginutils | 1.1.0 | MIT |
| @sveltejs/acorn-typescript | 1.0.13 | MIT |
| @sveltejs/load-config | 0.2.3 | MIT |
| @sveltejs/vite-plugin-svelte | 7.3.1 | MIT |
| @tybys/wasm-util | 0.10.4 | MIT |
| @types/estree | 1.0.10 | MIT |
| @typescript/typescript-aix-ppc64 | 7.0.2 | Apache-2.0 |
| @typescript/typescript-darwin-arm64 | 7.0.2 | Apache-2.0 |
| @typescript/typescript-darwin-x64 | 7.0.2 | Apache-2.0 |
| @typescript/typescript-freebsd-arm64 | 7.0.2 | Apache-2.0 |
| @typescript/typescript-freebsd-x64 | 7.0.2 | Apache-2.0 |
| @typescript/typescript-linux-arm | 7.0.2 | Apache-2.0 |
| @typescript/typescript-linux-arm64 | 7.0.2 | Apache-2.0 |
| @typescript/typescript-linux-loong64 | 7.0.2 | Apache-2.0 |
| @typescript/typescript-linux-mips64el | 7.0.2 | Apache-2.0 |
| @typescript/typescript-linux-ppc64 | 7.0.2 | Apache-2.0 |
| @typescript/typescript-linux-riscv64 | 7.0.2 | Apache-2.0 |
| @typescript/typescript-linux-s390x | 7.0.2 | Apache-2.0 |
| @typescript/typescript-linux-x64 | 7.0.2 | Apache-2.0 |
| @typescript/typescript-netbsd-arm64 | 7.0.2 | Apache-2.0 |
| @typescript/typescript-netbsd-x64 | 7.0.2 | Apache-2.0 |
| @typescript/typescript-openbsd-arm64 | 7.0.2 | Apache-2.0 |
| @typescript/typescript-openbsd-x64 | 7.0.2 | Apache-2.0 |
| @typescript/typescript-sunos-x64 | 7.0.2 | Apache-2.0 |
| @typescript/typescript-win32-arm64 | 7.0.2 | Apache-2.0 |
| @typescript/typescript-win32-x64 | 7.0.2 | Apache-2.0 |
| acorn | 8.19.0 | MIT |
| aria-query | 5.3.1 | Apache-2.0 |
| axobject-query | 4.1.0 | Apache-2.0 |
| chokidar | 4.0.3 | MIT |
| clsx | 2.1.1 | MIT |
| deepmerge | 4.3.1 | MIT |
| detect-libc | 2.1.2 | Apache-2.0 |
| devalue | 5.9.4 | MIT |
| esm-env | 1.2.2 | MIT |
| esrap | 2.4.0 | MIT |
| fdir | 6.5.0 | MIT |
| fsevents | 2.3.3 | MIT |
| is-reference | 3.0.3 | MIT |
| lightningcss | 1.33.0 | MPL-2.0 |
| lightningcss-android-arm64 | 1.33.0 | MPL-2.0 |
| lightningcss-darwin-arm64 | 1.33.0 | MPL-2.0 |
| lightningcss-darwin-x64 | 1.33.0 | MPL-2.0 |
| lightningcss-freebsd-x64 | 1.33.0 | MPL-2.0 |
| lightningcss-linux-arm-gnueabihf | 1.33.0 | MPL-2.0 |
| lightningcss-linux-arm64-gnu | 1.33.0 | MPL-2.0 |
| lightningcss-linux-arm64-musl | 1.33.0 | MPL-2.0 |
| lightningcss-linux-x64-gnu | 1.33.0 | MPL-2.0 |
| lightningcss-linux-x64-musl | 1.33.0 | MPL-2.0 |
| lightningcss-win32-arm64-msvc | 1.33.0 | MPL-2.0 |
| lightningcss-win32-x64-msvc | 1.33.0 | MPL-2.0 |
| locate-character | 3.0.0 | MIT |
| magic-string | 0.30.21 | MIT |
| magic-string | 1.4.5 | MIT |
| mri | 1.2.0 | MIT |
| nanoid | 3.3.20 | MIT |
| obug | 2.2.1 | MIT |
| picocolors | 1.1.1 | ISC |
| picomatch | 4.0.7 | MIT |
| postcss | 8.5.32 | MIT |
| prettier-plugin-svelte | 4.1.1 | MIT |
| prettier | 3.10.1 | MIT |
| readdirp | 4.1.2 | MIT |
| rolldown | 1.2.19 | MIT |
| sade | 1.8.1 | MIT |
| source-map-js | 1.2.2 | BSD-3-Clause |
| svelte-check | 4.7.8 | MIT |
| svelte | 5.57.3 | MIT |
| tinyglobby | 0.2.17 | MIT |
| tslib | 2.9.1 | 0BSD |
| typescript | 6.0.3 | Apache-2.0 |
| typescript | 7.0.2 | Apache-2.0 |
| vite | 8.3.8 | MIT |
| vitefu | 1.1.3 | MIT |
| zimmerframe | 1.1.5 | MIT |

## Lockfile entries without a locally installed license file

The following entries have no matching top-level license file in the local package installation used to assemble the text bundle. Most are optional binaries for platforms other than Windows. Their declared licenses remain listed above; their package distributions must accompany any redistribution that includes them.

- Rust: dasp_frame 0.11.0
- Rust: dasp_sample 0.11.0
- Rust: r-efi 5.3.0
- Rust: r-efi 6.0.0
- npm: @emnapi/core 2.0.0-beta.2
- npm: @emnapi/runtime 2.0.0-beta.2
- npm: @emnapi/wasi-threads 2.2.0
- npm: @napi-rs/wasm-runtime 1.2.6
- npm: @rolldown/binding-android-arm-eabi 1.2.19
- npm: @rolldown/binding-android-arm64 1.2.19
- npm: @rolldown/binding-darwin-arm64 1.2.19
- npm: @rolldown/binding-darwin-x64 1.2.19
- npm: @rolldown/binding-freebsd-x64 1.2.19
- npm: @rolldown/binding-linux-arm-gnueabihf 1.2.19
- npm: @rolldown/binding-linux-arm64-gnu 1.2.19
- npm: @rolldown/binding-linux-arm64-musl 1.2.19
- npm: @rolldown/binding-linux-ppc64-gnu 1.2.19
- npm: @rolldown/binding-linux-s390x-gnu 1.2.19
- npm: @rolldown/binding-linux-x64-gnu 1.2.19
- npm: @rolldown/binding-linux-x64-musl 1.2.19
- npm: @rolldown/binding-openharmony-arm64 1.2.19
- npm: @rolldown/binding-wasm32-wasi 1.2.19
- npm: @rolldown/binding-win32-arm64-msvc 1.2.19
- npm: @rolldown/binding-win32-x64-msvc 1.2.19
- npm: @tybys/wasm-util 0.10.4
- npm: @typescript/typescript-aix-ppc64 7.0.2
- npm: @typescript/typescript-darwin-arm64 7.0.2
- npm: @typescript/typescript-darwin-x64 7.0.2
- npm: @typescript/typescript-freebsd-arm64 7.0.2
- npm: @typescript/typescript-freebsd-x64 7.0.2
- npm: @typescript/typescript-linux-arm 7.0.2
- npm: @typescript/typescript-linux-arm64 7.0.2
- npm: @typescript/typescript-linux-loong64 7.0.2
- npm: @typescript/typescript-linux-mips64el 7.0.2
- npm: @typescript/typescript-linux-ppc64 7.0.2
- npm: @typescript/typescript-linux-riscv64 7.0.2
- npm: @typescript/typescript-linux-s390x 7.0.2
- npm: @typescript/typescript-linux-x64 7.0.2
- npm: @typescript/typescript-netbsd-arm64 7.0.2
- npm: @typescript/typescript-netbsd-x64 7.0.2
- npm: @typescript/typescript-openbsd-arm64 7.0.2
- npm: @typescript/typescript-openbsd-x64 7.0.2
- npm: @typescript/typescript-sunos-x64 7.0.2
- npm: @typescript/typescript-win32-arm64 7.0.2
- npm: fsevents 2.3.3
- npm: is-reference 3.0.3
- npm: lightningcss-android-arm64 1.33.0
- npm: lightningcss-darwin-arm64 1.33.0
- npm: lightningcss-darwin-x64 1.33.0
- npm: lightningcss-freebsd-x64 1.33.0
- npm: lightningcss-linux-arm-gnueabihf 1.33.0
- npm: lightningcss-linux-arm64-gnu 1.33.0
- npm: lightningcss-linux-arm64-musl 1.33.0
- npm: lightningcss-linux-x64-gnu 1.33.0
- npm: lightningcss-linux-x64-musl 1.33.0
- npm: lightningcss-win32-arm64-msvc 1.33.0
- npm: locate-character 3.0.0
- npm: tslib 2.9.1
