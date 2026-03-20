# Cloudinary Media Migration Guide

This backend now stores movie media in Cloudinary and stores only media metadata in MongoDB.

## New Data Shape

`movies` documents now store:
- `coverImage.url`
- `coverImage.publicId`
- `coverImage.resourceType`
- `videoFile.url`
- `videoFile.publicId`
- `videoFile.resourceType`

Legacy fields removed after migration:
- `cover`
- `video`

## Prerequisites

1. Ensure `.env` has valid Cloudinary keys:
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

2. Ensure local legacy files still exist under `uploads/` if you are migrating old records.

## Step 1: Dry Run Migration

```bash
node scripts/migrate-movie-media-to-cloudinary.js
```

This only reports how many records need migration.

## Step 2: Execute Migration

```bash
node scripts/migrate-movie-media-to-cloudinary.js --execute
```

Optional: also delete local legacy media files after successful upload:

```bash
node scripts/migrate-movie-media-to-cloudinary.js --execute --delete-local
```

## Step 3: Verify Data

Validate each migrated movie has:
- `coverImage.url`
- `coverImage.publicId`
- `videoFile.url`
- `videoFile.publicId`

And old fields are removed.

## Step 4: Safe Cleanup of Unused Media Collections

Dry run:

```bash
node scripts/drop-unused-media-collections.js
```

Drop only empty candidate collections:

```bash
node scripts/drop-unused-media-collections.js --execute
```

Force drop non-empty candidate collections (dangerous):

```bash
node scripts/drop-unused-media-collections.js --execute --force
```
