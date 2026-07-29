package main

import (
	"context"
	"path"
	"regexp"
	"sort"
	"strings"
)

// uploadLibraryPrefixRE matches Immich's internal upload prefix
// (<UPLOAD_LOCATION>/library/<userUUID>/) so it can be stripped, leaving the
// user-meaningful YYYY/MM-DD structure. External-library paths do not contain
// a /library/<uuid>/ segment and are left untouched.
var uploadLibraryPrefixRE = regexp.MustCompile(`^.*/library/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/`)

// normalizeOriginalPath turns a raw Immich originalPath into the path shown in the
// folder view. Uploaded assets (no libraryID) get their internal prefix stripped so
// they surface as year folders; external-library assets keep their real filesystem path.
func normalizeOriginalPath(rawPath string, libraryID *string) string {
	if libraryID != nil {
		return rawPath
	}
	return uploadLibraryPrefixRE.ReplaceAllString(rawPath, "")
}

// escapeLikePattern escapes LIKE wildcards so a folder name containing '_' or '%'
// (e.g. "my_photos") does not accidentally match sibling folders.
func escapeLikePattern(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, "%", `\%`)
	s = strings.ReplaceAll(s, "_", `\_`)
	return s
}

func (d *Database) getFolderTree(ctx context.Context, userID string, withGPS bool, hiddenFilter, startDate, endDate string) (*FolderTree, error) {
	f := buildAssetFilter(userID, "", "", withGPS, hiddenFilter, startDate, endDate)

	rows, err := d.db.QueryContext(ctx, "SELECT originalPath "+f.fromClause, f.args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	dirCounts := make(map[string]int)
	for rows.Next() {
		var originalPath string
		if err := rows.Scan(&originalPath); err != nil {
			return nil, err
		}
		dir := path.Dir(originalPath)
		if dir == "." || dir == "" || dir == "/" {
			continue
		}
		dirCounts[dir]++
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return buildFolderTree(dirCounts), nil
}

func (d *Database) getFolderAssets(ctx context.Context, userID, folderPath string, withGPS bool, hiddenFilter, startDate, endDate string, page, pageSize int) ([]AssetRow, int, error) {
	f := buildAssetFilter(userID, "", "", withGPS, hiddenFilter, startDate, endDate)

	// Recursive prefix match: everything under folderPath (files directly inside it
	// and in any subfolder). The trailing "/" avoids /Photos/2 matching /Photos/2023.
	f.fromClause += ` AND originalPath LIKE ? ESCAPE '\'`
	f.args = append(f.args, escapeLikePattern(folderPath)+`/%`)

	var total int
	if err := d.db.QueryRowContext(ctx, "SELECT COUNT(*) "+f.fromClause, f.args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	query := "SELECT " + assetColumns + " " + f.fromClause + " ORDER BY fileCreatedAt DESC, immichID DESC LIMIT ? OFFSET ?"
	rows, err := d.db.QueryContext(ctx, query, append(f.args, pageSize, offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	assets, err := scanAssetRows(rows)
	if err != nil {
		return nil, 0, err
	}
	return assets, total, nil
}

func (d *Database) needsOriginalPathBackfill(ctx context.Context, userID string) (bool, error) {
	backfillDone, err := d.getSyncState(ctx, userID, "originalPathBackfillDone")
	if err != nil {
		return false, err
	}
	return backfillDone == nil || *backfillDone != "true", nil
}

type folderBuilder struct {
	children []*folderBuilder
	name     string
	path     string
	ownCount int
}

// buildFolderTree turns a map of directory -> direct-asset-count into a nested tree.
// Intermediate directories are synthesised even when they hold no direct assets, and
// each node's AssetCount is the sum of its own assets plus all descendants'.
func buildFolderTree(dirCounts map[string]int) *FolderTree {
	allDirs := make(map[string]bool)
	for dir := range dirCounts {
		for d := dir; d != "/" && d != "." && d != ""; d = path.Dir(d) {
			allDirs[d] = true
		}
	}

	sorted := make([]string, 0, len(allDirs))
	for d := range allDirs {
		sorted = append(sorted, d)
	}
	sort.Strings(sorted)

	builders := make(map[string]*folderBuilder)
	for _, d := range sorted {
		builders[d] = &folderBuilder{name: path.Base(d), path: d}
	}
	for dir, count := range dirCounts {
		if b, ok := builders[dir]; ok {
			b.ownCount = count
		}
	}
	for _, d := range sorted {
		if parent, ok := builders[path.Dir(d)]; ok {
			parent.children = append(parent.children, builders[d])
		}
	}

	var toNode func(b *folderBuilder) FolderNode
	toNode = func(b *folderBuilder) FolderNode {
		node := FolderNode{Name: b.name, Path: b.path, AssetCount: b.ownCount, Children: make([]FolderNode, 0, len(b.children))}
		for _, child := range b.children {
			childNode := toNode(child)
			node.AssetCount += childNode.AssetCount
			node.Children = append(node.Children, childNode)
		}
		return node
	}

	tree := &FolderTree{Children: []FolderNode{}}
	for _, d := range sorted {
		if _, hasParent := builders[path.Dir(d)]; !hasParent {
			tree.Children = append(tree.Children, toNode(builders[d]))
		}
	}
	return tree
}
