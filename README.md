# CrossPoint to Grimmory Bookmark Sync

A modern, responsive, and completely static Single Page Application (SPA) for syncing CrossPoint e-reader bookmarks to a self-hosted Grimmory server.

## Features

✨ **Clean & Intuitive Interface** - Step-by-step wizard with beautiful UI  
🔄 **Smart Deduplication** - Automatically detects and skips existing bookmarks  
📊 **Real-time Progress** - Live logging of sync operations  
🔒 **Privacy-First** - All processing happens locally in your browser  
💾 **Remember Credentials** - Optional local storage of server details  
📱 **Fully Responsive** - Works on desktop, tablet, and mobile devices  

## Quick Start

### Option 1: GitHub Pages (Recommended)

1. Fork this repository
2. Go to Settings → Pages
3. Set source to "main" branch
4. Your app will be available at `https://yourusername.github.io/crosspoint-bookmark-sync/`

### Option 2: Local Development

Simply open `index.html` in your web browser. No build tools or dependencies required!

```bash
# Clone the repository
git clone https://github.com/yourusername/crosspoint-bookmark-sync.git

# Navigate to the directory
cd crosspoint-bookmark-sync

# Open in browser (macOS)
open index.html

# Or (Linux)
xdg-open index.html

# Or (Windows)
start index.html
```

## Usage Guide

### Step 1: Connect to Grimmory

1. Enter your Grimmory server URL (e.g., `http://127.0.0.1:34619`)
2. Choose your authentication method:
   - **Username & Password** - Login with your Grimmory account credentials
   - **API Key** - Use a direct API key for authentication
3. Optionally check "Remember my credentials" to save them locally
4. Click "Connect & Continue"

### Step 2: Upload Bookmark Files

1. Drag and drop your CrossPoint JSON files, or click "Browse Files"
2. Multiple files can be uploaded at once
3. Files should be named in the format: `Author Name - Book Title.json`
4. Review the selected files list
5. Click "Start Sync"

### Step 3: Monitor Sync Progress

Watch the real-time log as the application:
- Parses each JSON file
- Searches for the book in Grimmory
- Checks for existing bookmarks
- Syncs only new bookmarks
- Verifies the sync was successful

## CrossPoint Bookmark Format

Your CrossPoint JSON files should follow this structure:

```json
{
  "bookmarks": [
    {
      "xpath": "/body/DocFragment[8]/body/p[5]/text()[1].114",
      "percentage": 0.040566,
      "summary": "Chinese invented many things!",
      "si": 7,
      "pc": 64,
      "pp": 1
    }
  ]
}
```

### Field Mappings

| CrossPoint Field | Grimmory Field | Description |
|-----------------|----------------|-------------|
| `summary` | `title` | The bookmark text/highlight |
| `xpath` | `cfi` | Location identifier |
| `pp` | `pageNumber` | Page number |

## Grimmory API Requirements

This tool uses the following Grimmory API endpoints:

- **Login**: `POST /api/v1/auth/login`
- **Search Books**: `GET /api/v1/app/books/search?q={query}`
- **Get Bookmarks**: `GET /api/v1/bookmarks/book/{bookId}`
- **Create Bookmark**: `POST /api/v1/bookmarks`
- **Refresh Token**: `POST /api/v1/auth/refresh`
- **Logout**: `POST /api/v1/auth/logout`

### Authentication

The application supports two authentication methods:

**1. Username & Password (Recommended)**
```
POST /api/v1/auth/login
{
  "username": "your_username",
  "password": "your_password"
}
Response: { "accessToken": "..." }
```

**2. API Key (Direct)**
```
Authorization: Bearer YOUR_API_KEY
```

## Architecture

The application is built with clean, modular architecture:

### Core Classes

#### `GrimmoryAPI`
Handles all HTTP communication with the Grimmory server including:
- Book search
- Bookmark retrieval
- Bookmark creation
- Connection testing

#### `CrossPointParser`
Parses and validates CrossPoint JSON files:
- Extracts book titles from filenames
- Validates JSON structure
- Converts CrossPoint format to Grimmory format

#### `SyncEngine`
Orchestrates the complete sync workflow:
- Manages sync process for multiple files
- Implements smart deduplication logic
- Tracks statistics and progress
- Handles errors gracefully

#### `UIController`
Manages all user interface interactions:
- View transitions
- Form validation
- File selection (drag & drop)
- Real-time progress updates
- Log display

## File Structure

```
crosspoint-bookmark-sync/
├── index.html      # Main HTML structure with Tailwind CSS
├── app.js          # Complete application logic (modular classes)
├── styles.css      # Custom styles and animations
└── README.md       # This file
```

## Browser Compatibility

✅ Chrome 90+  
✅ Firefox 88+  
✅ Safari 14+  
✅ Edge 90+  

The application uses modern JavaScript features:
- ES6 Classes
- Async/Await
- Fetch API
- LocalStorage
- FileReader API

## Privacy & Security

- **No External Servers**: All processing happens in your browser
- **No Analytics**: No tracking or telemetry
- **Local Storage Only**: Credentials are stored only in your browser's local storage
- **HTTPS Recommended**: Use HTTPS for production deployments
- **CORS Awareness**: Your Grimmory server must allow CORS requests
- **Token-Based Auth**: When using username/password, tokens are used for API requests
- **No Credential Transmission**: Credentials are never sent to any third party

## Support the Project

If you find this tool useful, consider [sponsoring on GitHub](https://github.com/sponsors/warreth/) to support continued development!

## Troubleshooting

### "Unable to connect to Grimmory server"

**Possible causes:**
- Incorrect server URL
- Invalid credentials
- Server not running
- CORS issues

**Solutions:**
- Verify your Grimmory server is running
- Check the URL format (include `http://` or `https://`)
- Ensure your username/password or API key is correct
- Configure CORS on your Grimmory server

### "Login failed"

**Possible causes:**
- Incorrect username or password
- Account locked or disabled
- Server authentication issues

**Solutions:**
- Verify your credentials by logging into Grimmory directly
- Check if your account has API access enabled
- Contact your Grimmory administrator

### "Book not found in Grimmory"

**Possible causes:**
- Book not in your Grimmory library
- Title mismatch between filename and Grimmory

**Solutions:**
- Add the book to your Grimmory library first
- Rename the JSON file to match the exact book title in Grimmory
- Check for spelling differences

### Files not uploading

**Solutions:**
- Ensure files have `.json` extension
- Check file size (max 10MB per file)
- Verify JSON is valid format

## Development

### Making Changes

The application is intentionally simple with no build process:

1. Edit `index.html` for structure changes
2. Edit `app.js` for functionality changes
3. Edit `styles.css` for styling changes
4. Refresh browser to see changes

### Adding Features

The modular architecture makes it easy to extend:

- Add new API methods to `GrimmoryAPI` class
- Add parsing logic to `CrossPointParser` class
- Add sync features to `SyncEngine` class
- Add UI features to `UIController` class

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this tool for personal or commercial projects.

## Credits

Built with:
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework (v4.3.3)
- Vanilla JavaScript - No frameworks required
- Love for e-readers and self-hosted solutions

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

**Made with ❤️ for the CrossPoint and Grimmory communities**
