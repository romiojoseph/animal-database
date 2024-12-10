document.addEventListener('DOMContentLoaded', () => {
    // Main Application State
    const state = {
        animals: [],
        filteredAnimals: [],
        filters: {
            taxonomyClass: '',
            taxonomyOrder: '',
            location: '',
            diet: '',
            groupBehavior: '',
            group: '',
            taxonomyFamily: '',
            taxonomyGenus: '',
            lifestyle: ''
        }
    };

    // Add this variable at the top of your script, after state declaration
    let lastScrollPosition = 0;

    // DOM Element Selectors
    const elements = {
        searchInput: document.getElementById('search-input'),
        filterTaxonomyClass: document.getElementById('filter-taxonomy-class'),
        filterTaxonomyOrder: document.getElementById('filter-taxonomy-order'),
        filterLocation: document.getElementById('filter-location'),
        filterDiet: document.getElementById('filter-diet'),
        filterGroupBehavior: document.getElementById('filter-group-behavior'),
        filterGroup: document.getElementById('filter-group'),
        cardsContainer: document.getElementById('cards-container'),
        modal: document.getElementById('animal-modal'),
        modalContent: document.getElementById('modal-content'),
        filterTaxonomyFamily: document.getElementById('filter-taxonomy-family'),
        filterTaxonomyGenus: document.getElementById('filter-taxonomy-genus'),
        filterLifestyle: document.getElementById('filter-lifestyle'),
        filterTaxonomyPhylum: document.getElementById('filter-taxonomy-phylum'),
    };

    // Add to the top of the file, after state declaration
    const CACHE_KEY = 'animalDataCache';
    const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const BATCH_SIZE = 50;  // Increased for initial load
    const BATCH_DELAY = 5;  // Reduced delay

    // Fetch CSV Data
    async function loadAnimalData() {
        try {
            elements.cardsContainer.classList.add('loading');

            // Try to get data from cache first
            const cachedData = await getCachedData();
            if (cachedData) {
                state.animals = cachedData;
                await initializeUI();
                return;
            }

            // If no cache, fetch from CSV
            const response = await fetch('assets/animals-info.csv');
            const csvText = await response.text();

            state.animals = Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true
            }).data;

            // Sort and cache the data
            state.animals.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            await cacheData(state.animals);

            await initializeUI();
        } catch (error) {
            console.error('Error loading animal data:', error);
            alert('Failed to load animal data. Please try again later.');
        }
    }

    // New caching functions
    async function getCachedData() {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (!cached) return null;

            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp > CACHE_DURATION) {
                localStorage.removeItem(CACHE_KEY);
                return null;
            }

            return data;
        } catch (error) {
            console.warn('Cache retrieval failed:', error);
            return null;
        }
    }

    async function cacheData(data) {
        try {
            const cacheObject = {
                data,
                timestamp: Date.now()
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObject));
        } catch (error) {
            console.warn('Caching failed:', error);
        }
    }

    // New function to initialize UI
    async function initializeUI() {
        // Pre-calculate filter options
        const filterOptions = preCalculateFilterOptions();

        // Start rendering cards immediately
        const renderPromise = renderCardsBatched(state.animals);

        // Populate filters with pre-calculated options
        populateFilters(filterOptions);

        // Wait for rendering to complete
        await renderPromise;
        elements.cardsContainer.classList.remove('loading');
    }

    // Pre-calculate filter options
    function preCalculateFilterOptions() {
        const options = {
            'taxonomy/class': new Set(),
            'taxonomy/order': new Set(),
            'locations': new Set(),
            'characteristics/diet': new Set(),
            'characteristics/group_behavior': new Set(),
            'characteristics/group': new Set(),
            'taxonomy/family': new Set(),
            'taxonomy/genus': new Set(),
            'characteristics/lifestyle': new Set(),
            'taxonomy/phylum': new Set(),
        };

        state.animals.forEach(animal => {
            Object.keys(options).forEach(key => {
                if (key === 'locations') {
                    for (let i = 0; i < 10; i++) {
                        const loc = animal[`locations/${i}`];
                        if (loc) options[key].add(loc);
                    }
                } else {
                    if (animal[key]) options[key].add(animal[key]);
                }
            });
        });

        return Object.fromEntries(
            Object.entries(options).map(([key, set]) => [key, [...set].sort()])
        );
    }

    // Modified populateFilters function
    function populateFilters(preCalculatedOptions) {
        const filterConfig = [
            { element: elements.filterTaxonomyClass, key: 'taxonomy/class', defaultText: 'All Classes' },
            { element: elements.filterTaxonomyOrder, key: 'taxonomy/order', defaultText: 'All Orders' },
            { element: elements.filterLocation, key: 'locations', defaultText: 'All Locations' },
            { element: elements.filterDiet, key: 'characteristics/diet', defaultText: 'All Dietary Types' },
            { element: elements.filterGroupBehavior, key: 'characteristics/group_behavior', defaultText: 'All Group Behaviors' },
            { element: elements.filterGroup, key: 'characteristics/group', defaultText: 'All Groups' },
            { element: elements.filterTaxonomyFamily, key: 'taxonomy/family', defaultText: 'All Families' },
            { element: elements.filterTaxonomyGenus, key: 'taxonomy/genus', defaultText: 'All Genera' },
            { element: elements.filterLifestyle, key: 'characteristics/lifestyle', defaultText: 'All Lifestyles' },
            { element: elements.filterTaxonomyPhylum, key: 'taxonomy/phylum', defaultText: 'All Phyla' },
        ];

        filterConfig.forEach(({ element, key, defaultText }) => {
            const uniqueValues = preCalculatedOptions[key];
            const fragment = document.createDocumentFragment();

            // Add default option
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = defaultText;
            fragment.appendChild(defaultOption);

            // Check if there are any blank values for this column
            const hasBlankValues = state.animals.some(animal => !animal[key]);

            // Add "Not available" option only if there are blank values
            if (hasBlankValues) {
                const notAvailableOption = document.createElement('option');
                notAvailableOption.value = 'Not available';
                notAvailableOption.textContent = 'Not available';
                fragment.appendChild(notAvailableOption);
            }

            // Add other options
            uniqueValues.forEach(value => {
                if (value) {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = value;
                    fragment.appendChild(option);
                }
            });

            element.innerHTML = '';
            element.appendChild(fragment);
        });
    }

    // Apply Filters and Search
    function filterAndSearch() {
        const searchTerm = elements.searchInput.value.toLowerCase().trim();

        state.filteredAnimals = state.animals.filter(animal => {
            // Filter checks
            const taxonomyClassMatch = !state.filters.taxonomyClass ||
                (animal['taxonomy/class'] === state.filters.taxonomyClass ||
                    (state.filters.taxonomyClass === 'Not available' && !animal['taxonomy/class']));

            const taxonomyOrderMatch = !state.filters.taxonomyOrder ||
                (animal['taxonomy/order'] === state.filters.taxonomyOrder ||
                    (state.filters.taxonomyOrder === 'Not available' && !animal['taxonomy/order']));

            const locationMatch = !state.filters.location ||
                Array.from({ length: 10 }).some((_, i) =>
                    animal[`locations/${i}`] === state.filters.location ||
                    (state.filters.location === 'Not available' && !animal[`locations/${i}`])
                );

            const dietMatch = !state.filters.diet ||
                (animal['characteristics/diet'] === state.filters.diet ||
                    (state.filters.diet === 'Not available' && !animal['characteristics/diet']));

            const groupBehaviorMatch = !state.filters.groupBehavior ||
                (animal['characteristics/group_behavior'] === state.filters.groupBehavior ||
                    (state.filters.groupBehavior === 'Not available' && !animal['characteristics/group_behavior']));

            const groupMatch = !state.filters.group ||
                (animal['characteristics/group'] === state.filters.group ||
                    (state.filters.group === 'Not available' && !animal['characteristics/group']));

            const taxonomyFamilyMatch = !state.filters.taxonomyFamily ||
                (animal['taxonomy/family'] === state.filters.taxonomyFamily ||
                    (state.filters.taxonomyFamily === 'Not available' && !animal['taxonomy/family']));

            const taxonomyGenusMatch = !state.filters.taxonomyGenus ||
                (animal['taxonomy/genus'] === state.filters.taxonomyGenus ||
                    (state.filters.taxonomyGenus === 'Not available' && !animal['taxonomy/genus']));

            const lifestyleMatch = !state.filters.lifestyle ||
                (animal['characteristics/lifestyle'] === state.filters.lifestyle ||
                    (state.filters.lifestyle === 'Not available' && !animal['characteristics/lifestyle']));

            const taxonomyPhylumMatch = !state.filters.taxonomyPhylum ||
                (animal['taxonomy/phylum'] === state.filters.taxonomyPhylum ||
                    (state.filters.taxonomyPhylum === 'Not available' && !animal['taxonomy/phylum']));

            // Search only in name column
            const searchMatch = !searchTerm ||
                (animal.name && animal.name.toLowerCase().includes(searchTerm));

            return taxonomyClassMatch &&
                taxonomyOrderMatch &&
                locationMatch &&
                dietMatch &&
                groupBehaviorMatch &&
                groupMatch &&
                taxonomyFamilyMatch &&
                taxonomyGenusMatch &&
                lifestyleMatch &&
                taxonomyPhylumMatch &&
                searchMatch;
        });

        renderCardsBatched(state.filteredAnimals);
    }

    // Render Animal Cards
    function renderCards(animals) {
        elements.cardsContainer.innerHTML = '';

        animals.forEach(animal => {
            const card = document.createElement('div');
            card.className = 'animal-card';
            card.innerHTML = `
                <div class="card-content">
                    <div class="card-header">
                        <h3>${animal.name || 'Unnamed'}</h3>
                        <p class="monospace">${animal['taxonomy/scientific_name'] || 'Not specified'}</p>
                    </div>
                    <div class="card-body">
                        <p><strong>Class:</strong> ${animal['taxonomy/class'] || 'Not specified'}</p>
                        <p><strong>Order:</strong> ${animal['taxonomy/order'] || 'Not specified'}</p>
                        <p><strong>Family:</strong> ${animal['taxonomy/family'] || 'Not specified'}</p>
                        <p><strong>Genus:</strong> ${animal['taxonomy/genus'] || 'Not specified'}</p>
                        <p><strong>Location:</strong> ${animal['locations/0'] || 'Not specified'}</p>
                    </div>
                </div>
                <div class="card-hover-buttons">
                    <button onclick="window.open('https://www.google.com/search?q=${encodeURIComponent(animal.name)}&tbm=isch', '_blank'); event.stopPropagation();"><img src="assets/google.svg" height="24" alt="Google"></button>
                    <button onclick="window.open('https://www.bing.com/images/search?q=${encodeURIComponent(animal.name)}', '_blank'); event.stopPropagation();"><img src="assets/bing.svg" height="24" alt="Bing"></button>
                    <button onclick="window.open('https://duckduckgo.com/?q=!i+${encodeURIComponent(animal.name)}', '_blank'); event.stopPropagation();"><img src="assets/ddg.svg" height="24" alt="DuckDuckGo"></button>
                </div>
            `;
            card.addEventListener('click', () => openModal(animal));
            elements.cardsContainer.appendChild(card);
        });
    }

    // Open Modal with Detailed Animal Information
    async function openModal(animal) {
        if (!animal || !animal.name) return;

        // Store the current scroll position
        lastScrollPosition = window.scrollY;
        document.body.classList.add('modal-open');
        document.body.style.top = `-${lastScrollPosition}px`;

        const wikiUrl = `https://en.wikipedia.org/wiki/${animal.name.replace(/ /g, '_')}`;

        // Helper function for formatting locations
        const formatLocations = () => {
            const locations = [];
            for (let i = 0; i < 10; i++) {
                const loc = animal[`locations/${i}`];
                if (loc) locations.push(loc);
            }
            return locations.length ? locations.join(', ') : '<span class="not-specified">Not specified</span>';
        };

        elements.modalContent.innerHTML = `
            <div class="modal-header">
                <h2>${animal.name}</h2>
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
            <div class="wiki-info-monospace">
                The application attempts to find animal-related content on Wikipedia by searching using the animal's name, prioritizing relevant pages and filtering out unrelated topics. However, if no animal-specific information is available, some details may be missing. Occasionally, results may be unrelated due to similar names or limited information on Wikipedia.
            </div>

            <div class="modal-body">
                <div class="horizontal">
                    <div class="image-search-buttons">
                        <p>View more detailed info on:</p>
                        <a href="${wikiUrl}" target="_blank"><img src="assets/wikipedia.svg" height="24" alt="Wikipedia"></a>
                    </div>
                    <div class="image-search-buttons">
                        <p>View images on:</p>
                        <button onclick="window.open('https://www.google.com/search?q=${encodeURIComponent(animal.name)}&tbm=isch', '_blank')"><img src="assets/google.svg" height="24" alt="Google"></button>
                        <button onclick="window.open('https://www.bing.com/images/search?q=${encodeURIComponent(animal.name)}', '_blank')"><img src="assets/bing.svg" height="24" alt="Bing"></button>
                        <button onclick="window.open('https://duckduckgo.com/?q=!i+${encodeURIComponent(animal.name)}', '_blank')"><img src="assets/ddg.svg" height="24" alt="DuckDuckGo"></button>
                    </div>
                </div>

                <section class="modal-section">
                    <h3>• Identification</h3>
                    <ul>
                        <li><strong>Name:</strong> ${getSafeValue(animal.name)}</li>
                        <li><strong>Scientific Name:</strong> ${getSafeValue(animal['taxonomy/scientific_name'])}</li>
                        <li><strong>Kingdom:</strong> ${getSafeValue(animal['taxonomy/kingdom'])}</li>
                        <li><strong>Phylum:</strong> ${getSafeValue(animal['taxonomy/phylum'])}</li>
                        <li><strong>Class:</strong> ${getSafeValue(animal['taxonomy/class'])}</li>
                        <li><strong>Order:</strong> ${getSafeValue(animal['taxonomy/order'])}</li>
                        <li><strong>Family:</strong> ${getSafeValue(animal['taxonomy/family'])}</li>
                        <li><strong>Genus:</strong> ${getSafeValue(animal['taxonomy/genus'])}</li>
                        <li><strong>Common Name:</strong> ${getSafeValue(animal['characteristics/common_name'])}</li>
                        <li><strong>Other Names:</strong> ${getSafeValue(animal['characteristics/other_name(s)'])}</li>
                    </ul>
                </section>

                <section class="modal-section">
                    <h3>• Location</h3>
                    <ul>
                        <li><strong>Locations:</strong> ${formatLocations()}</li>
                        <li><strong>Specific Location:</strong> ${getSafeValue(animal['characteristics/location'])}</li>
                    </ul>
                </section>

                <section class="modal-section">
                    <h3>• Physical Characteristics</h3>
                    <ul>
                        <li><strong>Color:</strong> ${getSafeValue(animal['characteristics/color'], 'characteristics/color')}</li>
                        <li><strong>Skin Type:</strong> ${getSafeValue(animal['characteristics/skin_type'])}</li>
                        <li><strong>Height:</strong> ${getSafeValue(animal['characteristics/height'])}</li>
                        <li><strong>Length:</strong> ${getSafeValue(animal['characteristics/length'])}</li>
                        <li><strong>Weight:</strong> ${getSafeValue(animal['characteristics/weight'])}</li>
                        <li><strong>Top Speed:</strong> ${getSafeValue(animal['characteristics/top_speed'])}</li>
                        <li><strong>Wingspan:</strong> ${getSafeValue(animal['characteristics/wingspan'])}</li>
                        <li><strong>Distinctive Feature:</strong> ${getSafeValue(animal['characteristics/distinctive_feature'])}</li>
                    </ul>
                </section>

                <section class="modal-section">
                    <h3>• Lifecycle and Behavior</h3>
                    <ul>
                        <li><strong>Young Name:</strong> ${getSafeValue(animal['characteristics/name_of_young'])}</li>
                        <li><strong>Group Behavior:</strong> ${getSafeValue(animal['characteristics/group_behavior'])}</li>
                        <li><strong>Lifestyle:</strong> ${getSafeValue(animal['characteristics/lifestyle'])}</li>
                        <li><strong>Group:</strong> ${getSafeValue(animal['characteristics/group'])}</li>
                        <li><strong>Sexual Maturity:</strong> ${getSafeValue(animal['characteristics/age_of_sexual_maturity'])}</li>
                        <li><strong>Weaning Age:</strong> ${getSafeValue(animal['characteristics/age_of_weaning'])}</li>
                        <li><strong>Fledgling Age:</strong> ${getSafeValue(animal['characteristics/age_of_fledgling'])}</li>
                        <li><strong>Independence Age:</strong> ${getSafeValue(animal['characteristics/age_of_independence'])}</li>
                        <li><strong>Molting Age:</strong> ${getSafeValue(animal['characteristics/age_of_molting'])}</li>
                    </ul>
                </section>

                <section class="modal-section">
                    <h3>• Reproduction</h3>
                    <ul>
                        <li><strong>Gestation Period:</strong> ${getSafeValue(animal['characteristics/gestation_period'])}</li>
                        <li><strong>Average Litter Size:</strong> ${getSafeValue(animal['characteristics/average_litter_size'])}</li>
                        <li><strong>Litter Size:</strong> ${getSafeValue(animal['characteristics/litter_size'])}</li>
                        <li><strong>Incubation Period:</strong> ${getSafeValue(animal['characteristics/incubation_period'])}</li>
                        <li><strong>Average Clutch Size:</strong> ${getSafeValue(animal['characteristics/average_clutch_size'])}</li>
                        <li><strong>Average Spawn Size:</strong> ${getSafeValue(animal['characteristics/average_spawn_size'])}</li>
                        <li><strong>Nesting Location:</strong> ${getSafeValue(animal['characteristics/nesting_location'])}</li>
                    </ul>
                </section>

                <section class="modal-section">
                    <h3>• Habitat and Diet</h3>
                    <ul>
                        <li><strong>Habitat:</strong> ${getSafeValue(animal['characteristics/habitat'])}</li>
                        <li><strong>Diet:</strong> ${getSafeValue(animal['characteristics/diet'])}</li>
                        <li><strong>Main Prey:</strong> ${getSafeValue(animal['characteristics/main_prey'])}</li>
                        <li><strong>Favorite Food:</strong> ${getSafeValue(animal['characteristics/favorite_food'])}</li>
                        <li><strong>Water Type:</strong> ${getSafeValue(animal['characteristics/water_type'])}</li>
                        <li><strong>Optimum pH Level:</strong> ${getSafeValue(animal['characteristics/optimum_ph_level'])}</li>
                    </ul>
                </section>

                <section class="modal-section">
                    <h3>• Population and Threats</h3>
                    <ul>
                        <li><strong>Estimated Population:</strong> ${getSafeValue(animal['characteristics/estimated_population_size'])}</li>
                        <li><strong>Biggest Threat:</strong> ${getSafeValue(animal['characteristics/biggest_threat'])}</li>
                        <li><strong>Predators:</strong> ${getSafeValue(animal['characteristics/predators'])}</li>
                        <li><strong>Migratory:</strong> ${getSafeValue(animal['characteristics/migratory'])}</li>
                    </ul>
                </section>

                <section class="modal-section">
                    <h3>• Special Features</h3>
                    <ul>
                        <li><strong>Slogan:</strong> ${getSafeValue(animal['characteristics/slogan'])}</li>
                        <li><strong>Special Features:</strong> ${getSafeValue(animal['characteristics/special_features'])}</li>
                        <li><strong>Temperament:</strong> ${getSafeValue(animal['characteristics/temperament'])}</li>
                        <li><strong>Training:</strong> ${getSafeValue(animal['characteristics/training'])}</li>
                        <li><strong>Venomous:</strong> ${getSafeValue(animal['characteristics/venomous'])}</li>
                        <li><strong>Aggression:</strong> ${getSafeValue(animal['characteristics/aggression'])}</li>
                        <li><strong>Type:</strong> ${getSafeValue(animal['characteristics/type'])}</li>
                        <li><strong>Origin:</strong> ${getSafeValue(animal['characteristics/origin'])}</li>
                    </ul>
                </section>

                <section class="modal-section">
                    <h3>• Lifespan and Growth</h3>
                    <ul>
                        <li><strong>Lifespan:</strong> ${getSafeValue(animal['characteristics/lifespan'])}</li>
                    </ul>
                </section>
            </div>
        `;

        // Show the modal
        elements.modal.style.display = 'block';

        // Add event listener to close button
        document.getElementById('modal-close').addEventListener('click', () => {
            elements.modal.style.display = 'none';
            document.body.classList.remove('modal-open');
            document.body.style.top = '';
            window.scrollTo(0, lastScrollPosition);
        });

        // Fetch and update the image and description after modal is shown
        const { imageUrl, description } = await getWikipediaData(animal.name);
        const imageContainer = elements.modalContent.querySelector('.modal-image-container');
        const descriptionContainer = elements.modalContent.querySelector('.description-text');

        if (imageUrl) {
            imageContainer.innerHTML = `<img src="${imageUrl}" alt="${animal.name}" class="modal-image">`;
        } else {
            imageContainer.innerHTML = `
                <div class="modal-image-placeholder">
                    <i class="ph-duotone ph-image"></i>
                    No image available
                </div>
            `;
        }

        const shortDescription = description.length > 300
            ? `${description.substring(0, 297)}... <a href="${wikiUrl}" target="_blank">Read more on Wikipedia</a>`
            : description;

        descriptionContainer.innerHTML = shortDescription;
    }

    // Event Listeners for Filters and Search
    elements.searchInput.addEventListener('input', filterAndSearch);
    elements.filterTaxonomyClass.addEventListener('change', (e) => {
        state.filters.taxonomyClass = e.target.value;
        filterAndSearch();
    });
    elements.filterTaxonomyOrder.addEventListener('change', (e) => {
        state.filters.taxonomyOrder = e.target.value;
        filterAndSearch();
    });
    elements.filterLocation.addEventListener('change', (e) => {
        state.filters.location = e.target.value;
        filterAndSearch();
    });
    elements.filterDiet.addEventListener('change', (e) => {
        state.filters.diet = e.target.value;
        filterAndSearch();
    });
    elements.filterGroupBehavior.addEventListener('change', (e) => {
        state.filters.groupBehavior = e.target.value;
        filterAndSearch();
    });
    elements.filterGroup.addEventListener('change', (e) => {
        state.filters.group = e.target.value;
        filterAndSearch();
    });
    elements.filterTaxonomyFamily.addEventListener('change', (e) => {
        state.filters.taxonomyFamily = e.target.value;
        filterAndSearch();
    });
    elements.filterTaxonomyGenus.addEventListener('change', (e) => {
        state.filters.taxonomyGenus = e.target.value;
        filterAndSearch();
    });
    elements.filterLifestyle.addEventListener('change', (e) => {
        state.filters.lifestyle = e.target.value;
        filterAndSearch();
    });
    elements.filterTaxonomyPhylum.addEventListener('change', (e) => {
        state.filters.taxonomyPhylum = e.target.value;
        filterAndSearch();
    });

    // Close modal when clicking outside of it
    window.addEventListener('click', (event) => {
        if (event.target === elements.modal) {
            elements.modal.style.display = 'none';
            document.body.classList.remove('modal-open');
            document.body.style.top = '';
            window.scrollTo(0, lastScrollPosition);
        }
    });

    // Add escape key listener
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && elements.modal.style.display === 'block') {
            elements.modal.style.display = 'none';
            document.body.classList.remove('modal-open');
            document.body.style.top = '';
            window.scrollTo(0, lastScrollPosition);
        }
    });

    // Initial Data Load
    loadAnimalData();

    // Optimized batched rendering
    async function renderCardsBatched(animals) {
        elements.cardsContainer.innerHTML = '';

        // Create document fragment for better performance
        const fragment = document.createDocumentFragment();

        // Process animals in smaller batches
        for (let i = 0; i < animals.length; i += BATCH_SIZE) {
            const batch = animals.slice(i, i + BATCH_SIZE);

            await new Promise(resolve => {
                setTimeout(() => {
                    batch.forEach(animal => {
                        const card = document.createElement('div');
                        card.className = 'animal-card';
                        // Use template literal only for necessary dynamic content
                        card.innerHTML = getCardHTML(animal);
                        card.addEventListener('click', () => openModal(animal));
                        fragment.appendChild(card);
                    });

                    if (i + BATCH_SIZE >= animals.length) {
                        elements.cardsContainer.appendChild(fragment);
                    }

                    resolve();
                }, BATCH_DELAY);
            });
        }
    }

    // Separate HTML template function for better performance
    function getCardHTML(animal) {
        return `
            <div class="card-content">
                <div class="card-header">
                    <h3>${animal.name || '<span class="not-specified">Unnamed</span>'}</h3>
                    <p class="monospace">${animal['taxonomy/scientific_name'] ? animal['taxonomy/scientific_name'] : '<span class="not-specified">Not specified</span>'}</p>
                </div>
                <div class="card-body">
                    <p><strong>Class:</strong> ${animal['taxonomy/class'] ? animal['taxonomy/class'] : '<span class="not-specified">Not specified</span>'}</p>
                    <p><strong>Order:</strong> ${animal['taxonomy/order'] ? animal['taxonomy/order'] : '<span class="not-specified">Not specified</span>'}</p>
                    <p><strong>Family:</strong> ${animal['taxonomy/family'] ? animal['taxonomy/family'] : '<span class="not-specified">Not specified</span>'}</p>
                    <p><strong>Genus:</strong> ${animal['taxonomy/genus'] ? animal['taxonomy/genus'] : '<span class="not-specified">Not specified</span>'}</p>
                    <p><strong>Location:</strong> ${animal['locations/0'] ? animal['locations/0'] : '<span class="not-specified">Not specified</span>'}</p>
                </div>
            </div>
            <div class="card-hover-buttons">
                <button onclick="window.open('https://www.google.com/search?q=${encodeURIComponent(animal.name)}&tbm=isch', '_blank'); event.stopPropagation();"><img src="assets/google.svg" height="24" alt="Google"></button>
                <button onclick="window.open('https://www.bing.com/images/search?q=${encodeURIComponent(animal.name)}', '_blank'); event.stopPropagation();"><img src="assets/bing.svg" height="24" alt="Bing"></button>
                <button onclick="window.open('https://duckduckgo.com/?q=!i+${encodeURIComponent(animal.name)}', '_blank'); event.stopPropagation();"><img src="assets/ddg.svg" height="24" alt="DuckDuckGo"></button>
            </div>
        `;
    }

    // Add debouncing for search input
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Use debounced search
    const debouncedFilterAndSearch = debounce(filterAndSearch, 300);
    elements.searchInput.addEventListener('input', debouncedFilterAndSearch);

    function getSafeValue(value, key) {
        if (!value) return '<span class="not-specified">Not specified</span>';

        // Special handling for characteristics/color
        if (key === 'characteristics/color') {
            return value.split(/(?=[A-Z])/).join(', ');
        }

        return value;
    }

    // Add this new function after the existing functions
    async function getWikipediaImage(title) {
        try {
            // First try exact match
            const searchTitle = title.replace(/ /g, '_');
            const exactMatchUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${searchTitle}&prop=pageimages&format=json&pithumbsize=1000&origin=*`;

            let response = await fetch(exactMatchUrl);
            let data = await response.json();
            let pages = data.query.pages;
            let pageId = Object.keys(pages)[0];

            // If exact match has image, return it
            if (pages[pageId].thumbnail) {
                return pages[pageId].thumbnail.source;
            }

            // If no exact match image, try search API
            const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(title)}&format=json&origin=*`;
            response = await fetch(searchUrl);
            data = await response.json();

            if (data.query.search.length > 0) {
                const firstResult = data.query.search[0].title.replace(/ /g, '_');
                const secondTryUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${firstResult}&prop=pageimages&format=json&pithumbsize=1000&origin=*`;

                response = await fetch(secondTryUrl);
                data = await response.json();
                pages = data.query.pages;
                pageId = Object.keys(pages)[0];

                if (pages[pageId].thumbnail) {
                    return pages[pageId].thumbnail.source;
                }
            }

            return null;
        } catch (error) {
            console.warn('Failed to fetch Wikipedia image:', error);
            return null;
        }
    }

    // Add this new function after your existing functions
    async function getWikipediaData(title) {
        try {
            const animalKeywords = 'animal species';
            const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(title)} ${animalKeywords}&format=json&origin=*`;
            let response = await fetch(searchUrl);
            let data = await response.json();

            let searchTitle = title.replace(/ /g, '_');
            let selectedResult = null;

            if (data.query.search.length > 0) {
                // Keep all existing keywords exactly as they are
                const animalIndicators = [
                    'species', 'animal', 'genus', 'family', 'order', 'class',
                    'mammal', 'bird', 'reptile', 'amphibian', 'fish',
                    'wildlife', 'fauna', 'creature', 'beast', 'taxonomy', 'insect', 'dog', 'cat', 'horse', 'bird', 'fish', 'reptile', 'amphibian', 'mammal'
                ];

                // Keep all existing exclude keywords exactly as they are
                const excludeKeywords = [
                    'company', 'brand', 'band', 'song', 'album', 'movie', 'film',
                    'book', 'novel', 'person', 'athlete', 'actor', 'politician',
                    'building', 'place', 'location', 'restaurant', 'product', 'people', 'map', 'country', 'cuisine', 'ritual'
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

            // If no result found with title, try with common_name if available
            if (!selectedResult && animal && animal['characteristics/common_name']) {
                const commonNameUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(animal['characteristics/common_name'])} ${animalKeywords}&format=json&origin=*`;
                response = await fetch(commonNameUrl);
                data = await response.json();

                if (data.query.search.length > 0) {
                    selectedResult = data.query.search[0];
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
});