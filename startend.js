// Import necessary modules
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { nextMajorMinor } = require('./utils/version');

// Get the current date in MM/DD format
const currentDate = new Date();
const formattedDate = `${currentDate.getMonth() + 1}/${currentDate.getDate()}`;

// Get today's date as YYYYMMDD for the nightly version
const year = currentDate.getFullYear();
const month = String(currentDate.getMonth() + 1).padStart(2, '0');
const day = String(currentDate.getDate()).padStart(2, '0');
const dateStamp = `${year}${month}${day}`;

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

// Get the nightly version from the latest release tag on bph/gutenberg
// If an upstream RC exists for the current major.minor, bump the minor version
function getNightlyVersion() {
    const result = execSync('gh release list -L 1 -R bph/gutenberg', { encoding: 'utf8' }).trim();
    if (!result) {
        throw new Error('Could not get latest release from bph/gutenberg');
    }
    // Tag is in the third tab-separated column, e.g. "23.0-nightly"
    const tag = result.split('\t')[2];
    const match = tag.match(/(\d+)\.(\d+)/);
    if (!match) {
        throw new Error(`Could not parse version from release tag: ${tag}`);
    }
    let major = parseInt(match[1]);
    let minor = parseInt(match[2]);

    // Check if an upstream RC exists for this major.minor — if so, bump minor
    try {
        const rcCheck = execSync(
            `gh release list -R WordPress/gutenberg --limit 10 --json tagName --jq '.[].tagName'`,
            { encoding: 'utf8' }
        ).trim();
        const rcPattern = new RegExp(`^v${major}\\.${minor}\\.\\d+-rc`);
        if (rcCheck.split('\n').some(t => rcPattern.test(t))) {
            const next = nextMajorMinor(major, minor);
            console.log(`Upstream RC found for ${major}.${minor} — bumping nightly to ${next.major}.${next.minor}`);
            major = next.major;
            minor = next.minor;
        }
    } catch (err) {
        console.log('Warning: could not check upstream RCs, using current version');
    }

    return `${major}.${minor}.${dateStamp}`;
}

// Update the Version field in gutenberg.php
function updateVersionInFile(gutenbergDir, newVersion) {
    const filePath = path.join(gutenbergDir, 'gutenberg.php');
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/(\* Version:\s*)\S+/, `$1${newVersion}`);
    fs.writeFileSync(filePath, content, 'utf8');
}

// Main function to run the sequence of commands
function main() {
    const rootDir = process.cwd(); // Assuming this script is run from the root directory

    // Navigate to gutenberg directory and fetch upstream
    const gutenbergDir = path.resolve(rootDir, '../gutenberg');
    runCommand('git fetch upstream --no-tags', gutenbergDir);

    // Step 1: Determine nightly version from latest release tag, plus today's date
    const nightlyVersion = getNightlyVersion();
    console.log(`Nightly version: ${nightlyVersion}`);

    // Step 2: Update gutenberg.php with the nightly version and commit
    updateVersionInFile(gutenbergDir, nightlyVersion);
    execSync('git add gutenberg.php', { cwd: gutenbergDir });
    // Only commit if there's something staged — avoids failing when version is already current
    const staged = execSync('git diff --cached --name-only', { cwd: gutenbergDir, encoding: 'utf8' }).trim();
    if (staged) {
        execSync(`git commit -m 'version bump to ${nightlyVersion}' --no-verify`, { stdio: 'inherit', cwd: gutenbergDir });
        console.log(`Version updated to ${nightlyVersion}`);
    } else {
        console.log(`Version already at ${nightlyVersion} — skipping commit`);
    }

    // Step 3: Merge upstream/trunk
    // If the merge conflicts only in gutenberg.php (version bump), resolve by keeping ours
    const mergeMessage = `prep build ${formattedDate}`;
    try {
        execSync(`git merge upstream/trunk -m '${mergeMessage}' --no-verify`, { stdio: 'inherit', cwd: gutenbergDir });
    } catch (mergeError) {
        console.log('Merge conflict detected — checking if it is only in gutenberg.php...');
        const conflicted = execSync('git diff --name-only --diff-filter=U', { cwd: gutenbergDir }).toString().trim();
        if (conflicted === 'gutenberg.php') {
            console.log('Resolving gutenberg.php conflict by keeping nightly version...');
            execSync('git checkout --ours gutenberg.php', { stdio: 'inherit', cwd: gutenbergDir });
            execSync('git add gutenberg.php', { stdio: 'inherit', cwd: gutenbergDir });
            execSync(`git commit --no-verify -m '${mergeMessage}'`, { stdio: 'inherit', cwd: gutenbergDir });
            console.log('Merge conflict resolved automatically.');
        } else {
            console.error(`Merge conflict in unexpected files: ${conflicted}`);
            console.error('Please resolve manually and re-run.');
            process.exit(1);
        }
    }

    // Build the plugin zip with NO_CHECKS=true
    runCommand('NO_CHECKS=true npm run build:plugin-zip', gutenbergDir);

    // Navigate to distribute-nightly directory and run dist now
    const distributeNightlyDir = path.resolve(rootDir, '../distribute-nightly');
    runCommand('dist now --no-clear', distributeNightlyDir);

    // Update the Gutenberg Nightly page via WP REST API
    runCommand('dist update-page --no-clear', distributeNightlyDir);
}

// Execute the main function
main();