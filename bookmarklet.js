javascript:void((function() {
    const IMAGE_TRACKER = {
        // Track images in order of appearance
        imageList: [],
        
        // Track initial image count
        initialImageCount: 0,

        // Classes we're interested in
        targetClasses: ['xz74otr', 'xmz0i5r', 'x193iq5w'],

        initObserving: function() {
            // go through all images with target classes and init imageList
            // and initialImageCount
            const allImages = document.getElementsByTagName('img');
            for (let img of allImages) {
                if (this.hasTargetClasses(img)) {
                    this.imageList.push(img);
                    this.initialImageCount++;
                }
            }
        },

        // Check if element has all target classes
        hasTargetClasses: function(element) {
            return this.targetClasses.every(className => 
                element.classList.contains(className)
            );
        },

        // Process a new image
        processImage: async function(img) {
            // Skip if already tracked
            if (this.imageList.includes(img)) {
                return;
            }

            // Add to our tracking list
            this.imageList.push(img);
            const position = this.imageList.length - 1;

            console.log('Hello new image', {
                src: img.src.substring(0, 50) + '...',
                position: position,
                dimensions: `${img.width}x${img.height}`,
                isNew: position >= this.initialImageCount
            });

            // Only send to backend if it's a new image (not from initial load)
            if (position >= this.initialImageCount) {
                try {
                    // First try a preflight request
                    try {
                        const preflightRes = await fetch("http://localhost:3103/api/vision", {
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
                    const res = await fetch("http://localhost:3103/api/vision", {
                        method: "POST",
                        body: JSON.stringify({ 
                            imageUrl: img.src,
                            position: position
                        }),
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
                } catch (error) {
                    console.error("Error sending to backend:", error);
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
            }
        },

        // Check for new target images
        checkForNewImages: function() {
            // Find all images
            const allImages = document.getElementsByTagName('img');
            
            for (let img of allImages) {
                if (this.hasTargetClasses(img)) {
                    this.processImage(img);
                }
            }
        },

        // Start observing
        startObserving: function() {
            // First check existing images
            this.checkForNewImages();
            
            // Set initial image count after first check
            this.initialImageCount = this.imageList.length;
            console.log(`Initial image count: ${this.initialImageCount}`);

            // Create observer for new images
            const observer = new MutationObserver((mutations) => {
                let shouldCheck = false;
                
                for (let mutation of mutations) {
                    // Check added nodes
                    if (mutation.addedNodes.length > 0) {
                        for (let node of mutation.addedNodes) {
                            // Direct image match
                            if (node.tagName === 'IMG' && this.hasTargetClasses(node)) {
                                shouldCheck = true;
                                break;
                            }
                            // Check if added node contains images
                            if (node.getElementsByTagName) {
                                const images = node.getElementsByTagName('img');
                                for (let img of images) {
                                    if (this.hasTargetClasses(img)) {
                                        shouldCheck = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    // Check class changes on existing images
                    if (mutation.type === 'attributes' && 
                        mutation.attributeName === 'class' &&
                        mutation.target.tagName === 'IMG') {
                        if (this.hasTargetClasses(mutation.target)) {
                            shouldCheck = true;
                            break;
                        }
                    }
                }

                if (shouldCheck) {
                    this.checkForNewImages();
                }
            });

            // Observe the entire document
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
            });

            // Store observer reference
            this.observer = observer;

            // Add cleanup function
            window.IMAGE_TRACKER_CLEANUP = () => {
                if (this.observer) {
                    this.observer.disconnect();
                    this.imageList = [];
                    this.initialImageCount = 0;
                    console.log('Image Tracker stopped and cache cleared');
                }
            };

            console.log('Image Tracker is now watching for images with classes:', this.targetClasses);
            console.log('To stop, run: window.IMAGE_TRACKER_CLEANUP()');
        },

        // Initialize
        init: function() {
            console.log('Starting Image Tracker...');
            this.initObserving();
            if (document.readyState === 'complete') {
                this.startObserving();
            } else {
                window.addEventListener('load', () => this.startObserving());
            }
        }
    };

    // Start the script
    IMAGE_TRACKER.init();
})());
