//! 管用GL桌面端入口

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    guanyong_gl_lib::run()
}
