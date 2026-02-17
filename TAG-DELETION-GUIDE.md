# Tag Deletion Guide

## Summary

The `gh release list` commands weren't returning the tags you were looking for because:

1. **GitHub Releases vs Git Tags**: The tags like `@wordpress/reusable-blocks@1.0.1` are **git tags** but NOT GitHub Releases
2. `gh release list` only shows GitHub Releases (like "Gutenberg Nightly" releases)
3. These package tags exist only as git tags in the repository

## Current State

- **Total @wordpress/ tags**: 22,255 tags
- **Specific to reusable-blocks**: 326 tags
- These are git tags without associated GitHub releases

## Solution: delete-tags.sh Script

A bash script has been created to safely bulk delete matching git tags.

### Usage

#### 1. Preview what will be deleted (DRY RUN - RECOMMENDED FIRST STEP)

```bash
# Preview all @wordpress/ tags
./delete-tags.sh "@wordpress/" --dry-run

# Preview specific package tags
./delete-tags.sh "@wordpress/reusable-blocks" --dry-run

# Preview any pattern
./delete-tags.sh "@wordpress/block-editor" --dry-run
```

#### 2. Delete tags locally only

```bash
# Delete all @wordpress/ tags locally
./delete-tags.sh "@wordpress/"

# Delete specific package tags locally
./delete-tags.sh "@wordpress/reusable-blocks"
```

#### 3. Delete tags locally AND from remote

```bash
# Delete all @wordpress/ tags locally and push deletions
./delete-tags.sh "@wordpress/" --remote

# Delete specific package tags locally and push deletions
./delete-tags.sh "@wordpress/reusable-blocks" --remote
```

### Safety Features

1. **Dry run mode**: Preview exactly what will be deleted before committing
2. **Confirmation prompts**: Script asks for confirmation before deleting
3. **Double confirmation**: Additional prompt before pushing deletions to remote
4. **Batch processing**: Remote deletions are processed in batches of 100 to avoid command line length limits
5. **Progress indicators**: Shows progress during large operations

### Recommended Workflow

```bash
# Step 1: Preview the tags
./delete-tags.sh "@wordpress/reusable-blocks" --dry-run

# Step 2: Delete locally first (safe to test)
./delete-tags.sh "@wordpress/reusable-blocks"

# Step 3: If satisfied, delete from remote
./delete-tags.sh "@wordpress/reusable-blocks" --remote
```

## Alternative: Using Git Commands Directly

If you prefer to use git commands directly:

```bash
# List tags matching pattern
git tag | grep "@wordpress/reusable-blocks"

# Count matching tags
git tag | grep -c "@wordpress/reusable-blocks"

# Delete locally (one at a time)
git tag -d "@wordpress/reusable-blocks@1.0.1"

# Delete from remote (one at a time)
git push origin :refs/tags/@wordpress/reusable-blocks@1.0.1

# Bulk delete locally
git tag | grep "@wordpress/reusable-blocks" | xargs git tag -d

# Bulk delete from remote (careful!)
git tag | grep "@wordpress/reusable-blocks" | xargs -I {} git push origin :refs/tags/{}
```

## Notes

- GitHub Releases and git tags are different things
- Deleting a tag locally doesn't delete it from the remote until you push
- The `--remote` flag in the script handles pushing deletions
- Remote deletions are permanent and affect all users of the repository
- Consider backing up important tags before deletion

## Next Steps

1. Run the script with `--dry-run` to preview
2. Decide which pattern to use (`@wordpress/` for all, or specific package names)
3. Delete locally first to test
4. Push deletions to remote when ready
