# first-project — my own OS

Минимальная x86_64 ОС: BIOS-загрузчик (NASM) → long mode → ядро на C.

## Структура
- `boot/boot.asm` — загрузочный сектор, читает остальной образ в 0x8000
- `boot/entry.asm` — real mode → protected → long mode, вызов `kmain`
- `kernel/` — ядро на C (VGA text + COM1) и linker script

## Сборка и запуск
Нужны: `nasm`, `gcc`, `ld`, `make`, `qemu-system-x86_64`.

    make            # build/os.img
    make run        # окно QEMU
    make run-serial # без окна, вывод в терминал
