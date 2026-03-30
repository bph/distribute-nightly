# Gutenberg Nightly on Unraid: Setup Guide

This guide walks through setting up a persistent Node.js environment on an Unraid home server to run the Gutenberg Nightly distribution script (`startend.js`) on a daily schedule.

## Overview

- **Docker** provides a persistent Node.js container you can shell into anytime
- **User Scripts** plugin schedules the daily Gutenberg Nightly build
- **Lucky Backup** handles backing up the important files

---

## Step 1: Enable Docker

1. In the Unraid web UI, go to **Settings → Docker**
2. Set **Enable Docker** to **Yes**
3. Click **Apply**
4. A **Docker** tab should now appear in the top navigation

---

## Step 2: Install Community Applications Plugin

This gives you access to User Scripts and other useful plugins.

1. Go to **Plugins → Install Plugin**
2. Paste this URL:
   ```
   https://raw.githubusercontent.com/Squidly271/community.applications/master/plugins/community.applications.plg
   ```
3. Click **Install**
4. An **Apps** tab should now appear in the top navigation

---

## Step 3: Install User Scripts Plugin

1. Go to the **Apps** tab
2. Search for **User Scripts**
3. Click **Install**
4. It will appear under **Settings → User Scripts**

---

## Step 4: Set Up Project Files

Open the Unraid terminal (click the `>_` icon in the bottom-right of the Unraid UI) and run these commands:

```bash
# Create the project directory
mkdir -p /mnt/user/appdata/gb-nightly

# Clone both repos
cd /mnt/user/appdata/gb-nightly
git clone https://github.com/bph/distribute-nightly.git
git clone https://github.com/WordPress/gutenberg.git

# Add the upstream remote to the gutenberg repo
cd gutenberg
git remote add upstream https://github.com/WordPress/gutenberg.git
cd ..
```

---

## Step 5: Copy the `.env` File to the Server

On your **Mac** (not the Unraid terminal), open Terminal and run:

```bash
scp /Users/pauli/gb-nightly/distribute-nightly/.env root@<your-unraid-ip>:/mnt/user/appdata/gb-nightly/distribute-nightly/.env
```

Replace `<your-unraid-ip>` with your Unraid server's IP address (e.g., `192.168.1.100`). It will ask for your Unraid root password.

> **Tip:** Also store these credentials in a password manager as a second copy.

---

## Step 6: Build the Custom Docker Image

This image includes Node.js, Git, PHP, and the `dist` CLI pre-installed.

In the Unraid terminal, create the Dockerfile:

```bash
cat > /mnt/user/appdata/gb-nightly/Dockerfile << 'EOF'
FROM node:20-bookworm

# Install git, PHP (needed for Gutenberg build), and other tools
RUN apt-get update && \
    apt-get install -y git composer php-cli && \
    rm -rf /var/lib/apt/lists/*

# Install distribute-nightly CLI globally
WORKDIR /app/gb-nightly/distribute-nightly
COPY distribute-nightly/package*.json ./
RUN npm install
RUN npm link

WORKDIR /app
EOF
```

Build the image:

```bash
cd /mnt/user/appdata/gb-nightly
docker build -t gb-nightly .
```

This takes a few minutes. Wait until you see `Successfully tagged gb-nightly:latest`.

---

## Step 7: Create the Docker Container in Unraid UI

1. Go to the **Docker** tab
2. Click **Add Container**
3. Toggle **Advanced View** in the top-right
4. Fill in:
   - **Name:** `nodejs`
   - **Repository:** `gb-nightly`
   - **Extra Parameters:** `--restart=unless-stopped`
   - **Post Arguments:** `tail -f /dev/null`
5. Add path mappings — click **Add another Path, Port, Variable, Label, or Device** for each:

   **First path (Gutenberg Nightly project):**
   - Config Type: Path
   - Name: `gb-nightly`
   - Container Path: `/app/gb-nightly`
   - Host Path: `/mnt/user/appdata/gb-nightly`

   **Second path (general Node.js projects):**
   - Config Type: Path
   - Name: `projects`
   - Container Path: `/app/projects`
   - Host Path: `/mnt/user/appdata/projects`

6. Click **Apply**

The container should now appear in the Docker tab with a green play icon (running).

---

## Step 8: Test Everything

In the Unraid terminal:

```bash
# Open a shell inside the container
docker exec -it nodejs bash

# Verify tools are available
node --version
git --version
dist --version

# Test the Gutenberg Nightly script
cd /app/gb-nightly/distribute-nightly
node startend.js
```

If `startend.js` runs successfully, everything is working. Type `exit` to leave the container shell.

---

## Step 9: Schedule the Daily Build with User Scripts

1. Go to **Settings → User Scripts**
2. Click **Add New Script**
3. Name it: `gutenberg-nightly`
4. Click the **gear icon** next to the script → **Edit Script**
5. Replace the contents with:
   ```bash
   #!/bin/bash
   docker exec nodejs node /app/gb-nightly/distribute-nightly/startend.js
   ```
6. Click **Save Changes**
7. Set the schedule dropdown to **Custom**
8. Enter: `0 6 * * *` (runs daily at 6:00 AM)
9. Click **Apply**

---

## Step 10: Configure Lucky Backup

Add a backup task for the distribute-nightly project files.

**Source path:**
```
/mnt/user/appdata/gb-nightly/distribute-nightly/
```

**Exclude these** (large, easily recreated):
```
node_modules
```

You do **not** need to back up:
- `gutenberg/` — cloned from GitHub, re-clone if needed
- The Docker image — rebuilt with `docker build`
- The container itself — recreated from the image and template

The **critical file** is `.env` (your credentials). Make sure it is included in the backup.

---

## Using the Node.js Container for Other Projects

The container is a general-purpose Node.js environment. Use it anytime:

```bash
# Drop into the container shell
docker exec -it nodejs bash

# Your projects are at /app/projects/
cd /app/projects
```

Put any Node.js project files in `/mnt/user/appdata/projects/` on the Unraid share and they'll be available inside the container at `/app/projects/`.

---

## Maintenance

### Updating distribute-nightly

```bash
docker exec nodejs bash -c "cd /app/gb-nightly/distribute-nightly && git pull"
```

### Updating the Docker image

If dependencies change (new packages in `package.json`), rebuild:

```bash
cd /mnt/user/appdata/gb-nightly
docker build -t gb-nightly .
```

Then in the Unraid UI, remove and re-add the `nodejs` container with the same settings. Your files are untouched since they live on the Unraid share, not inside the container.

### Rebuilding after Unraid OS update

Docker containers and images survive Unraid updates. No action needed unless you're doing a major Unraid reinstall, in which case follow the recovery steps below.

---

## Recovery (if the server dies)

1. Set up Unraid on new hardware
2. Restore flash backup (gets plugins and Docker templates back)
3. Restore appdata from Lucky Backup (gets `.env` and project files back)
4. Rebuild the Docker image: `cd /mnt/user/appdata/gb-nightly && docker build -t gb-nightly .`
5. Start the container from the Docker tab — everything works

---

## Quick Reference

| What                          | Where in Unraid UI                        |
|-------------------------------|-------------------------------------------|
| Node.js container             | Docker tab → `nodejs`                     |
| Daily build schedule          | Settings → User Scripts → `gutenberg-nightly` |
| Project files                 | `/mnt/user/appdata/gb-nightly/`           |
| Future Node.js projects       | `/mnt/user/appdata/projects/`             |
| Shell into container          | `docker exec -it nodejs bash`             |
| Backup config                 | Lucky Backup                              |
