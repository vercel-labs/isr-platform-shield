import { writeFile } from "fs/promises";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const test = (predicate: boolean, message: string) => {
  if (!predicate) {
    throw new Error(message);
  }
}

async function validateHomepage() {
  const url = "https://www.pzona.lol";
  const response = await fetch(url);
  const html = await response.text();

  test(html.includes("$validator_home_page$"), "HOME PAGE");
}

async function validateSubdomainPage() {
  const url = "https://cool.pzona.lol";
  const response = await fetch(url);
  const html = await response.text();

  test(html.includes("cool 😎"), "SUBDOMAIN PAGE");
}

async function validatePostPage() {
  const url = "https://cool.pzona.lol/1";
  const response = await fetch(url);
  const html = await response.text();

  test(html.includes("$validator_post_page$"), "POST PAGE");
}

async function main() {
  try {
    const logFile = join(__dirname, `../../logs/${new Date().valueOf()}.log`);
    await writeFile(logFile, "");

    await validateHomepage();
    await validateSubdomainPage();
    await validatePostPage();

    console.log("Validation complete");
  } catch (error) {
    console.error("⛔ Failed:", error.message);
  }
}

main();