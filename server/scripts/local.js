// Локальный режим для разработки на своём компьютере: без Postgres и Docker, база — файл prisma/dev.db (SQLite).
// Боевая схема остаётся на Postgres (prisma/schema.prisma); здесь из неё на лету делается копия
// с провайдером sqlite. Использование: node scripts/local.js <команда...>
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8");
if (!source.includes('provider = "postgresql"')) {
  console.error("В prisma/schema.prisma не найден provider = \"postgresql\"");
  process.exit(1);
}
fs.writeFileSync(path.join(root, "prisma", "schema.local.prisma"), source.replace('provider = "postgresql"', 'provider = "sqlite"'));

// Путь относительно папки схемы: prisma/dev.db
process.env.DATABASE_URL = "file:./dev.db";

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: true, env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("Готовим локальную базу (SQLite)...");
run("npx", ["prisma", "generate", "--schema", "prisma/schema.local.prisma"]);
run("npx", ["prisma", "db", "push", "--schema", "prisma/schema.local.prisma", "--skip-generate"]);

const [command, ...args] = process.argv.slice(2);
if (command) run("npx", [command, ...args]);
