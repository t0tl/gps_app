javascript:void((function() {
    const META_VISION = {
        // Set to keep track of processed images
        processedImages: new Set(),

        // Simple function to check if an image is worth processing
        isValidImage: function(img) {
            // Must have a source and be a base64 jpeg image
            if (!img || !img.src || !img.src.startsWith('data:image/jpeg')) {
                return false;
            }

            // Must be a reasonably sized image
            if (img.complete && (img.width < 50 || img.height < 50)) {
                return false;
            }

            return true;
        },

        // Process a single image
        processImage: async function(img) {
            // Skip if already processed
            if (this.processedImages.has(img.src)) {
                return;
            }

            console.log('Processing new image:', {
                src: img.src.substring(0, 50) + '...',
                dimensions: `${img.width}x${img.height}`
            });

            try {
                // First try a preflight request
                try {
                    const preflightRes = await fetch("http://localhost:3103/api/gpt-4-vision", {
                        method: 'OPTIONS',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });
                    if (!preflightRes.ok) {
                        throw new Error('Preflight request failed');
                    }
                } catch (preflightError) {
                    console.error('CORS Preflight Error:', preflightError);
                    console.log('Attempting request without preflight...');
                }

                // Main request
                const res = await fetch("http://localhost:3103/api/gpt-4-vision", {
                    method: "POST",
                    body: JSON.stringify({ imageUrl: img.src }),
                    headers: {
                        "Content-Type": "application/json"
                    }
                });

                if (!res.ok) {
                    const errorText = await res.text();
                    throw new Error(`HTTP error! status: ${res.status}, message: ${errorText}`);
                }

                const data = await res.json();
                console.log('API response:', data);
                
                // Mark as processed
                this.processedImages.add(img.src);
            } catch (error) {
                console.error("Error calling API:", error);
                if (error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
                    console.warn(`
CORS Error: Please ensure your local server is running and configured correctly:

1. Server should be running at http://localhost:3103
2. Server should have these CORS headers:
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: GET, POST, OPTIONS
   Access-Control-Allow-Headers: Content-Type

3. Try restarting your server if the issue persists
                    `);
                }
            }
        },

        // Check for new images
        checkForNewImages: function() {
            const allImages = document.getElementsByTagName('img');
            for (let img of allImages) {
                if (this.isValidImage(img)) {
                    this.processImage(img);
                }
            }
        },

        // Start observing
        startObserving: function() {
            // First check existing images
            this.checkForNewImages();

            // Create observer for new images
            const observer = new MutationObserver((mutations) => {
                let shouldCheck = false;
                
                for (let mutation of mutations) {
                    // If new nodes were added
                    if (mutation.addedNodes.length > 0) {
                        shouldCheck = true;
                        break;
                    }
                    // If attributes changed on an image
                    if (mutation.target.tagName === 'IMG' && 
                        mutation.type === 'attributes' && 
                        mutation.attributeName === 'src') {
                        shouldCheck = true;
                        break;
                    }
                }

                // Only scan the whole document if we detected relevant changes
                if (shouldCheck) {
                    this.checkForNewImages();
                }
            });

            // Observe the entire document
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src']
            });

            // Store observer reference
            this.observer = observer;

            // Add cleanup function
            window.META_VISION_CLEANUP = () => {
                if (this.observer) {
                    this.observer.disconnect();
                    this.processedImages.clear();
                    console.log('Meta Vision Observer stopped and cache cleared');
                }
            };

            console.log('Meta Vision is now watching for images!');
            console.log('To stop, run: window.META_VISION_CLEANUP()');
        },

        // Initialize
        init: function() {
            console.log('Starting Meta Vision...');
            if (document.readyState === 'complete') {
                this.startObserving();
            } else {
                window.addEventListener('load', () => this.startObserving());
            }
        }
    };

    // Start the script
    META_VISION.init();
})());
