/**
 * CrossPoint to Grimmory Bookmark Sync Application
 * 
 * This application provides a complete workflow for syncing CrossPoint e-reader bookmarks
 * to a self-hosted Grimmory server. It is architected with clear separation of concerns:
 * 
 * - GrimmoryAPI: Handles all HTTP communication with the Grimmory server
 * - CrossPointParser: Parses and validates CrossPoint JSON bookmark files
 * - SyncEngine: Orchestrates the complete sync workflow with deduplication
 * - UIController: Manages all user interface interactions and state
 * 
 * All operations are performed client-side with no external dependencies.
 */

// ============================================================================
// GRIMMORY API CLIENT
// ============================================================================

/**
 * GrimmoryAPI - Handles all communication with the Grimmory server
 * Provides methods for searching books, fetching bookmarks, and creating new bookmarks
 */
class GrimmoryAPI {
    /**
     * Initialize the API client with server credentials
     * @param {string} baseUrl - The base URL of the Grimmory server
     * @param {string} username - The username for authentication
     * @param {string} password - The password for authentication
     * @param {string|null} apiKey - Optional API key (for direct API key usage)
     */
    constructor(baseUrl, username, password, apiKey = null) {
        // Remove trailing slash from baseUrl to ensure consistent URL construction
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.username = username;
        this.password = password;
        this.apiKey = apiKey;
        this.token = null;
    }

    /**
     * Get default headers for all API requests
     * @returns {Object} Headers object with Content-Type and Authorization
     */
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        // Use token if we have it (from login), otherwise use API key if provided
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        } else if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        return headers;
    }

    /**
     * Authenticate with username/password to get a token
     * @returns {Promise<string>} The authentication token
     * @throws {Error} If authentication fails
     */
    async login() {
        try {
            const url = `${this.baseUrl}/api/v1/auth/login`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: this.username,
                    password: this.password
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Login failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            
            if (!data.accessToken) {
                throw new Error('No access token received in login response');
            }

            this.token = data.accessToken;
            return this.token;
        } catch (error) {
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    /**
     * Refresh authentication token
     * @returns {Promise<string>} New authentication token
     * @throws {Error} If token refresh fails
     */
    async refreshToken() {
        try {
            const url = `${this.baseUrl}/api/v1/auth/refresh`;
            const response = await fetch(url, {
                method: 'POST',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!data.accessToken) {
                throw new Error('No access token received in refresh response');
            }

            this.token = data.accessToken;
            return this.token;
        } catch (error) {
            throw new Error(`Token refresh failed: ${error.message}`);
        }
    }

    /**
     * Logout from the Grimmory server
     * @returns {Promise<void>}
     * @throws {Error} If logout fails
     */
    async logout() {
        try {
            const url = `${this.baseUrl}/api/v1/auth/logout`;
            const response = await fetch(url, {
                method: 'POST',
                headers: this.getHeaders()
            });

            if (!response.ok && response.status !== 401) {
                // 401 is expected if token is already invalid
                throw new Error(`Logout failed: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            // Logout failures are usually not critical
            console.warn('Logout failed:', error.message);
        } finally {
            this.token = null;
        }
    }

    /**
     * Search for a book by title
     * @param {string} query - The book title to search for
     * @returns {Promise<Object|null>} The first matching book object or null if not found
     * @throws {Error} If the API request fails
     */
    async searchBook(query) {
        try {
            const url = `${this.baseUrl}/api/v1/app/books/search?q=${encodeURIComponent(query)}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Search failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            
            // Return the first book from the content array, or null if empty
            if (data.content && data.content.length > 0) {
                return data.content[0];
            }
            
            return null;
        } catch (error) {
            throw new Error(`Failed to search for book "${query}": ${error.message}`);
        }
    }

    /**
     * Get all existing bookmarks for a specific book
     * @param {number} bookId - The ID of the book
     * @returns {Promise<Array>} Array of bookmark objects
     * @throws {Error} If the API request fails
     */
    async getBookmarks(bookId) {
        try {
            const url = `${this.baseUrl}/api/v1/bookmarks/book/${bookId}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch bookmarks: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const bookmarks = await response.json();
            return Array.isArray(bookmarks) ? bookmarks : [];
        } catch (error) {
            throw new Error(`Failed to get bookmarks for book ${bookId}: ${error.message}`);
        }
    }

    /**
     * Create a new bookmark on the Grimmory server
     * @param {Object} bookmark - The bookmark object to create
     * @param {number} bookmark.bookId - The book ID
     * @param {string} bookmark.cfi - The CFI (xpath) location
     * @param {number} bookmark.pageNumber - The page number
     * @param {string} bookmark.title - The bookmark title (summary text)
     * @returns {Promise<Object>} The created bookmark object
     * @throws {Error} If the API request fails
     */
    async createBookmark(bookmark) {
        try {
            const url = `${this.baseUrl}/api/v1/bookmarks`;
            const response = await fetch(url, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(bookmark)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to create bookmark: ${response.status} - ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            throw new Error(`Failed to create bookmark: ${error.message}`);
        }
    }

    /**
     * Create a new annotation (highlight) on the Grimmory server
     * Annotations create visible highlights in the EPUB reader with red bookmark indicators
     * @param {Object} annotation - The annotation object to create
     * @param {number} annotation.bookId - The book ID
     * @param {string} annotation.cfi - The CFI range location
     * @param {string} annotation.text - The highlighted text
     * @param {string} [annotation.color] - Hex color (default: #FFFF00 for yellow)
     * @param {string} [annotation.style] - Style type (default: "highlight")
     * @returns {Promise<Object>} The created annotation object
     * @throws {Error} If the API request fails
     */
    async createAnnotation(annotation) {
        try {
            const url = `${this.baseUrl}/api/v1/annotations`;
            const payload = {
                bookId: annotation.bookId,
                cfi: annotation.cfi,
                text: annotation.text,
                color: annotation.color || '#FFFF00',
                type: 'HIGHLIGHT',
                style: annotation.style || 'highlight'
            };
            
            const response = await fetch(url, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to create annotation: ${response.status} - ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            throw new Error(`Failed to create annotation: ${error.message}`);
        }
    }

    /**
     * Test the connection to the Grimmory server
     * @returns {Promise<boolean>} True if connection is successful
     * @throws {Error} If the connection test fails
     */
    async testConnection() {
        try {
            // For username/password auth, we need to login first
            if (this.username && this.password && !this.token) {
                await this.login();
            }

            // Try a simple search to verify connectivity and authentication
            const url = `${this.baseUrl}/api/v1/app/books/search?q=test`;
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`Connection test failed: ${response.status} ${response.statusText}`);
            }

            return true;
        } catch (error) {
            throw new Error(`Unable to connect to Grimmory server: ${error.message}`);
        }
    }
}

// ============================================================================
// CROSSPOINT PARSER
// ============================================================================

/**
 * CrossPointParser - Handles parsing and validation of CrossPoint bookmark JSON files
 * Extracts book titles from filenames and converts CrossPoint format to Grimmory format
 */
class CrossPointParser {
    /**
     * Parse a CrossPoint JSON file and extract bookmarks
     * @param {File} file - The file object to parse
     * @returns {Promise<Object>} Object containing bookTitle and bookmarks array
     * @throws {Error} If parsing fails or file format is invalid
     */
    static async parseFile(file) {
        try {
            // Read file content as text
            const content = await file.text();
            
            // Parse JSON
            let data;
            try {
                data = JSON.parse(content);
            } catch (jsonError) {
                throw new Error(`Invalid JSON format: ${jsonError.message}`);
            }

            // Validate structure
            if (!data.bookmarks || !Array.isArray(data.bookmarks)) {
                throw new Error('Invalid file structure: missing "bookmarks" array');
            }

            // Extract book title from filename
            // Expected format: "Author Name - Book Title.json"
            const bookTitle = this.extractBookTitle(file.name);

            // Validate and transform bookmarks
            const bookmarks = data.bookmarks.map((bookmark, index) => {
                if (!bookmark.xpath) {
                    throw new Error(`Bookmark ${index + 1} is missing required field: xpath`);
                }
                if (!bookmark.summary) {
                    throw new Error(`Bookmark ${index + 1} is missing required field: summary`);
                }

                // Convert CrossPoint XPath to standard EPUB CFI format
                let epubCfi = this.convertCrossPointXPathToCFI(bookmark.xpath, bookmark.si);

                // Return bookmark in normalized format (note: pageNumber set to null by default to avoid Grimmory 400 data conflict errors)
                return {
                    cfi: epubCfi,
                    rawXpath: bookmark.xpath,
                    title: bookmark.summary,
                    pageNumber: null,
                    originalPage: bookmark.pp,
                    si: bookmark.si,
                    // Keep original data for reference
                    _original: bookmark
                };
            });

            return {
                fileName: file.name,
                bookTitle,
                bookmarks,
                totalBookmarks: bookmarks.length
            };
        } catch (error) {
            throw new Error(`Failed to parse file "${file.name}": ${error.message}`);
        }
    }

    /**
     * Convert CrossPoint specific XPath to EPUB CFI standard format
     * @param {string} xpath - The CrossPoint XPath
     * @param {number} [si] - The spine index from the bookmark
     * @param {boolean} [asRange] - Whether to format as a range CFI for highlighting
     * @returns {string} The standard EPUB CFI string
     */
    static convertCrossPointXPathToCFI(xpath, si = null, asRange = true) {
        const docFragMatch = xpath.match(/DocFragment\[(\d+)\]/);
        
        let spineIdx;
        if (si !== null && si !== undefined) {
            spineIdx = parseInt(si, 10);
        } else if (docFragMatch) {
            spineIdx = parseInt(docFragMatch[1], 10) - 1;
        } else {
            // Cannot reliably convert without spine index, return original
            return xpath;
        }

        // EPUB CFI spine steps usually follow (spineIdx + 1) * 2 logic
        const spineStep = (spineIdx + 1) * 2;
        
        // Remove the prefix to parse the rest
        let remainder = xpath.replace(/^\/body\/DocFragment\[\d+\]/, '');
        
        // Extract text node info if present (e.g. /text()[2].420)
        let textOffset = "";
        const textMatch = remainder.match(/\/text\(\)(?:\[(\d+)\])?(?:\.(\d+))?/);
        if (textMatch) {
            const textIdx = textMatch[1] ? parseInt(textMatch[1], 10) : 1;
            const offset = textMatch[2];
            
            // Remove text part from remainder to parse element steps
            remainder = remainder.substring(0, textMatch.index);
            
            // Text nodes are odd-numbered steps in CFI ((index * 2) - 1)
            const textStep = (textIdx * 2) - 1;
            textOffset = offset ? `/${textStep}:${offset}` : `/${textStep}`;
        }

        // Parse HTML element steps (/body -> /4, /div[1] -> /2, /p[5] -> /10)
        const segments = remainder.split('/').filter(Boolean);
        const cfiSteps = [];
        
        for (const seg of segments) {
            const m = seg.match(/([a-zA-Z0-9]+)(?:\[(\d+)\])?/);
            if (!m) continue;
            
            const tag = m[1].toLowerCase();
            const idx = m[2] ? parseInt(m[2], 10) : 1;
            
            if (tag === 'body') {
                cfiSteps.push('4');
            } else if (tag === 'html') {
                cfiSteps.push('2');
            } else {
                cfiSteps.push((idx * 2).toString());
            }
        }

        const pathStr = cfiSteps.length > 0 ? '/' + cfiSteps.join('/') : '';
        const baseCfi = `epubcfi(/6/${spineStep}!${pathStr}${textOffset})`;
        
        // If asRange is true, convert point CFI to simple range CFI for highlighting
        // This makes Grimmory display red highlights in the web reader
        if (asRange && !baseCfi.includes(',')) {
            // Transform: epubcfi(...) -> epubcfi(...,/1:0,/1:10)
            return baseCfi.replace(')', ',/1:0,/1:10)');
        }
        
        return baseCfi;
    }

    /**
     * Extract book title from filename
     * @param {string} fileName - The name of the file
     * @returns {string} The extracted book title
     */
    static extractBookTitle(fileName) {
        // Remove .json extension
        let title = fileName.replace(/\.json$/i, '');
        
        // If filename contains " - ", assume format is "Author - Title"
        // and extract just the title part
        if (title.includes(' - ')) {
            const parts = title.split(' - ');
            // Take everything after the first " - " in case the title also contains " - "
            title = parts.slice(1).join(' - ');
        }

        return title.trim();
    }

    /**
     * Validate multiple files before processing
     * @param {FileList} files - The files to validate
     * @returns {Object} Validation result with valid and invalid files
     */
    static validateFiles(files) {
        const result = {
            valid: [],
            invalid: []
        };

        Array.from(files).forEach(file => {
            // Check file type
            if (!file.name.toLowerCase().endsWith('.json')) {
                result.invalid.push({
                    file,
                    reason: 'File must be a JSON file'
                });
                return;
            }

            // Check file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                result.invalid.push({
                    file,
                    reason: 'File size exceeds 10MB limit'
                });
                return;
            }

            result.valid.push(file);
        });

        return result;
    }
}

// ============================================================================
// SYNC ENGINE
// ============================================================================

/**
 * SyncEngine - Orchestrates the complete bookmark synchronization workflow
 * Handles book search, deduplication, bookmark creation, and verification
 */
class SyncEngine {
    /**
     * Initialize the sync engine
     * @param {GrimmoryAPI} api - The Grimmory API client instance
     * @param {Function} logCallback - Callback function for logging messages
     */
    constructor(api, logCallback) {
        this.api = api;
        this.log = logCallback;
        this.stats = {
            totalFiles: 0,
            processedFiles: 0,
            totalBookmarks: 0,
            newBookmarks: 0,
            skippedBookmarks: 0,
            errors: 0
        };
    }

    /**
     * Sync a single file's bookmarks to Grimmory
     * @param {Object} parsedFile - The parsed file object from CrossPointParser
     * @param {string} syncMode - 'highlight' or 'bookmark'
     * @param {boolean} useRangeCfi - Whether to convert to range CFI
     * @param {boolean} includePageNumber - Whether to include page numbers
     * @returns {Promise<Object>} Sync result with statistics
     */
    async syncFile(parsedFile, syncMode = 'highlight', useRangeCfi = true, includePageNumber = false) {
        const { fileName, bookTitle, bookmarks } = parsedFile;
        
        this.log('info', `📄 Processing: ${fileName}`);
        this.log('info', `📖 Book title: ${bookTitle}`);
        this.log('info', `📊 Found ${bookmarks.length} bookmarks in file`);
        this.log('info', `⚙️  Mode: ${syncMode}, Range: ${useRangeCfi}, Page: ${includePageNumber}`);

        try {
            // Step 1: Search for the book
            this.log('progress', '🔍 Searching for book in Grimmory...');
            const book = await this.api.searchBook(bookTitle);
            
            if (!book) {
                this.log('error', `❌ Book not found in Grimmory: "${bookTitle}"`);
                this.log('error', `⚠️  Skipping file: ${fileName}`);
                this.stats.errors++;
                return { success: false, reason: 'Book not found' };
            }

            this.log('success', `✅ Found book: "${book.title}" (ID: ${book.id})`);

            // Step 2: Fetch existing items for deduplication
            this.log('progress', '📥 Fetching existing items from Grimmory...');
            const existingItems = syncMode === 'highlight' 
                ? await this.api.getBookmarks(book.id) // Use bookmarks for dedup in both modes
                : await this.api.getBookmarks(book.id);
            
            this.log('info', `📋 Found ${existingItems.length} existing items`);

            // Step 3: Prepare bookmarks with current settings
            this.log('progress', '🔄 Preparing bookmarks with current settings...');
            const preparedBookmarks = bookmarks.map(bm => {
                // Re-generate CFI with range setting
                const cfi = CrossPointParser.convertCrossPointXPathToCFI(
                    bm.rawXpath, 
                    bm.si, 
                    useRangeCfi
                );
                
                return {
                    ...bm,
                    cfi: cfi,
                    pageNumber: includePageNumber ? bm.originalPage : null
                };
            });

            // Step 4: Compare and filter out duplicates
            this.log('progress', '🔄 Checking for duplicates...');
            const newBookmarks = this.filterDuplicates(preparedBookmarks, existingItems);
            
            const duplicateCount = bookmarks.length - newBookmarks.length;
            if (duplicateCount > 0) {
                this.log('warning', `⚠️  Found ${duplicateCount} duplicate(s), skipping...`);
            }
            
            if (newBookmarks.length === 0) {
                this.log('info', `ℹ️  All items already exist. Nothing to sync.`);
                this.stats.skippedBookmarks += bookmarks.length;
                return { success: true, newCount: 0, skippedCount: bookmarks.length };
            }

            this.log('success', `✨ ${newBookmarks.length} new item(s) to sync`);

            // Step 5: Create new items
            this.log('progress', `📤 Syncing ${newBookmarks.length} item(s)...`);
            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < newBookmarks.length; i++) {
                const bookmark = newBookmarks[i];
                try {
                    if (syncMode === 'highlight') {
                        // Create annotation (highlight) for visible red markers
                        await this.api.createAnnotation({
                            bookId: book.id,
                            cfi: bookmark.cfi,
                            text: bookmark.title,
                            color: '#FFFF00',
                            style: 'highlight'
                        });
                    } else {
                        // Create bookmark for navigation only
                        await this.api.createBookmark({
                            bookId: book.id,
                            cfi: bookmark.cfi,
                            pageNumber: bookmark.pageNumber,
                            title: bookmark.title
                        });
                    }
                    successCount++;
                    this.log('success', `  ✓ Synced item ${i + 1}/${newBookmarks.length}: "${this.truncate(bookmark.title, 60)}"`);
                } catch (error) {
                    failCount++;
                    this.log('error', `  ✗ Failed item ${i + 1}/${newBookmarks.length}: ${error.message}`);
                }
            }

            // Step 6: Verify sync
            this.log('progress', '🔍 Verifying sync...');
            const updatedItems = await this.api.getBookmarks(book.id);
            const expectedTotal = existingItems.length + successCount;
            
            if (updatedItems.length >= expectedTotal) {
                this.log('success', `✅ Verification passed! Total items: ${updatedItems.length}`);
            } else {
                this.log('warning', `⚠️  Verification incomplete. Expected ${expectedTotal}, got ${updatedItems.length}`);
            }

            // Update statistics
            this.stats.newBookmarks += successCount;
            this.stats.skippedBookmarks += duplicateCount;
            if (failCount > 0) {
                this.stats.errors += failCount;
            }

            this.log('success', `🎉 File sync complete: ${successCount} added, ${duplicateCount} skipped, ${failCount} failed`);
            
            return {
                success: true,
                newCount: successCount,
                skippedCount: duplicateCount,
                failedCount: failCount
            };

        } catch (error) {
            this.log('error', `❌ Error syncing file: ${error.message}`);
            this.log('error', `Stack trace: ${error.stack}`);
            this.stats.errors++;
            return { success: false, reason: error.message };
        }
    }

    /**
     * Filter out duplicate bookmarks based on CFI (xpath) matching
     * @param {Array} newBookmarks - The bookmarks from CrossPoint
     * @param {Array} existingBookmarks - The bookmarks already in Grimmory
     * @returns {Array} Array of bookmarks that don't exist in Grimmory
     */
    filterDuplicates(newBookmarks, existingBookmarks) {
        // Create a Set of existing CFIs for O(1) lookup
        const existingCFIs = new Set(existingBookmarks.map(b => b.cfi));
        
        // Also create a Set of title matches as a secondary check (ignoring pageNumber as we set it to null)
        const existingTitles = new Set(
            existingBookmarks.map(b => b.title)
        );

        return newBookmarks.filter(bookmark => {
            // Primary match: check if exact EPUB CFI already exists
            if (existingCFIs.has(bookmark.cfi)) {
                return false;
            }
            
            // Secondary match: check if the exact text already exists
            // This prevents uploading the exact same quote twice if CFI parsing differs slightly
            if (existingTitles.has(bookmark.title)) {
                return false;
            }

            return true;
        });
    }

    /**
     * Sync multiple files sequentially
     * @param {Array<File>} files - Array of File objects to sync
     * @param {string} syncMode - 'highlight' or 'bookmark'
     * @param {boolean} useRangeCfi - Whether to convert to range CFI
     * @param {boolean} includePageNumber - Whether to include page numbers
     * @param {Function} progressCallback - Callback for progress updates (current, total)
     * @returns {Promise<Object>} Final statistics
     */
    async syncFiles(files, syncMode, useRangeCfi, includePageNumber, progressCallback) {
        this.stats = {
            totalFiles: files.length,
            processedFiles: 0,
            totalBookmarks: 0,
            newBookmarks: 0,
            skippedBookmarks: 0,
            errors: 0
        };

        this.log('info', `🚀 Starting sync for ${files.length} file(s)...`);
        this.log('info', '─'.repeat(60));

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            try {
                // Parse the file
                this.log('progress', `\n[${i + 1}/${files.length}] Parsing ${file.name}...`);
                const parsedFile = await CrossPointParser.parseFile(file);
                this.stats.totalBookmarks += parsedFile.totalBookmarks;

                // Sync the file
                await this.syncFile(parsedFile, syncMode, useRangeCfi, includePageNumber);
                
            } catch (error) {
                this.log('error', `❌ Failed to process file "${file.name}": ${error.message}`);
                this.log('error', `Stack trace: ${error.stack}`);
                this.stats.errors++;
            }

            this.stats.processedFiles++;
            progressCallback(this.stats.processedFiles, this.stats.totalFiles);
            
            this.log('info', '─'.repeat(60));
        }

        // Final summary
        this.log('info', '\n📊 SYNC COMPLETE - SUMMARY');
        this.log('info', '─'.repeat(60));
        this.log('info', `✓ Files processed: ${this.stats.processedFiles}/${this.stats.totalFiles}`);
        this.log('info', `✓ Total items found: ${this.stats.totalBookmarks}`);
        this.log('success', `✓ New items synced: ${this.stats.newBookmarks}`);
        this.log('warning', `⊘ Duplicates skipped: ${this.stats.skippedBookmarks}`);
        if (this.stats.errors > 0) {
            this.log('error', `✗ Errors encountered: ${this.stats.errors}`);
        }
        this.log('info', '─'.repeat(60));

        return this.stats;
    }

    /**
     * Truncate a string to a maximum length
     * @param {string} str - The string to truncate
     * @param {number} maxLength - Maximum length
     * @returns {string} Truncated string
     */
    truncate(str, maxLength) {
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength - 3) + '...';
    }
}

// ============================================================================
// UI CONTROLLER
// ============================================================================

/**
 * UIController - Manages all user interface interactions and application state
 * Handles view transitions, form validation, file selection, and sync progress
 */
class UIController {
    constructor() {
        this.currentView = 'credentials';
        this.credentials = null;
        this.selectedFiles = [];
        this.api = null;
        this.syncEngine = null;
        this.createdBookmarkIds = []; // Track bookmark IDs for undo
        this.createdAnnotationIds = []; // Track annotation IDs for undo
        this.parsedBookmarks = []; // Store parsed bookmarks for viewer/editor
        this.logEntries = []; // Store log entries for export

        // Initialize UI
        this.initializeElements();
        this.attachEventListeners();
        this.loadSavedCredentials();
        this.updateProgressIndicator(1);
    }

    /**
     * Cache references to DOM elements
     */
    initializeElements() {
        // Views
        this.views = {
            credentials: document.getElementById('credentialsView'),
            fileSelection: document.getElementById('fileSelectionView'),
            syncProgress: document.getElementById('syncProgressView')
        };

        // Credentials form
        this.credentialsForm = document.getElementById('credentialsForm');
        this.serverUrlInput = document.getElementById('serverUrl');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.apiKeyInput = document.getElementById('apiKey');
        this.rememberCheckbox = document.getElementById('rememberCredentials');
        this.credentialsError = document.getElementById('credentialsError');
        this.credentialsErrorText = document.getElementById('credentialsErrorText');
        this.credentialsFields = document.getElementById('credentialsFields');
        this.apiKeyFields = document.getElementById('apiKeyFields');
        this.authMethodRadios = document.querySelectorAll('input[name="authMethod"]');

        // File selection
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.selectedFilesContainer = document.getElementById('selectedFilesContainer');
        this.selectedFilesList = document.getElementById('selectedFilesList');
        this.fileCount = document.getElementById('fileCount');
        this.startSyncButton = document.getElementById('startSyncButton');
        this.backToCredentials = document.getElementById('backToCredentials');
        this.viewBookmarksBtn = document.getElementById('viewBookmarksBtn');
        this.settingFormatRange = document.getElementById('settingFormatRange');
        this.settingIncludePage = document.getElementById('settingIncludePage');

        // Sync progress
        this.syncLog = document.getElementById('syncLog');
        this.overallProgressBar = document.getElementById('overallProgressBar');
        this.overallProgress = document.getElementById('overallProgress');
        this.syncCompleteActions = document.getElementById('syncCompleteActions');
        this.syncAnotherButton = document.getElementById('syncAnotherButton');
        this.newSessionButton = document.getElementById('newSessionButton');
        this.undoSyncButton = document.getElementById('undoSyncButton');
        this.syncStatsPanel = document.getElementById('syncStatsPanel');
        this.statProcessed = document.getElementById('statProcessed');
        this.statSynced = document.getElementById('statSynced');
        this.statSkipped = document.getElementById('statSkipped');
        this.statErrors = document.getElementById('statErrors');
        this.exportLogsButton = document.getElementById('exportLogsButton');
        this.syncModeRadios = document.querySelectorAll('input[name="syncMode"]');

        // Bookmarks modal
        this.bookmarksModal = document.getElementById('bookmarksModal');
        this.closeBookmarksModal = document.getElementById('closeBookmarksModal');
        this.modalBookmarksContainer = document.getElementById('modalBookmarksContainer');
        this.saveBookmarksChanges = document.getElementById('saveBookmarksChanges');

        // Progress indicator
        this.progressIndicator = document.getElementById('progressIndicator');
    }

    /**
     * Attach event listeners to interactive elements
     */
    attachEventListeners() {
        // Credentials form
        this.credentialsForm.addEventListener('submit', (e) => this.handleCredentialsSubmit(e));

        // Auth method toggle
        this.authMethodRadios.forEach(radio => {
            radio.addEventListener('change', () => this.toggleAuthFields());
        });

        // File selection
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.dropZone.addEventListener('click', () => this.fileInput.click());
        this.dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.dropZone.addEventListener('drop', (e) => this.handleDrop(e));
        this.startSyncButton.addEventListener('click', () => this.startSync());
        this.backToCredentials.addEventListener('click', () => this.switchView('credentials'));
        this.viewBookmarksBtn.addEventListener('click', () => this.openBookmarksModal());

        // Sync complete actions
        this.syncAnotherButton.addEventListener('click', () => this.resetForNewSync());
        this.newSessionButton.addEventListener('click', () => this.resetApplication());
        this.undoSyncButton.addEventListener('click', () => this.undoLastSync());
        this.exportLogsButton.addEventListener('click', () => this.exportLogs());

        // Bookmarks modal
        this.closeBookmarksModal.addEventListener('click', () => this.closeBookmarksModalHandler());
        this.saveBookmarksChanges.addEventListener('click', () => this.closeBookmarksModalHandler());
        this.bookmarksModal.addEventListener('click', (e) => {
            if (e.target === this.bookmarksModal) {
                this.closeBookmarksModalHandler();
            }
        });
    }

    /**
     * Toggle between username/password and API key fields
     */
    toggleAuthFields() {
        const selectedMethod = document.querySelector('input[name="authMethod"]:checked').value;
        
        if (selectedMethod === 'credentials') {
            this.credentialsFields.classList.remove('hidden');
            this.apiKeyFields.classList.add('hidden');
            this.usernameInput.required = true;
            this.passwordInput.required = true;
            this.apiKeyInput.required = false;
        } else {
            this.credentialsFields.classList.add('hidden');
            this.apiKeyFields.classList.remove('hidden');
            this.usernameInput.required = false;
            this.passwordInput.required = false;
            this.apiKeyInput.required = true;
        }
    }

    /**
     * Load saved credentials from localStorage
     */
    loadSavedCredentials() {
        try {
            const saved = localStorage.getItem('grimmoryCredentials');
            if (saved) {
                const credentials = JSON.parse(saved);
                this.serverUrlInput.value = credentials.serverUrl || '';
                
                // Handle saved auth method
                if (credentials.authMethod === 'apikey' && credentials.apiKey) {
                    this.apiKeyInput.value = credentials.apiKey;
                    document.querySelector('input[name="authMethod"][value="apikey"]').checked = true;
                    this.toggleAuthFields();
                } else if (credentials.username) {
                    this.usernameInput.value = credentials.username || '';
                    this.passwordInput.value = credentials.password || '';
                    document.querySelector('input[name="authMethod"][value="credentials"]').checked = true;
                    this.toggleAuthFields();
                }
                
                this.rememberCheckbox.checked = true;
            }
        } catch (error) {
            console.error('Failed to load saved credentials:', error);
        }
    }

    /**
     * Handle credentials form submission
     */
    async handleCredentialsSubmit(e) {
        e.preventDefault();
        
        const serverUrl = this.serverUrlInput.value.trim();
        const authMethod = document.querySelector('input[name="authMethod"]:checked').value;
        
        let username = '', password = '', apiKey = null;
        
        if (authMethod === 'credentials') {
            username = this.usernameInput.value.trim();
            password = this.passwordInput.value.trim();
            
            if (!username || !password) {
                this.showCredentialsError('Please enter both username and password.');
                return;
            }
        } else {
            apiKey = this.apiKeyInput.value.trim();
            
            if (!apiKey) {
                this.showCredentialsError('Please enter your API key.');
                return;
            }
        }

        // Validate URL format
        try {
            new URL(serverUrl);
        } catch (error) {
            this.showCredentialsError('Please enter a valid URL (e.g., http://127.0.0.1:34619)');
            return;
        }

        // Show loading state
        const submitButton = this.credentialsForm.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Connecting...';
        submitButton.disabled = true;

        try {
            // Initialize API and test connection
            this.api = new GrimmoryAPI(serverUrl, username, password, apiKey);
            await this.api.testConnection();

            // Save credentials if requested
            if (this.rememberCheckbox.checked) {
                localStorage.setItem('grimmoryCredentials', JSON.stringify({ 
                    serverUrl, 
                    authMethod,
                    username, 
                    password,
                    apiKey 
                }));
            } else {
                localStorage.removeItem('grimmoryCredentials');
            }

            this.credentials = { serverUrl, authMethod, username, password, apiKey };
            this.hideCredentialsError();
            this.switchView('fileSelection');
            this.updateProgressIndicator(2);

        } catch (error) {
            this.showCredentialsError(error.message);
        } finally {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    }

    /**
     * Show credentials error message
     */
    showCredentialsError(message) {
        this.credentialsErrorText.textContent = message;
        this.credentialsError.classList.remove('hidden');
    }

    /**
     * Hide credentials error message
     */
    hideCredentialsError() {
        this.credentialsError.classList.add('hidden');
    }

    /**
     * Handle drag over event
     */
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        this.dropZone.classList.add('border-primary', 'bg-primary/5');
    }

    /**
     * Handle drag leave event
     */
    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        this.dropZone.classList.remove('border-primary', 'bg-primary/5');
    }

    /**
     * Handle file drop event
     */
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        this.dropZone.classList.remove('border-primary', 'bg-primary/5');

        const files = e.dataTransfer.files;
        this.processFiles(files);
    }

    /**
     * Handle file selection from input
     */
    handleFileSelect(e) {
        const files = e.target.files;
        this.processFiles(files);
    }

    /**
     * Process and validate selected files
     */
    async processFiles(files) {
        if (files.length === 0) return;

        const validation = CrossPointParser.validateFiles(files);

        // Show errors for invalid files
        validation.invalid.forEach(({ file, reason }) => {
            alert(`Invalid file "${file.name}": ${reason}`);
        });

        if (validation.valid.length === 0) {
            return;
        }

        // Store valid files
        this.selectedFiles = validation.valid;
        
        // Parse all files to populate parsedBookmarks for preview
        this.parsedBookmarks = [];
        for (const file of this.selectedFiles) {
            try {
                const parsed = await CrossPointParser.parseFile(file);
                this.parsedBookmarks.push(...parsed.bookmarks.map(bm => ({
                    ...bm,
                    fileName: file.name,
                    bookTitle: parsed.bookTitle
                })));
            } catch (error) {
                console.error(`Failed to parse ${file.name}:`, error);
            }
        }
        
        this.renderFileList();
    }

    /**
     * Render the list of selected files
     */
    renderFileList() {
        if (this.selectedFiles.length === 0) {
            this.selectedFilesContainer.classList.add('hidden');
            return;
        }

        this.selectedFilesContainer.classList.remove('hidden');
        this.fileCount.textContent = this.selectedFiles.length;
        this.selectedFilesList.innerHTML = '';

        this.selectedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200';
            fileItem.innerHTML = `
                <div class="flex items-center flex-1 min-w-0">
                    <svg class="w-5 h-5 text-slate-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                    </svg>
                    <span class="text-sm font-medium text-slate-700 truncate">${file.name}</span>
                    <span class="ml-2 text-xs text-slate-500 flex-shrink-0">(${this.formatFileSize(file.size)})</span>
                </div>
                <button class="ml-3 text-slate-400 hover:text-error transition-colors flex-shrink-0" onclick="uiController.removeFile(${index})">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
            `;
            this.selectedFilesList.appendChild(fileItem);
        });
    }

    /**
     * Remove a file from selection
     */
    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.renderFileList();
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    /**
     * Start the sync process
     */
    async startSync() {
        if (this.selectedFiles.length === 0) {
            this.log('error', '❌ No files selected for sync');
            alert('Please select at least one file to sync.');
            return;
        }

        this.switchView('syncProgress');
        this.updateProgressIndicator(3);
        this.syncStatsPanel.classList.remove('hidden');
        this.createdBookmarkIds = []; // Reset for new sync
        this.createdAnnotationIds = []; // Track annotations for undo
        this.logEntries = []; // Reset log for export

        // Get user settings
        const syncMode = document.querySelector('input[name="syncMode"]:checked').value;
        const useRangeCfi = this.settingFormatRange.checked;
        const includePageNumber = this.settingIncludePage.checked;

        this.log('info', `⚙️  Settings: Mode=${syncMode}, RangeCFI=${useRangeCfi}, PageNumbers=${includePageNumber}`);

        // Initialize sync engine
        this.syncEngine = new SyncEngine(this.api, (type, message) => {
            this.addLogEntry(type, message);
            this.logEntries.push({ type, message, timestamp: new Date().toISOString() });
        });

        // Track created items based on mode
        const originalCreateBookmark = this.api.createBookmark.bind(this.api);
        const originalCreateAnnotation = this.api.createAnnotation.bind(this.api);

        if (syncMode === 'bookmark') {
            this.api.createBookmark = async (bookmark) => {
                this.log('progress', `  → Creating bookmark at CFI: ${bookmark.cfi.substring(0, 50)}...`);
                const result = await originalCreateBookmark(bookmark);
                if (result && result.id) {
                    this.createdBookmarkIds.push(result.id);
                    this.log('success', `  ✓ Bookmark created with ID: ${result.id}`);
                }
                return result;
            };
        } else {
            this.api.createAnnotation = async (annotation) => {
                this.log('progress', `  → Creating highlight at CFI: ${annotation.cfi.substring(0, 50)}...`);
                const result = await originalCreateAnnotation(annotation);
                if (result && result.id) {
                    this.createdAnnotationIds.push(result.id);
                    this.log('success', `  ✓ Highlight created with ID: ${result.id}`);
                }
                return result;
            };
        }

        // Start sync
        try {
            const stats = await this.syncEngine.syncFiles(
                this.selectedFiles,
                syncMode,
                useRangeCfi,
                includePageNumber,
                (current, total) => {
                    const percentage = Math.round((current / total) * 100);
                    this.updateOverallProgress(percentage);
                    this.updateSyncStats(this.syncEngine.stats);
                }
            );

            this.updateSyncStats(stats);
            this.addLogEntry('success', '\n✅ ALL DONE! Your items have been synced successfully.');
            this.syncCompleteActions.classList.remove('hidden');

        } catch (error) {
            this.addLogEntry('error', `\n❌ Sync failed: ${error.message}`);
            this.log('error', `Stack trace: ${error.stack}`);
        }
    }

    /**
     * Update sync statistics display
     */
    updateSyncStats(stats) {
        this.statProcessed.textContent = `${stats.processedFiles}/${stats.totalFiles}`;
        this.statSynced.textContent = stats.newBookmarks;
        this.statSkipped.textContent = stats.skippedBookmarks;
        this.statErrors.textContent = stats.errors;
    }

    /**
     * Undo last sync by deleting all created bookmarks/annotations
     */
    async undoLastSync() {
        const totalItems = this.createdBookmarkIds.length + this.createdAnnotationIds.length;
        
        if (totalItems === 0) {
            alert('No items to undo.');
            return;
        }

        const confirmed = confirm(
            `This will delete ${totalItems} item(s) that were just added. Continue?`
        );
        
        if (!confirmed) return;

        this.addLogEntry('warning', '\n↩️  Starting undo operation...');
        this.log('info', `Deleting ${this.createdBookmarkIds.length} bookmarks and ${this.createdAnnotationIds.length} annotations`);
        this.undoSyncButton.disabled = true;
        this.undoSyncButton.textContent = 'Undoing...';

        let successCount = 0;
        let failCount = 0;

        // Delete bookmarks
        for (const bookmarkId of this.createdBookmarkIds) {
            try {
                const url = `${this.api.baseUrl}/api/v1/bookmarks/${bookmarkId}`;
                this.log('progress', `  → Deleting bookmark ID ${bookmarkId}...`);
                
                const response = await fetch(url, {
                    method: 'DELETE',
                    headers: this.api.getHeaders()
                });

                if (response.ok || response.status === 404) {
                    successCount++;
                    this.log('success', `  ✓ Deleted bookmark ${bookmarkId}`);
                } else {
                    failCount++;
                    this.addLogEntry('error', `Failed to delete bookmark ${bookmarkId}: ${response.status}`);
                }
            } catch (error) {
                failCount++;
                this.addLogEntry('error', `Error deleting bookmark ${bookmarkId}: ${error.message}`);
            }
        }

        // Delete annotations
        for (const annotationId of this.createdAnnotationIds) {
            try {
                const url = `${this.api.baseUrl}/api/v1/annotations/${annotationId}`;
                this.log('progress', `  → Deleting annotation ID ${annotationId}...`);
                
                const response = await fetch(url, {
                    method: 'DELETE',
                    headers: this.api.getHeaders()
                });

                if (response.ok || response.status === 404) {
                    successCount++;
                    this.log('success', `  ✓ Deleted annotation ${annotationId}`);
                } else {
                    failCount++;
                    this.addLogEntry('error', `Failed to delete annotation ${annotationId}: ${response.status}`);
                }
            } catch (error) {
                failCount++;
                this.addLogEntry('error', `Error deleting annotation ${annotationId}: ${error.message}`);
            }
        }

        this.addLogEntry('success', `✅ Undo complete: ${successCount} deleted, ${failCount} failed`);
        this.createdBookmarkIds = [];
        this.createdAnnotationIds = [];
        this.undoSyncButton.disabled = false;
        this.undoSyncButton.textContent = '↩ Undo Sync (Remove Added Items)';
        
        if (successCount > 0) {
            this.undoSyncButton.classList.add('hidden');
        }
    }

    /**
     * Export logs to a downloadable file
     */
    exportLogs() {
        if (!this.logEntries || this.logEntries.length === 0) {
            alert('No logs to export.');
            return;
        }

        const logText = this.logEntries.map(entry => {
            const timestamp = new Date(entry.timestamp).toLocaleString();
            return `[${timestamp}] [${entry.type.toUpperCase()}] ${entry.message}`;
        }).join('\n');

        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `crosspoint-sync-logs-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.addLogEntry('success', '📋 Logs exported successfully!');
    }

    /**
     * Internal logging method
     */
    log(type, message) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
    }

    /**
     * Open bookmarks modal for review/edit
     */
    openBookmarksModal() {
        if (this.parsedBookmarks.length === 0) {
            alert('No bookmarks to display. Please select files first.');
            return;
        }

        this.renderBookmarksModal();
        this.bookmarksModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close bookmarks modal
     */
    closeBookmarksModalHandler() {
        this.bookmarksModal.classList.add('hidden');
        document.body.style.overflow = '';
    }

    /**
     * Render bookmarks in modal
     */
    renderBookmarksModal() {
        this.modalBookmarksContainer.innerHTML = '';

        // Group by book/file
        const grouped = {};
        this.parsedBookmarks.forEach(bm => {
            if (!grouped[bm.bookTitle]) {
                grouped[bm.bookTitle] = [];
            }
            grouped[bm.bookTitle].push(bm);
        });

        Object.entries(grouped).forEach(([bookTitle, bookmarks]) => {
            const bookSection = document.createElement('div');
            bookSection.className = 'mb-6';
            bookSection.innerHTML = `
                <h4 class="text-lg font-bold text-slate-800 mb-3 flex items-center">
                    <svg class="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                    ${bookTitle}
                </h4>
                <div class="text-xs text-slate-500 mb-3">${bookmarks.length} bookmark(s)</div>
            `;

            bookmarks.slice(0, 10).forEach((bm, idx) => {
                const card = document.createElement('div');
                card.className = 'bg-slate-50 border border-slate-200 rounded-lg p-3 mb-2 hover:bg-slate-100 transition-colors';
                card.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div class="flex-1 min-w-0">
                            <div class="text-sm text-slate-700 line-clamp-2">${bm.title}</div>
                            <div class="text-xs text-slate-500 mt-1">Page ${bm.originalPage || 'N/A'}</div>
                        </div>
                        <button class="ml-3 text-red-400 hover:text-red-600 text-xs" onclick="uiController.removeBookmarkFromList(${idx}, '${bookTitle}')">
                            Remove
                        </button>
                    </div>
                `;
                bookSection.appendChild(card);
            });

            if (bookmarks.length > 10) {
                const moreText = document.createElement('div');
                moreText.className = 'text-sm text-slate-500 text-center py-2';
                moreText.textContent = `... and ${bookmarks.length - 10} more`;
                bookSection.appendChild(moreText);
            }

            this.modalBookmarksContainer.appendChild(bookSection);
        });
    }

    /**
     * Remove a bookmark from the parsed list
     */
    removeBookmarkFromList(index, bookTitle) {
        const bookmarkIndex = this.parsedBookmarks.findIndex(
            (bm, i) => bm.bookTitle === bookTitle && this.parsedBookmarks.filter(b => b.bookTitle === bookTitle).indexOf(bm) === index
        );
        
        if (bookmarkIndex !== -1) {
            this.parsedBookmarks.splice(bookmarkIndex, 1);
            this.renderBookmarksModal();
        }
    }
    addLogEntry(type, message) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        
        // Color coding based on type
        const colors = {
            info: 'text-slate-300',
            success: 'text-green-400',
            error: 'text-red-400',
            warning: 'text-yellow-400',
            progress: 'text-blue-400'
        };

        entry.className = colors[type] || 'text-slate-300';
        entry.textContent = message;
        
        this.syncLog.appendChild(entry);
        this.syncLog.scrollTop = this.syncLog.scrollHeight;
    }

    /**
     * Update overall progress bar
     */
    updateOverallProgress(percentage) {
        this.overallProgressBar.style.width = `${percentage}%`;
        this.overallProgress.textContent = `${percentage}%`;
    }

    /**
     * Reset for a new sync (keep credentials)
     */
    resetForNewSync() {
        this.selectedFiles = [];
        this.parsedBookmarks = [];
        this.createdBookmarkIds = [];
        this.createdAnnotationIds = [];
        this.logEntries = [];
        this.fileInput.value = '';
        this.syncLog.innerHTML = '<div class="text-slate-400">Initializing sync process...</div>';
        this.overallProgressBar.style.width = '0%';
        this.overallProgress.textContent = '0%';
        this.syncCompleteActions.classList.add('hidden');
        this.syncStatsPanel.classList.add('hidden');
        this.switchView('fileSelection');
        this.updateProgressIndicator(2);
    }

    /**
     * Reset the entire application
     */
    resetApplication() {
        this.credentials = null;
        this.api = null;
        this.selectedFiles = [];
        this.parsedBookmarks = [];
        this.createdBookmarkIds = [];
        this.createdAnnotationIds = [];
        this.logEntries = [];
        this.fileInput.value = '';
        this.credentialsForm.reset();
        this.loadSavedCredentials();
        this.syncLog.innerHTML = '<div class="text-slate-400">Initializing sync process...</div>';
        this.overallProgressBar.style.width = '0%';
        this.overallProgress.textContent = '0%';
        this.syncCompleteActions.classList.add('hidden');
        this.syncStatsPanel.classList.add('hidden');
        this.switchView('credentials');
        this.updateProgressIndicator(1);
    }

    /**
     * Switch between views
     */
    switchView(viewName) {
        // Hide all views
        Object.values(this.views).forEach(view => {
            view.classList.add('hidden');
        });

        // Show requested view
        if (this.views[viewName]) {
            this.views[viewName].classList.remove('hidden');
            this.currentView = viewName;
        }
    }

    /**
     * Update progress indicator
     */
    updateProgressIndicator(step) {
        this.progressIndicator.classList.remove('hidden');
        
        const indicators = document.querySelectorAll('.step-indicator');
        const lines = document.querySelectorAll('.step-line');

        indicators.forEach((indicator, index) => {
            const stepNumber = index + 1;
            if (stepNumber < step) {
                indicator.classList.add('bg-success', 'text-white');
                indicator.classList.remove('bg-slate-200', 'text-slate-600');
            } else if (stepNumber === step) {
                indicator.classList.add('bg-primary', 'text-white');
                indicator.classList.remove('bg-slate-200', 'text-slate-600', 'bg-success');
            } else {
                indicator.classList.add('bg-slate-200', 'text-slate-600');
                indicator.classList.remove('bg-primary', 'bg-success', 'text-white');
            }
        });

        lines.forEach((line, index) => {
            const lineNumber = index + 1;
            if (lineNumber < step) {
                line.classList.add('bg-success');
                line.classList.remove('bg-slate-300');
            } else {
                line.classList.add('bg-slate-300');
                line.classList.remove('bg-success');
            }
        });
    }
}

// ============================================================================
// APPLICATION INITIALIZATION
// ============================================================================

// Initialize the application when DOM is ready
let uiController;

document.addEventListener('DOMContentLoaded', () => {
    uiController = new UIController();
    console.log('CrossPoint to Grimmory Bookmark Sync initialized successfully');
});
