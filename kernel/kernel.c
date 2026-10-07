typedef unsigned char  u8;
typedef unsigned short u16;

#define VGA ((volatile u16 *)0xB8000)
#define COLS 80
#define ROWS 25

static int cursor;

static inline void outb(u16 port, u8 val) {
    __asm__ volatile("outb %0, %1" : : "a"(val), "Nd"(port));
}

static void serial_putc(char c) {
    outb(0x3F8, (u8)c);
}

static void clear(u8 attr) {
    for (int i = 0; i < COLS * ROWS; i++)
        VGA[i] = ((u16)attr << 8) | ' ';
    cursor = 0;
}

static void putc(char c, u8 attr) {
    serial_putc(c);
    if (c == '\n') {
        cursor += COLS - cursor % COLS;
    } else {
        VGA[cursor++] = ((u16)attr << 8) | (u8)c;
    }
}

static void puts(const char *s, u8 attr) {
    while (*s)
        putc(*s++, attr);
}

void kmain(void) {
    clear(0x07);
    puts("Hello from my OS!\n", 0x0A);
    puts("x86_64 long mode, kernel written in C.\n", 0x07);
    for (;;)
        __asm__ volatile("hlt");
}
