#!/usr/bin/env node

require('../build/cli')
  .run(process.argv)
  .catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(message + '\n');
    process.exit(1);
  });
