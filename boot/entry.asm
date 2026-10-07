; Stage 2: 16-bit real mode -> 32-bit protected mode -> 64-bit long mode,
; then calls kmain(). Linked first at 0x8000.
[bits 16]
section .entry
global _start
extern kmain

PML4 equ 0x1000
PDPT equ 0x2000
PD   equ 0x3000

_start:
    cli
    ; enable A20 (fast gate)
    in al, 0x92
    or al, 2
    out 0x92, al

    ; build identity map of the first 1 GiB using 2 MiB pages
    xor ax, ax
    mov es, ax
    mov di, PML4
    mov cx, 0x3000 / 2
    rep stosw
    mov dword [PML4], PDPT | 3
    mov dword [PDPT], PD | 3
    mov di, PD
    mov eax, 0x83            ; present | writable | huge
    mov cx, 512
.map:
    mov [di], eax
    add eax, 0x200000
    add di, 8
    loop .map

    lgdt [gdt_ptr]
    mov eax, cr0
    or eax, 1
    mov cr0, eax
    jmp 0x08:pm32

[bits 32]
pm32:
    mov ax, 0x10
    mov ds, ax
    mov es, ax
    mov ss, ax

    mov eax, cr4
    or eax, 1 << 5           ; PAE
    mov cr4, eax
    mov eax, PML4
    mov cr3, eax
    mov ecx, 0xC0000080      ; EFER
    rdmsr
    or eax, 1 << 8           ; LME
    wrmsr
    mov eax, cr0
    or eax, 1 << 31          ; paging
    mov cr0, eax
    jmp 0x18:lm64

[bits 64]
lm64:
    mov ax, 0x20
    mov ds, ax
    mov es, ax
    mov ss, ax
    mov fs, ax
    mov gs, ax
    mov rsp, 0x90000
    call kmain
.halt:
    cli
    hlt
    jmp .halt

align 8
gdt:
    dq 0                     ; null
    dq 0x00cf9a000000ffff    ; 0x08 32-bit code
    dq 0x00cf92000000ffff    ; 0x10 32-bit data
    dq 0x00af9a000000ffff    ; 0x18 64-bit code
    dq 0x00af92000000ffff    ; 0x20 64-bit data
gdt_end:
gdt_ptr:
    dw gdt_end - gdt - 1
    dd gdt
