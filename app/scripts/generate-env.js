// Generates src/lib/twitter-env.generated.ts from build-time environment variables.
// Vercel injects env vars at build time but not at serverless function runtime,
// so we capture them into a module that gets bundled into the server code.
const fs = require('fs');
const path = require('path');

const outFile = path.join(__dirname, '..', 'src', 'lib', 'twitter-env.generated.ts');

const clientId = process.env.TWITTER_CLIENT_ID || '';
const clientSecret = process.env.TWITTER_CLIENT_SECRET || '';

const content = `// Auto-generated at build time — do not edit manually
// Values captured from build-time environment variables
export const TWITTER_CLIENT_ID = ${JSON.stringify(clientId)};
export const TWITTER_CLIENT_SECRET = ${JSON.stringify(clientSecret)};
`;

fs.writeFileSync(outFile, content, 'utf8');

if (clientId && clientSecret) {
  console.log('Generated twitter-env.generated.ts with both env vars');
} else {
  console.warn('WARNING: Missing Twitter env vars at build time:', {
    TWITTER_CLIENT_ID: !!clientId,
    TWITTER_CLIENT_SECRET: !!clientSecret,
  });
}
