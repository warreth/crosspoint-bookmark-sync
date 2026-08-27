# CrossPoint to Grimmory Bookmark Sync

A completely static web application to sync your local CrossPoint e-reader bookmarks directly to your self-hosted Grimmory library. 

[![Launch Web App](https://img.shields.io/badge/Launch-Web_App-3b82f6?style=for-the-badge)](https://warreth.github.io/crosspoint-bookmark-sync/)
[![Sponsor](https://img.shields.io/badge/Sponsor-❤️-ef4444?style=for-the-badge)](https://github.com/sponsors/warreth/)

## Features

- **Client-Side Only**: Runs entirely in your browser. Your credentials and data never leave your local machine.
- **Smart Deduplication**: Prevents importing the same highlight twice.
- **Multiple Sync Modes**: Choose between native page bookmarks or in-text yellow highlights.
- **Undo Support**: Safely preview, edit, or instantly undo a sync operation if something goes wrong.
- **Export Logs**: Built-in debugging tools and error tracking.

## Usage

You can use the hosted version immediately via GitHub Pages, or self-host it yourself.

1. Open the [Web App](https://warreth.github.io/crosspoint-bookmark-sync/app.html)
2. Enter your Grimmory server URL and login credentials
3. Upload your `.json` bookmark files from your CrossPoint device
4. Select your preferred sync mode and click "Start Sync"

## Self-Hosting

Because this tool is completely static (just HTML, JS, and CSS), self-hosting is incredibly simple:

1. Clone or download this repository.
2. Serve the directory using any basic web server:
   ```bash
   # Using Python
   python -m http.server 8080
   
   # Using Node.js
   npx serve -p 8080
   
   # Using Docker
   docker run -d -p 8080:80 -v $(pwd):/usr/share/nginx/html nginx:alpine
   ```
3. Open `http://localhost:8080` in your browser.

*Note: Your Grimmory server must be configured to allow CORS requests from wherever you host this tool.*

## Contributing

Pull requests are welcome! I'm open to expanding support for other e-reader firmware or other self-hosted library systems (like Booklore or Kavita) if there is demand. 

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Support

If this tool has saved you time or improved your reading workflow, please consider [sponsoring the project](https://github.com/sponsors/warreth/) to support continued development.

## License

Distributed under the MIT License. See `LICENSE` for more information.
