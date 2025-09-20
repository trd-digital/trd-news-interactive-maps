// Add event listeners to the filter form after it's been created
document.addEventListener('DOMContentLoaded', () => {
    // Wait for the filter form to be created
    const checkFilterForm = () => {
        const filterForm = document.getElementById('map-filters');
        if (filterForm) {
            console.log('Filter form found, adding event listeners');

            // Add event listeners to the filter form buttons
            const applyBtn = filterForm.querySelector('button[type="submit"]');
            const resetBtn = filterForm.querySelector('button[type="reset"]');

            if (applyBtn) {
                applyBtn.addEventListener('click', () => {
                    console.log('Apply filter button clicked');
                    // Schedule refresh after the map updates
                    setTimeout(() => {
                        if (window.refreshStatusCounts) {
                            console.log('Refreshing status counts after apply');
                            window.refreshStatusCounts();
                        }
                    }, 500);
                });
            }

            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    console.log('Reset filter button clicked');
                    // Schedule refresh after the map updates
                    setTimeout(() => {
                        if (window.refreshStatusCounts) {
                            console.log('Refreshing status counts after reset');
                            window.refreshStatusCounts();
                        }
                    }, 500);
                });
            }

            return true;
        }
        return false;
    };

    // Check immediately, then start checking periodically if not found
    if (!checkFilterForm()) {
        const checkInterval = setInterval(() => {
            if (checkFilterForm()) {
                clearInterval(checkInterval);
            }
        }, 500);

        // Clear interval after 10 seconds if filter form never appears
        setTimeout(() => clearInterval(checkInterval), 10000);
    }

    // Check for the map object to add a load event listener
    const mapCheckInterval = setInterval(() => {
        if (window.map) {
            console.log('Map object found, adding load event listener');
            window.map.on('load', () => {
                console.log('Map loaded, dispatching mapboxglLoaded event');
                document.dispatchEvent(new CustomEvent('mapboxglLoaded'));

                // Also refresh status counts directly after map load
                setTimeout(() => {
                    if (window.refreshStatusCounts) {
                        console.log('Directly refreshing status counts after map load');
                        window.refreshStatusCounts();
                    }
                }, 1500);
            });
            clearInterval(mapCheckInterval);
        }
    }, 300);

    // Clear interval after 10 seconds if map never appears
    setTimeout(() => clearInterval(mapCheckInterval), 10000);
});