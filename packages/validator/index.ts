import { appendFile, writeFile } from "fs/promises";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const test = (predicate: boolean, message: string) => {
  if (!predicate) {
    throw message;
  }
}

async function validateHomepage(logFile: string) {
  const url = "https://www.pzona.lol";
  await appendFile(logFile, `VALIDATING HOMEPAGE: ${url}\n`);
  const response = await fetch(url);

  // Log headers before consuming the body
  await appendFile(logFile, `HOME PAGE HEADERS: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}\n`);

  const html = await response.text();
  await appendFile(logFile, `HOME PAGE BODY: ${html}\n`);

  test(html.includes("$validator_home_page$"), "HOME PAGE");
}

async function validateSubdomainPage(logFile: string) {
  const url = "https://cool.pzona.lol";
  await appendFile(logFile, `VALIDATING SUBDOMAIN PAGE: ${url}\n`);
  const response = await fetch(url);

  // Log headers before consuming the body
  await appendFile(logFile, `SUBDOMAIN PAGE HEADERS: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}\n`);

  const html = await response.text();
  await appendFile(logFile, `SUBDOMAIN PAGE BODY: ${html}\n`);

  test(html.includes("cool 😎"), "SUBDOMAIN PAGE");
}

async function validatePostPage(logFile: string) {
  const url = "https://cool.pzona.lol/1";
  await appendFile(logFile, `VALIDATING POST PAGE: ${url}\n`);
  const response = await fetch(url);

  // Log headers before consuming the body
  await appendFile(logFile, `POST PAGE HEADERS: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}\n`);

  const html = await response.text();
  await appendFile(logFile, `POST PAGE BODY: ${html}\n`);

  test(html.includes("$validator_post_page$"), "POST PAGE");
}

async function main() {
  const logFile = join(__dirname, `../../log/${new Date().valueOf()}.log`);
  await writeFile(logFile, "");

  let allPassed = true;

  try {
    await validateHomepage(logFile);
    console.log("✅ Homepage validation passed");
  } catch (message) {
    console.error("❌ Homepage validation failed:", message);
    allPassed = false;
  }

  try {
    await validateSubdomainPage(logFile);
    console.log("✅ Subdomain page validation passed");
  } catch (message) {
    console.error("❌ Subdomain page validation failed:", message);
    allPassed = false;
  }

  try {
    await validatePostPage(logFile);
    console.log("✅ Post page validation passed");
  } catch (message) {
    console.error("❌ Post page validation failed:", message);
    allPassed = false;
  }

  if (allPassed) {
    console.log("🎉 All validations passed:", logFile);
  } else {
    console.log("⚠️  Some validations failed, check log:", logFile);
  }
}

main();