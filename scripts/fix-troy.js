/**
 * Fix Troy University ESPN ID and download their logo.
 *
 * Current state: espn_id = 3237 (wrong), logo_url = null
 * Correct:       espn_id = 2653 (Troy Trojans)
 */

const { Pool } = require("pg");
const https = require("https");
const fs = require("fs");
const path = require("path");

const DATABASE_URL =
  "postgresql://postgres.ufmzldfkdpjeyvjfpoid:MScp1BrdQZF8QBHp@aws-0-us-west-2.pooler.supabase.com:5432/postgres";

const PROGRAM_ID = "a70dd99e-b5a4-44b8-a96e-5665d009274e";
const CORRECT_ESPN_ID = 2653;
const LOGO_DIR = path.join(__dirname, "..", "app", "public", "logos");
const LOGO_FILENAME = `${PROGRAM_ID}.png`;
const LOGO_PATH = path.join(LOGO_DIR, LOGO_FILENAME);
const LOGO_URL_DB = `/logos/${LOGO_FILENAME}`;
const ESPN_LOGO_URL = `https://a.espncdn.com/i/teamlogos/ncaa/500/${CORRECT_ESPN_ID}.png`;

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          fs.unlinkSync(dest);
          return downloadFile(res.headers.location, dest).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
      })
      .on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // 1. Show current state
    const before = await pool.query(
      "SELECT id, school_name, espn_id, logo_url FROM programs WHERE id = $1",
      [PROGRAM_ID]
    );
    console.log("BEFORE:", before.rows[0]);

    // 2. Download logo
    console.log(`Downloading logo from ${ESPN_LOGO_URL} ...`);
    await downloadFile(ESPN_LOGO_URL, LOGO_PATH);
    const stat = fs.statSync(LOGO_PATH);
    console.log(`Saved ${LOGO_PATH} (${stat.size} bytes)`);

    // 3. Update DB
    await pool.query(
      "UPDATE programs SET espn_id = $1, logo_url = $2 WHERE id = $3",
      [CORRECT_ESPN_ID, LOGO_URL_DB, PROGRAM_ID]
    );
    console.log("DB updated.");

    // 4. Verify
    const after = await pool.query(
      "SELECT id, school_name, espn_id, logo_url FROM programs WHERE id = $1",
      [PROGRAM_ID]
    );
    console.log("AFTER: ", after.rows[0]);
  } catch (err) {
    console.error("ERROR:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
