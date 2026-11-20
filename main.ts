// Vice Heat — Cover Studio, handed in as a make.fun entry (Node 22, stdlib only).
//
// The app itself lives in app/ as plain static files a desktop browser opens
// offline. This program copies app/ and screenshots/ beside this file into the
// output directory and writes output/dossier.json with the kit's vendored
// library, so the grader can check the hand-in byte for byte. Outside the
// grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

mkdirSync(out, { recursive: true });
cpSync(join(here, "app"), join(out, "app"), { recursive: true });
mkdirSync(join(out, "screenshots"), { recursive: true });
if (existsSync(join(here, "screenshots"))) {
  cpSync(join(here, "screenshots"), join(out, "screenshots"), { recursive: true });
}

// The caps below are the gate's own: more than 4 screenshots or one over
// 256 KiB, more than 993 files or 48 MiB under app/, or a path over 1000
// bytes fails the hand-in, so the program refuses it here first.
writeFileSync(
  join(out, "dossier.json"),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
