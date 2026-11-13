declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ACCESS_PASSWORD: string;
    SESSION_SECRET: string;
    UPDATE_TOKEN: string;
  }
}
