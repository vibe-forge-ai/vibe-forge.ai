import type { SchemaModule } from '../schema'

export const channelActionTokensSchemaModule: SchemaModule = {
  name: 'channel-action-tokens',
  apply({ exec }) {
    exec(`
      CREATE TABLE IF NOT EXISTS channel_action_tokens (
        nonce TEXT NOT NULL PRIMARY KEY,
        action TEXT NOT NULL,
        expiresAt INTEGER NOT NULL,
        consumedAt INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_channel_action_tokens_expiresAt
        ON channel_action_tokens(expiresAt);
    `)
  }
}
