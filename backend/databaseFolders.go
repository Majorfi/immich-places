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

func (d *Database) getFolderTree(ctx context.Context, userID, gpsFilter, hiddenFilter, tagID, startDate, endDate string) (*FolderTree, error) {
	f := buildAssetFilter(userID, "", tagID, gpsFilter, hiddenFilter, startDate, endDate)
	col := "originalPath"
	if f.aliased {
		col = "a.originalPath"
	}

	// Loads every matching originalPath and builds the tree in memory. The
	// (userID, originalPath) index keeps the scan cheap; adequate for typical
	// libraries and reloaded on view/filter change without caching for v1.
	rows, err := d.db.QueryContext(ctx, "SELECT "+col+" "+f.fromClause, f.args...)
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

func (d *Database) getFolderAssets(ctx context.Context, userID, folderPath, gpsFilter, hiddenFilter, tagID, startDate, endDate string, page, pageSize int) ([]AssetRow, int, error) {
	// Guarded here rather than only in the handler: an empty path would build the range
	// [ "/", "0" ), matching every absolute path in the library. A trailing slash would
	// build [ "//", "0" ) and silently match nothing.
	folderPath = strings.TrimRight(folderPath, "/")
	if folderPath == "" {
		return []AssetRow{}, 0, nil
	}

	f := buildAssetFilter(userID, "", tagID, gpsFilter, hiddenFilter, startDate, endDate)
	cols := assetColumns
	pathCol := "originalPath"
	orderBy := " ORDER BY fileCreatedAt DESC, immichID DESC"
	if f.aliased {
		cols = assetColumnsAliased
		pathCol = "a.originalPath"
		orderBy = " ORDER BY a.fileCreatedAt DESC, a.immichID DESC"
	}

	// Recursive prefix match: everything under folderPath (files directly inside it and
	// in any subfolder). A half-open range on the raw path stays case-sensitive, unlike
	// LIKE, whose ASCII case-insensitivity would make /lib/Trip also return /lib/trip
	// while the tree counts them as two folders. It needs no wildcard escaping, and it
	// can use the (userID, originalPath) index. '/' + 1 == '0', so the upper bound
	// excludes exactly the paths that do not continue with "/".
	f.fromClause += ` AND ` + pathCol + ` >= ? AND ` + pathCol + ` < ?`
	f.args = append(f.args, folderPath+"/", folderPath+"0")

	var total int
	if err := d.db.QueryRowContext(ctx, "SELECT COUNT(*) "+f.fromClause, f.args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	query := "SELECT " + cols + " " + f.fromClause + orderBy + " LIMIT ? OFFSET ?"
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

// toNode renders the builder as a FolderNode, rolling every descendant's count up
// into the parent's AssetCount.
func (b *folderBuilder) toNode() FolderNode {
	node := FolderNode{Name: b.name, Path: b.path, AssetCount: b.ownCount, Children: make([]FolderNode, 0, len(b.children))}
	for _, child := range b.children {
		childNode := child.toNode()
		node.AssetCount += childNode.AssetCount
		node.Children = append(node.Children, childNode)
	}
	return node
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

	builders := make(map[string]*folderBuilder, len(sorted))
	for _, d := range sorted {
		builders[d] = &folderBuilder{name: path.Base(d), path: d, ownCount: dirCounts[d]}
	}
	for _, d := range sorted {
		if parent, ok := builders[path.Dir(d)]; ok {
			parent.children = append(parent.children, builders[d])
		}
	}

	tree := &FolderTree{Children: []FolderNode{}}
	for _, d := range sorted {
		if _, hasParent := builders[path.Dir(d)]; !hasParent {
			tree.Children = append(tree.Children, builders[d].toNode())
		}
	}
	return tree
}
