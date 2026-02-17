#!/bin/bash

# Script to bulk delete git tags matching a pattern
# Usage: ./delete-tags.sh [pattern] [--dry-run] [--remote]
#
# Examples:
#   ./delete-tags.sh "@wordpress/" --dry-run     # Preview tags to delete
#   ./delete-tags.sh "@wordpress/reusable-blocks" --dry-run  # Preview specific package
#   ./delete-tags.sh "@wordpress/" --remote      # Delete locally and push deletions
#   ./delete-tags.sh "@wordpress/"               # Delete only locally

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
echo "Tag Deletion Script"
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
    echo "  ./delete-tags.sh \"$PATTERN\""
    echo ""
    echo "To delete these tags locally AND push deletions to remote, run:"
    echo "  ./delete-tags.sh \"$PATTERN\" --remote"
    exit 0
fi

read -p "Are you sure you want to delete $TAG_COUNT tags? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "Deleting tags locally..."

DELETED_COUNT=0
FAILED_COUNT=0

# Delete tags locally
echo "$MATCHING_TAGS" | while read -r tag; do
    if [ -n "$tag" ]; then
        if git tag -d "$tag" >/dev/null 2>&1; then
            DELETED_COUNT=$((DELETED_COUNT + 1))
            if [ $((DELETED_COUNT % 100)) -eq 0 ]; then
                echo "Deleted $DELETED_COUNT tags..."
            fi
        else
            echo "Failed to delete: $tag"
            FAILED_COUNT=$((FAILED_COUNT + 1))
        fi
    fi
done

echo ""
echo "Local deletion complete."
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
    echo "Pushing deletions to remote (this may take a while)..."
    echo ""

    # Delete tags from remote in batches to avoid command line length limits
    BATCH_SIZE=100
    TEMP_FILE=$(mktemp)
    echo "$MATCHING_TAGS" > "$TEMP_FILE"

    TOTAL_BATCHES=$(((TAG_COUNT + BATCH_SIZE - 1) / BATCH_SIZE))
    CURRENT_BATCH=0

    while IFS= read -r tag; do
        if [ -n "$tag" ]; then
            BATCH_TAGS+=("$tag")

            if [ ${#BATCH_TAGS[@]} -eq $BATCH_SIZE ]; then
                CURRENT_BATCH=$((CURRENT_BATCH + 1))
                echo "Processing batch $CURRENT_BATCH of $TOTAL_BATCHES..."

                for batch_tag in "${BATCH_TAGS[@]}"; do
                    git push origin ":refs/tags/$batch_tag" 2>&1 | grep -v "deleted" || true
                done

                BATCH_TAGS=()
            fi
        fi
    done < "$TEMP_FILE"

    # Process remaining tags
    if [ ${#BATCH_TAGS[@]} -gt 0 ]; then
        CURRENT_BATCH=$((CURRENT_BATCH + 1))
        echo "Processing final batch $CURRENT_BATCH of $TOTAL_BATCHES..."

        for batch_tag in "${BATCH_TAGS[@]}"; do
            git push origin ":refs/tags/$batch_tag" 2>&1 | grep -v "deleted" || true
        done
    fi

    rm "$TEMP_FILE"

    echo ""
    echo "Remote deletion complete."
fi

echo ""
echo "======================================"
echo "Done!"
echo "======================================"
