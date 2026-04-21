import kleur from "kleur";

export function printCreated(slug: string, targetDir: string, withUi: boolean): void {
  console.log("");
  console.log(kleur.green("✓") + " " + kleur.bold(`Created ${slug}`) + kleur.dim(` at ${targetDir}`));
  console.log("");
  console.log(kleur.bold("Next steps:"));
  console.log("");
  console.log("  " + kleur.cyan(`cd ${slug}`));
  console.log("  " + kleur.cyan("just dev-install") + kleur.dim("     # build + copy into Tabularis plugins dir"));
  if (withUi) {
    console.log("  " + kleur.cyan("pnpm -C ui install && pnpm -C ui build") + kleur.dim("  # build the UI extension"));
  }
  console.log("");
  console.log(kleur.dim("Then open Tabularis and look for your driver in the connection picker."));
  console.log(kleur.dim("Full plugin guide: https://github.com/TabularisDB/tabularis/blob/main/plugins/PLUGIN_GUIDE.md"));
  console.log("");
}

export function printError(message: string): void {
  console.error(kleur.red("✗ ") + message);
}

export function printHelp(): void {
  console.log(`
${kleur.bold("@tabularis/create-plugin")} — scaffold a new Tabularis driver plugin

${kleur.bold("Usage:")}
  npm create @tabularis/plugin@latest [--] [options] <name>
  npx @tabularis/create-plugin [options] <name>

${kleur.bold("Arguments:")}
  <name>                 Plugin name (slugified to lowercase with hyphens)

${kleur.bold("Options:")}
  --db-type <kind>       network | file | folder | api   (default: network)
  --quote <char>         "  |  \`                         (default: ")
  --with-ui              Also scaffold a ui/ subworkspace using @tabularis/plugin-api
  --no-git               Skip \`git init\` on the new project
  --dir <path>           Target directory               (default: ./<name>)
  -v, --version          Print version
  -h, --help             Print this help

${kleur.bold("Examples:")}
  npm create @tabularis/plugin@latest my-driver
  npm create @tabularis/plugin@latest sqlite-like -- --db-type=file
  npx @tabularis/create-plugin hackernews --db-type=api --with-ui
`);
}
