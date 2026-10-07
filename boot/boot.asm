; Stage 1: BIOS boot sector. Loads the rest of the image (entry + kernel)
; to 0x8000 via INT 13h LBA and jumps there.
; SECTORS is passed from the Makefile (-DSECTORS=n).
[bits 16]
[org 0x7c00]

start:
    cli
    xor ax, ax
    mov ds, ax
    mov es, ax
    mov ss, ax
    mov sp, 0x7c00
    sti
    mov [boot_drive], dl

    mov si, dap
    mov ah, 0x42
    mov dl, [boot_drive]
    int 0x13
    jc disk_error

    jmp 0x0000:0x8000

disk_error:
    mov si, msg_err
.print:
    lodsb
    test al, al
    jz .halt
    mov ah, 0x0e
    int 0x10
    jmp .print
.halt:
    hlt
    jmp .halt

msg_err   db "Disk read error", 0
boot_drive db 0

align 4
dap:
    db 0x10, 0          ; size, reserved
    dw SECTORS          ; sectors to read
    dw 0x8000, 0x0000   ; offset, segment
    dq 1                ; starting LBA (sector after the boot sector)

times 510 - ($ - $$) db 0
dw 0xaa55
