import { FacebookClient } from "./facebook-client.js";
import { InstagramClient } from "./instagram-client.js";
import { TwitterClient } from "./twitter-client.js";
import { TikTokClient } from "./tiktok-client.js";

const CLIENT_MAP = {
  facebook: FacebookClient,
  instagram: InstagramClient,
  twitter: TwitterClient,
  tiktok: TikTokClient,
};

/**
 * Returns an initialized social client for a given account record
 * (must include account.platform.platformCode).
 */
export function getSocialClient(account) {
  const code = account.platform?.platformCode;
  const ClientClass = CLIENT_MAP[code];
  if (!ClientClass) {
    throw new Error(`No social client for platform: ${code}`);
  }
  return new ClientClass(account);
}

export { FacebookClient, InstagramClient, TwitterClient, TikTokClient };
