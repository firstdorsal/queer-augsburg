use std::alloc::{GlobalAlloc, Layout, System};

/// Far above any legitimate allocation of this server, whose largest are the states of
/// `MAX_STATE_BYTES` and frames of `MAX_SOCKET_MESSAGE_BYTES`.
const MAX_ALLOCATION_BYTES: usize = 256 * 1024 * 1024;

fn too_big(size: usize) -> bool {
    size > MAX_ALLOCATION_BYTES
}

/// Global, installed in main.rs: refuses single allocations above a cap. An update of 8 bytes
/// can declare billions of entries: the yrs decoders reserve that much with `try_reserve`, and
/// the whole process dies. A refused allocation makes `try_reserve` return an error, which
/// closes that one connection instead. Infallible allocations above the cap abort, so this
/// relies on the yrs decoders using `try_reserve`; tests/document_rooms.rs would notice a change.
pub struct CappedAllocator;

// Forwards to `System`, except that it may return null, which the contract allows.
unsafe impl GlobalAlloc for CappedAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        if too_big(layout.size()) {
            return std::ptr::null_mut();
        }
        unsafe { System.alloc(layout) }
    }

    unsafe fn dealloc(&self, pointer: *mut u8, layout: Layout) {
        unsafe { System.dealloc(pointer, layout) }
    }

    unsafe fn alloc_zeroed(&self, layout: Layout) -> *mut u8 {
        if too_big(layout.size()) {
            return std::ptr::null_mut();
        }
        unsafe { System.alloc_zeroed(layout) }
    }

    unsafe fn realloc(&self, pointer: *mut u8, layout: Layout, new_size: usize) -> *mut u8 {
        if too_big(new_size) {
            return std::ptr::null_mut();
        }
        unsafe { System.realloc(pointer, layout, new_size) }
    }
}
