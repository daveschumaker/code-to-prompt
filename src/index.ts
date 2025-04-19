#!/usr/bin/env node

// src/index.ts

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

console.log('My CLI Tool is running!');

// Wrap the main logic in an async IIFE to use await
(async () => {
  try {
    // Use yargs to parse command line arguments and await the result
    const argv = await yargs(hideBin(process.argv))
      .command(
        'hello <name>',
        'Prints a greeting',
        (yargs) => {
          // Command configuration
          return yargs
            .positional('name', {
              describe: 'Name to greet',
              type: 'string',
              demandOption: true, // Make the name argument required
            })
            .option('loud', {
              alias: 'l',
              type: 'boolean',
              default: false,
              description: 'Print the greeting loudly',
            });
        },
        (argv) => {
          // Handler for the 'hello' command
          // This handler might become async later if needed
          let greeting = `Hello, ${argv.name}!`;
          if (argv.loud) {
            greeting = greeting.toUpperCase();
          }
          console.log(greeting);
        },
      )
      .option('verbose', {
        alias: 'v',
        type: 'boolean',
        default: false, // Provide a default value
        description: 'Run with verbose logging',
      })
      .demandCommand(1, 'You need at least one command before moving on') // Require at least one command
      .help() // Enable --help option
      .alias('help', 'h')
      .version() // Enable --version option
      .alias('version', 'V')
      .strict() // Report errors for unknown options/commands
      .parseAsync(); // Use parseAsync() when using await

    // --- Logic after parsing ---
    // Now 'argv' is guaranteed to be the resolved arguments object, not a Promise

    // Example of using a general option (like --verbose)
    if (argv.verbose) {
      console.info('Verbose mode enabled.');
      // console.log('Full arguments received:', argv); // Uncomment for debugging
    }

    // You can add more commands or logic here
    // Example: Check if a command was actually run
    // yargs puts command names and positional args into the '_' array
    // Note: The 'hello' command handler already executed above if 'hello' was the command.
    // This check might be more useful if you have logic outside specific command handlers.
    if (argv._.length === 0) {
      // This might not be reached if demandCommand(1) is active,
      // but can be useful depending on your structure.
      // console.log('No command specified. Use --help to see available commands.');
    }
  } catch (error) {
    // Check if the caught object is an instance of Error
    if (error instanceof Error) {
      // Now TypeScript knows error has a .message property
      console.error('\n❌ Error:', error.message);
      // Optionally, log the stack trace for more details, especially during development
      // console.error(error.stack);
    } else {
      // Handle cases where something other than an Error object was thrown
      // (e.g., throw "some string"; or throw 123;)
      console.error('\n❌ An unexpected error occurred:', error);
    }
    process.exit(1); // Exit with a non-zero code to indicate failure
  }
})(); // Immediately invoke the async function
