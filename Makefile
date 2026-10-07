CC      := gcc
LD      := ld
CFLAGS  := -ffreestanding -fno-pic -fno-pie -fno-stack-protector -mno-red-zone \
           -mno-sse -mno-mmx -O2 -Wall -Wextra -m64
BUILD   := build

all: $(BUILD)/os.img

$(BUILD)/entry.o: boot/entry.asm
	@mkdir -p $(BUILD)
	nasm -f elf64 $< -o $@

$(BUILD)/kernel.o: kernel/kernel.c
	@mkdir -p $(BUILD)
	$(CC) $(CFLAGS) -c $< -o $@

$(BUILD)/kernel.bin: $(BUILD)/entry.o $(BUILD)/kernel.o kernel/linker.ld
	$(LD) -n -nostdlib -T kernel/linker.ld $(BUILD)/entry.o $(BUILD)/kernel.o -o $(BUILD)/kernel.elf
	objcopy -O binary $(BUILD)/kernel.elf $@

$(BUILD)/os.img: boot/boot.asm $(BUILD)/kernel.bin
	nasm -f bin -DSECTORS=$$(( ($$(stat -c%s $(BUILD)/kernel.bin) + 511) / 512 )) $< -o $(BUILD)/boot.bin
	cat $(BUILD)/boot.bin $(BUILD)/kernel.bin > $@
	truncate -s %512 $@

run: $(BUILD)/os.img
	qemu-system-x86_64 -drive format=raw,file=$< 

run-serial: $(BUILD)/os.img
	qemu-system-x86_64 -drive format=raw,file=$< -display none -serial stdio

clean:
	rm -rf $(BUILD)

.PHONY: all run run-serial clean
