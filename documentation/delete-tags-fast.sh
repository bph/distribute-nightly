#!/bin/bash

# Fast script to bulk delete git tags matching a pattern
# Usage: ./delete-tags-fast.sh [pattern] [--dry-run] [--remote]
#
# This version uses a single git push command with multiple tag deletions
# which is MUCH faster than the original script (minutes vs hours)
#
# Examples:
#   ./delete-tags-fast.sh "@wordpress/" --dry-run     # Preview tags to delete
#   ./delete-tags-fast.sh "@wordpress/reusable-blocks" --dry-run  # Preview specific package
#   ./delete-tags-fast.sh "@wordpress/" --remote      # Delete locally and push deletions
#   ./delete-tags-fast.sh "@wordpress/"               # Delete only locally

set -e

PATTERN="${1:-@wordpress/}"
DRY_RUN=false
DELETE_REMOTE=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        --dry-run)
            DRY_RUN=true
            ;;
        --remote)
            DELETE_REMOTE=true
            ;;
    esac
done

echo "======================================"
echo "Fast Tag Deletion Script"
echo "======================================"
echo "Pattern: $PATTERN"
echo "Dry run: $DRY_RUN"
echo "Delete from remote: $DELETE_REMOTE"
echo "======================================"
echo ""

# Find matching tags
MATCHING_TAGS=$(git tag | grep "$PATTERN" || true)
TAG_COUNT=$(echo "$MATCHING_TAGS" | grep -c . || echo "0")

if [ "$TAG_COUNT" -eq 0 ]; then
    echo "No tags found matching pattern: $PATTERN"
    exit 0
fi

echo "Found $TAG_COUNT tags matching pattern."
echo ""
echo "First 20 tags:"
echo "$MATCHING_TAGS" | head -20
echo ""

if [ "$TAG_COUNT" -gt 20 ]; then
    echo "... and $(($TAG_COUNT - 20)) more tags"
    echo ""
fi

# Confirm deletion
if [ "$DRY_RUN" = true ]; then
    echo "DRY RUN MODE - No tags will be deleted."
    echo ""
    echo "To delete these tags locally, run:"
    echo "  ./delete-tags-fast.sh \"$PATTERN\""
    echo ""
    echo "To delete these tags locally AND push deletions to remote, run:"
    echo "  ./delete-tags-fast.sh \"$PATTERN\" --remote"
    exit 0
fi

read -p "Are you sure you want to delete $TAG_COUNT tags? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "Deleting tags locally..."

# Delete tags locally using xargs for speed
DELETED_COUNT=$(echo "$MATCHING_TAGS" | xargs -n 1 git tag -d 2>&1 | grep -c "Deleted tag" || echo "0")

echo "Deleted $DELETED_COUNT tags locally."
echo ""

# Delete from remote if requested
if [ "$DELETE_REMOTE" = true ]; then
    echo "======================================"
    echo "Deleting tags from remote..."
    echo "======================================"
    echo ""

    read -p "This will push tag deletions to the remote repository. Continue? (yes/no): " CONFIRM_REMOTE

    if [ "$CONFIRM_REMOTE" != "yes" ]; then
        echo "Skipped remote deletion."
        exit 0
    fi

    echo ""
    echo "Pushing deletions to remote..."
    echo "This uses a single git push command with all deletions."
    echo "It will be much faster but may take a few minutes for $TAG_COUNT tags."
    echo ""

    # Build the push command with all tag deletions
    # Format: git push origin :refs/tags/tag1 :refs/tags/tag2 :refs/tags/tag3 ...
    PUSH_REFS=$(echo "$MATCHING_TAGS" | sed 's/^/:refs\/tags\//')

    # Execute the single push command
    echo "Executing push command..."
    echo "$PUSH_REFS" | xargs git push origin

    echo ""
    echo "Remote deletion complete!"
fi

echo ""
echo "======================================"
echo "Done!"
echo "======================================"
