document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const elements = {
        glossaryContainer: document.getElementById('glossary-container'),
        modal: document.getElementById('term-modal'),
        modalContent: document.getElementById('modal-content')
    };

    // Load and display glossary data
    async function loadGlossaryData() {
        try {
            const response = await fetch('assets/glossary.json');
            const data = await response.json();
            renderGlossary(data);
        } catch (error) {
            console.error('Error loading glossary data:', error);
            elements.glossaryContainer.innerHTML = '<p>Error loading glossary data. Please try again later.</p>';
        }
    }

    // Render glossary sections
    function renderGlossary(data) {
        elements.glossaryContainer.innerHTML = '';

        Object.entries(data).forEach(([category, content]) => {
            const section = document.createElement('section');
            section.className = 'glossary-section';

            // Format the category title
            const title = category.split('/').pop().replace(/_/g, ' ');

            section.innerHTML = `
                <h4>${title}</h4>
                <p>${content.description}</p>
                <div class="terms-grid">
                    ${content.data
                    .filter(term => term && term.toLowerCase() !== 'nan')
                    .map(term => `
                            <div class="term-card" data-term="${term}">
                                ${term}
                            </div>
                        `).join('')}
                </div>
            `;

            elements.glossaryContainer.appendChild(section);
        });

        // Add click listeners to term cards
        document.querySelectorAll('.term-card').forEach(card => {
            card.addEventListener('click', () => openModal(card.dataset.term));
        });
    }

    // Open modal with term details
    async function openModal(term) {
        if (!term) return;

        document.body.classList.add('modal-open');

        elements.modalContent.innerHTML = `
            <div class="modal-header">
                <h2>${term}</h2>
                <button id="modal-close" class="modal-close">&times;</button>
            </div>
            
            <div class="modal-image-container">
                <div class="modal-image-placeholder">
                    <i class="ph-duotone ph-spinner-gap"></i>
                    Searching for image...
                </div>
            </div>

            <div class="modal-description">
                <p class="description-text">Loading description...</p>
            </div>

            <div class="modal-body">
                <div class="horizontal">
                    <div class="image-search-buttons">
                        <p>View more detailed info on:</p>
                        <a href="https://en.wikipedia.org/wiki/${encodeURIComponent(term)}" target="_blank">
                            <img src="assets/wikipedia.svg" height="24" alt="Wikipedia">
                        </a>
                    </div>
                    <div class="image-search-buttons">
                        <p>View images on:</p>
                        <button onclick="window.open('https://www.google.com/search?q=${encodeURIComponent(term)}&tbm=isch', '_blank')">
                            <img src="assets/google.svg" height="24" alt="Google">
                        </button>
                        <button onclick="window.open('https://www.bing.com/images/search?q=${encodeURIComponent(term)}', '_blank')">
                            <img src="assets/bing.svg" height="24" alt="Bing">
                        </button>
                        <button onclick="window.open('https://duckduckgo.com/?q=!i+${encodeURIComponent(term)}', '_blank')">
                            <img src="assets/ddg.svg" height="24" alt="DuckDuckGo">
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Show the modal
        elements.modal.style.display = 'block';

        // Add close button listener
        document.getElementById('modal-close').addEventListener('click', () => {
            elements.modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        });

        // Fetch and update Wikipedia data
        const { imageUrl, description } = await getWikipediaData(term);

        const imageContainer = elements.modalContent.querySelector('.modal-image-container');
        const descriptionContainer = elements.modalContent.querySelector('.description-text');

        if (imageUrl) {
            imageContainer.innerHTML = `<img src="${imageUrl}" alt="${term}" class="modal-image">`;
        } else {
            imageContainer.innerHTML = `
                <div class="modal-image-placeholder">
                    <i class="ph-duotone ph-image"></i>
                    No image available
                </div>
            `;
        }

        descriptionContainer.innerHTML = description;
    }

    // Wikipedia data fetching function (same as in main script)
    async function getWikipediaData(title) {
        try {
            const animalKeywords = 'animal species';
            const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(title)} ${animalKeywords}&format=json&origin=*`;
            let response = await fetch(searchUrl);
            let data = await response.json();

            let searchTitle = title.replace(/ /g, '_');
            let selectedResult = null;

            if (data.query.search.length > 0) {
                const animalIndicators = [
                    'species', 'animal', 'genus', 'family', 'order', 'class',
                    'mammal', 'bird', 'reptile', 'amphibian', 'fish',
                    'wildlife', 'fauna', 'creature', 'beast', 'taxonomy'
                ];

                const excludeKeywords = [
                    'company', 'brand', 'band', 'song', 'album', 'movie', 'film',
                    'book', 'novel', 'person', 'athlete', 'actor', 'politician',
                    'building', 'place', 'location', 'restaurant', 'product'
                ];

                selectedResult = data.query.search.find(result => {
                    const combinedText = (result.title + ' ' + result.snippet).toLowerCase();
                    const hasAnimalKeyword = animalIndicators.some(keyword =>
                        combinedText.includes(keyword.toLowerCase())
                    );
                    const hasExcludeKeyword = excludeKeywords.some(keyword =>
                        combinedText.includes(keyword.toLowerCase())
                    );
                    return hasAnimalKeyword && !hasExcludeKeyword;
                });

                if (selectedResult) {
                    searchTitle = selectedResult.title.replace(/ /g, '_');
                }
            }

            if (!selectedResult) {
                return {
                    imageUrl: null,
                    description: 'No animal-related information available.'
                };
            }

            const contentUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(searchTitle)}&redirects=1&prop=pageimages|extracts&exintro&explaintext&format=json&pithumbsize=1000&origin=*`;

            response = await fetch(contentUrl);
            data = await response.json();

            const pages = data.query.pages;
            const pageId = Object.keys(pages)[0];
            const page = pages[pageId];

            const imageUrl = page.thumbnail ? page.thumbnail.source : null;
            const description = page.extract ? page.extract : 'No description available.';

            return { imageUrl, description };
        } catch (error) {
            console.warn('Failed to fetch Wikipedia data:', error);
            return { imageUrl: null, description: 'No description available.' };
        }
    }

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === elements.modal) {
            elements.modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
    });

    // Add escape key listener
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && elements.modal.style.display === 'block') {
            elements.modal.style.display = 'none';
            document.body.classList.remove('modal-open');
        }
    });

    // Initialize
    loadGlossaryData();
}); 