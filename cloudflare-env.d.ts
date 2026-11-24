declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ASSETS?: Fetcher;
    BLOG_AUTH_SECRET?: string;
    BLOG_BOOTSTRAP_USERNAME?: string;
    BLOG_BOOTSTRAP_SALT?: string;
    BLOG_BOOTSTRAP_HASH?: string;
  }
}
