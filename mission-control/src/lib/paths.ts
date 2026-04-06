import os from "os";
import path from "path";

/**
 * Root directory for all Mission Control runtime data.
 * Defaults to ~/.cmc — override with CMC_DATA_DIR env var.
 */
export const DATA_DIR: string = process.env.CMC_DATA_DIR
  ? path.resolve(process.env.CMC_DATA_DIR)
  : path.join(os.homedir(), ".cmc");

/** Directory where uploaded attachments are stored (outside the repo). */
export const UPLOADS_DIR: string = path.join(DATA_DIR, "uploads");
