#!/usr/bin/env node
import chalk from 'chalk';
import run from './cli/main';

// Entry point: execute run() and handle top-level errors
run().catch((error: any) => {
  console.error(chalk.red(`\n❌ Error: ${error.message}`));
  process.exit(1);
});
