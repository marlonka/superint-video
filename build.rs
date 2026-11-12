// Built-in presets, the scene runtime and the Studio bundle are compiled in with
// `include_dir!`, which Cargo does not track: rebuild whenever one of them changes, so `new`
// never copies a stale STYLE.md or kit and `studio` never serves an old bundle.
fn main() {
    println!("cargo:rerun-if-changed=presets");
    println!("cargo:rerun-if-changed=runtime");
    println!("cargo:rerun-if-changed=studio/dist");
    println!("cargo:rerun-if-changed=packaging/app.ico");
    // The icon and the name Windows shows for the executables. A machine without the Windows
    // SDK's resource compiler still builds; its executables just have the plain icon.
    #[cfg(windows)]
    {
        let mut resource = winresource::WindowsResource::new();
        resource.set_icon("packaging/app.ico");
        resource.set("ProductName", "Superint Video");
        resource.set("FileDescription", "Superint Video");
        if let Err(error) = resource.compile() {
            println!("cargo:warning=No icon in the executables: {error}");
        }
    }
}
