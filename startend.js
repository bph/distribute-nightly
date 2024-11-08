// Import necessary modules
const { execSync } = require('child_process');
const path = require('path');

// Get the current date in MM/DD format
const currentDate = new Date();
const formattedDate = `${currentDate.getMonth() + 1}/${currentDate.getDate()}`;

// Define a function to execute a command
function runCommand(command, cwd = process.cwd()) {
    try {
        console.log(`Running command: ${command} in directory: ${cwd}`);
        execSync(command, { stdio: 'inherit', cwd });
    } catch (error) {
        console.error(`Error executing command: ${command}`);
        console.error(error.message);
        process.exit(1); // Exit the process with an error code
    }
}

// Main function to run the sequence of commands
function main() {
    const rootDir = process.cwd(); // Assuming this script is run from the root directory

    // Navigate to gutenberg directory and fetch upstream
    const gutenbergDir = path.resolve(rootDir, '../gutenberg');
    runCommand('git fetch upstream', gutenbergDir);

    // Merge upstream/trunk with a dynamic date message
    const mergeMessage = `prep build ${formattedDate}`;
    runCommand(`git merge upstream/trunk -m '${mergeMessage}' --no-verify`, gutenbergDir);

    // Build the plugin zip with NO_CHECKS=true
    runCommand('NO_CHECKS=true npm run build:plugin-zip', gutenbergDir);

    // Navigate to distribute-nightly directory and run dist now
    const distributeNightlyDir = path.resolve(rootDir, '../distribute-nightly');
    runCommand('dist now', distributeNightlyDir);
}

// Execute the main function
main();