document.addEventListener('DOMContentLoaded', () => {
    const filterToggleButton = document.getElementById('mobile-filter-toggle');
    const filterSidebar = document.getElementById('filter-sidebar');
    const productGrid = document.getElementById('product-grid-container');
    const paginationContainer = document.getElementById('pagination-container')?.querySelector('ul');
    const filterForm = document.getElementById('filter-form');
    const sortSelect = document.getElementById('sort-by');
    const productCountElement = document.getElementById('product-count-value');
    const loadingIndicator = document.getElementById('loading-indicator');
    const noProductsMessageEl = document.getElementById('no-products-message');
    const cartIcon = document.querySelector('.header-cart a');
    const priceFromInput = document.getElementById('price-from');
    const priceToInput = document.getElementById('price-to');
    const activeFiltersContainer = document.getElementById('active-filters-container');

    let currentPage = 1;
    let debounceTimer;

    if (filterToggleButton && filterSidebar) {
        filterToggleButton.addEventListener('click', () => {
            filterSidebar.classList.toggle('filter-sidebar-visible');
            const isVisible = filterSidebar.classList.contains('filter-sidebar-visible');
            filterToggleButton.setAttribute('aria-expanded', String(isVisible));
        });
    }

    async function fetchProducts(page = 1, params = {}, scroll = true) {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        if (productGrid) productGrid.innerHTML = '';
        if (noProductsMessageEl) noProductsMessageEl.classList.add('is-hidden');
        if (paginationContainer) paginationContainer.innerHTML = '';

        const queryParams = new URLSearchParams(params);
        queryParams.set('page', page);
        queryParams.set('limit', 12);

        if (filterForm) {
            const formData = new FormData(filterForm);
            const priceFrom = formData.get('price_from');
            const priceTo = formData.get('price_to');
            if (priceFrom) queryParams.set('price_from', priceFrom);
            if (priceTo) queryParams.set('price_to', priceTo);
            formData.getAll('status').forEach(status => queryParams.append('status', status));
            formData.getAll('tags').forEach(tag => queryParams.append('tags', tag));
        }
        if (sortSelect) {
            queryParams.set('sort', sortSelect.value);
        }

        try {
            const response = await fetch(`/api/products?${queryParams.toString()}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            if (productCountElement) {
                productCountElement.textContent = data.totalProducts || 0;
            }

            renderProducts(data.products);
            renderPagination(data.currentPage, data.totalPages);
            currentPage = data.currentPage;

            if (typeof AOS !== 'undefined') {
                 AOS.refresh();
            }

            if (scroll) {
                const sortControlsElement = document.querySelector('.sorting-controls');
                if (sortControlsElement) {
                    const headerOffset = 80;
                    const elementPosition = sortControlsElement.getBoundingClientRect().top + window.pageYOffset;
                    const offsetPosition = elementPosition - headerOffset;
                    window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
                }
            }
        } catch (error) {
            console.error('Error fetching products:', error);
            if (productGrid) productGrid.innerHTML = '<p style="grid-column: 1 / -1; color: red;">Помилка завантаження товарів.</p>';
            if (noProductsMessageEl) noProductsMessageEl.classList.remove('is-hidden');
        } finally {
            if (loadingIndicator) loadingIndicator.style.display = 'none';
        }
    }

    function renderProducts(products) {
        if (!productGrid) return;
        productGrid.innerHTML = '';

        if (!products || products.length === 0) {
            if (noProductsMessageEl) noProductsMessageEl.classList.remove('is-hidden');
            if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }

        if (noProductsMessageEl) noProductsMessageEl.classList.add('is-hidden');

        let productHTML = '';
        products.forEach((product, index) => {
            const productId = product._id || '';
            const productName = product.name || 'Назва товару';
            const productPrice = product.price || 'N/A';
            const productImage = product.images && product.images.length > 0 ? product.images[0] : '/images/placeholder.png';
            productHTML += `
                <article class="product-card" data-aos="fade-up" data-aos-delay="${index * 50}" data-aos-once="true">
                    <div class="product-image-wrapper">
                        <a href="/product/${productId}" aria-label="Переглянути деталі товару ${productName}">
                             <img class="product-card-image" src="${productImage}"
                                  alt="${productName}"
                                  loading="lazy"
                                  ${index === 0 ? 'fetchpriority="high"' : ''}
                                  onerror="this.onerror=null; this.src='/images/placeholder.png';">
                            <div class="product-overlay"><span class="view-details-btn">Детальніше</span></div>
                        </a>
                    </div>
                    <div class="product-info">
                         <a href="/product/${productId}"><h3>${productName}</h3></a>
                        <p class="price">${productPrice} грн</p>
                        <button class="btn btn-tertiary add-to-cart-button" data-product-id="${productId}" aria-label="Додати ${productName} в кошик">
                            <svg class="icon icon-cart-plus" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor">
                                <path d="M0 24C0 10.7 10.7 0 24 0L69.5 0c22 0 41.5 12.8 50.6 32l411 0c26.3 0 45.5 25 38.6 50.4l-41 152.3c-8.5 31.4-37 53.3-69.5 53.3l-288.5 0 5.4 28.5c2.2 11.3 12.1 19.5 23.6 19.5L488 336c13.3 0 24 10.7 24 24s-10.7 24-24 24l-288.3 0c-34.6 0-64.3-24.6-70.7-58.5L77.4 54.5c-.7-3.8-4-6.5-7.9-6.5L24 48C10.7 48 0 37.3 0 24zM128 464a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zm336-48a48 48 0 1 1 0 96 48 48 0 1 1 0-96zM252 160c0 11 9 20 20 20l44 0 0 44c0 11 9 20 20 20s20-9 20-20l0-44 44 0c11 0 20-9 20-20s-9-20-20-20l-44 0 0-44c0-11-9-20-20-20s-20 9-20 20l0 44-44 0c-11 0-20 9-20 20z"/>
                            </svg>
                            В кошик
                        </button>
                    </div>
                </article>
            `;
        });
        productGrid.innerHTML = productHTML;
    }

    function renderPagination(currentPage, totalPages) {
        if (!paginationContainer || totalPages <= 1) {
            if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }
        paginationContainer.innerHTML = '';
        const delta = 1;
        const range = [];
        const rangeWithDots = [];
        range.push(1);
        if (totalPages > 1) {
            let left = Math.max(2, currentPage - delta);
            let right = Math.min(totalPages - 1, currentPage + delta);
            if (currentPage - delta <= 2) right = Math.min(totalPages - 1, 1 + delta * 2);
            if (currentPage + delta >= totalPages - 1) left = Math.max(2, totalPages - delta * 2);
            left = Math.min(left, right);
            for (let i = left; i <= right; i++) range.push(i);
            range.push(totalPages);
        }
        const uniqueRange = [...new Set(range)].sort((a, b) => a - b);
        let l;
        uniqueRange.forEach(i => {
            if (l) {
                if (i - l === 2)
                    rangeWithDots.push(l + 1);
                else if (i - l > 1)
                    rangeWithDots.push('...');
            }
            rangeWithDots.push(i);
            l = i;
        });
        const fragment = document.createDocumentFragment();
        const prevLi = document.createElement('li');
        prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
        prevLi.innerHTML = `<button type="button" class="page-link prev" data-page="${currentPage - 1}" aria-label="Попередня">&laquo;</button>`;
        fragment.appendChild(prevLi);
        rangeWithDots.forEach(page => {
            const li = document.createElement('li');
            li.className = `page-item ${page === currentPage ? 'active' : ''} ${page === '...' ? 'disabled' : ''}`;
            li.innerHTML = page === '...' ? `<span class="page-link dots">...</span>` : `<button type="button" class="page-link" data-page="${page}">${page}</button>`;
            fragment.appendChild(li);
        });
        const nextLi = document.createElement('li');
        nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
        nextLi.innerHTML = `<button type="button" class="page-link next" data-page="${currentPage + 1}" aria-label="Наступна">&raquo;</button>`;
        fragment.appendChild(nextLi);
        paginationContainer.appendChild(fragment);
    }

    function updateActiveFiltersDisplay() {
        if (!activeFiltersContainer || !filterForm) return;
        activeFiltersContainer.innerHTML = '';
        const checkedTags = filterForm.querySelectorAll('input[name="tags"]:checked');
        let hasActiveTags = false;
        checkedTags.forEach(checkbox => {
            const label = filterForm.querySelector(`label[for="${checkbox.id}"]`);
            const labelText = label ? label.textContent.trim() : checkbox.value;
            const tagValue = checkbox.value;
            if (labelText) {
                const tagElement = document.createElement('span');
                tagElement.className = 'active-filter-tag';
                const textNode = document.createTextNode(labelText + ' ');
                tagElement.appendChild(textNode);
                const removeButton = document.createElement('button');
                removeButton.type = 'button';
                removeButton.className = 'remove-tag-btn';
                removeButton.dataset.tagValue = tagValue;
                removeButton.setAttribute('aria-label', `Видалити фільтр ${labelText}`);
                removeButton.innerHTML = '&times;';
                tagElement.appendChild(removeButton);
                activeFiltersContainer.appendChild(tagElement);
                hasActiveTags = true;
            }
        });
        activeFiltersContainer.style.display = hasActiveTags ? 'flex' : 'none';
    }

    if (filterForm) {
        filterForm.addEventListener('change', (event) => {
            updateActiveFiltersDisplay();
            if (event.target.type === 'checkbox' || event.target.tagName === 'SELECT') {
                const isMobileView = window.innerWidth <= 992;
                const shouldScroll = !(isMobileView && filterSidebar?.classList.contains('filter-sidebar-visible'));
                fetchProducts(1, {}, shouldScroll);
                if (isMobileView && filterSidebar?.classList.contains('filter-sidebar-visible')) {
                    setTimeout(() => {
                       filterSidebar.classList.remove('filter-sidebar-visible');
                       if (filterToggleButton) filterToggleButton.setAttribute('aria-expanded', 'false');
                    }, 300);
                }
            }
        });
        const clearFiltersButton = filterForm.querySelector('.clear-filters-btn');
        if (clearFiltersButton) {
             clearFiltersButton.addEventListener('click', () => {
                filterForm.reset();
                updateActiveFiltersDisplay();
                fetchProducts(1);
                const isMobileView = window.innerWidth <= 992;
                 if (isMobileView && filterSidebar?.classList.contains('filter-sidebar-visible')) {
                     filterSidebar.classList.remove('filter-sidebar-visible');
                     if (filterToggleButton) filterToggleButton.setAttribute('aria-expanded', 'false');
                 }
            });
        }
    }

    function handlePriceEnter(event) {
        if (event.key === 'Enter') {
            console.log('Enter pressed on price input');
            event.preventDefault();
            const isMobileView = window.innerWidth <= 992;
            const shouldScroll = !(isMobileView && filterSidebar?.classList.contains('filter-sidebar-visible'));
            fetchProducts(1, {}, shouldScroll);
            event.target.blur();
            if (isMobileView && filterSidebar?.classList.contains('filter-sidebar-visible')) {
                 setTimeout(() => {
                    filterSidebar.classList.remove('filter-sidebar-visible');
                    if (filterToggleButton) filterToggleButton.setAttribute('aria-expanded', 'false');
                 }, 300);
             }
        }
    }

    if (priceFromInput) {
        priceFromInput.addEventListener('keydown', handlePriceEnter);
    }
    if (priceToInput) {
        priceToInput.addEventListener('keydown', handlePriceEnter);
    }

    if (sortSelect && !filterForm?.contains(sortSelect)) {
        sortSelect.addEventListener('change', () => fetchProducts(1));
    }

    if (paginationContainer) {
        paginationContainer.addEventListener('click', (event) => {
           const targetButton = event.target.closest('.page-link:not(.dots)');
           if (targetButton && !targetButton.closest('.page-item.disabled') && !targetButton.closest('.page-item.active')) {
               event.preventDefault();
               const page = parseInt(targetButton.dataset.page);
               if (!isNaN(page)) fetchProducts(page);
           }
       });
    }

    if (activeFiltersContainer) {
        activeFiltersContainer.addEventListener('click', (event) => {
            const clickedTagBadge = event.target.closest('.active-filter-tag');
            if (clickedTagBadge) {
                const removeButton = clickedTagBadge.querySelector('.remove-tag-btn');
                if (removeButton) {
                    const tagValueToRemove = removeButton.dataset.tagValue;
                    const checkboxToUncheck = filterForm?.querySelector(`input[name="tags"][value="${CSS.escape(tagValueToRemove)}"]`);
                    if (checkboxToUncheck) {
                        checkboxToUncheck.checked = false;
                        updateActiveFiltersDisplay();
                        fetchProducts(1);
                    } else {
                        console.warn(`Checkbox for tag value "${tagValueToRemove}" not found.`);
                    }
                } else {
                     console.warn(`Remove button not found within the clicked tag badge.`);
                }
            }
        });
    }

    if (productGrid) {
        productGrid.addEventListener('click', async (event) => {
            const button = event.target.closest('.add-to-cart-button');
            if (!button) return;
            const productId = button.dataset.productId;
            if (!productId) return;
            const quantity = 1;
            const originalButtonContent = button.innerHTML;
            button.disabled = true;
            button.innerHTML = 'Додаємо...';
            try {
                const response = await fetch('/cart/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ productId, quantity }),
                });
                if (!response.ok) {
                    let errorMsg = `HTTP error ${response.status}`;
                    try { 
                        const errorData = await response.json(); 
                        errorMsg = errorData.message || errorMsg; 
                    } catch (e) {}
                    throw new Error(errorMsg);
                }
                const data = await response.json();
                if (data.success) {
                    const productCard = button.closest('.product-card');
                    const productImage = productCard?.querySelector('.product-card-image');
                    if (productImage && cartIcon) {
                        try {
                            const imgRect = productImage.getBoundingClientRect();
                            const cartRect = cartIcon.getBoundingClientRect();
                            const flyer = productImage.cloneNode(true);
                            flyer.classList.remove('aos-animate');
                            flyer.classList.add('product-image-flyer');
                            Object.assign(flyer.style, {
                                position: 'fixed', top: `${imgRect.top}px`, left: `${imgRect.left}px`,
                                width: `${imgRect.width}px`, height: `${imgRect.height}px`,
                                opacity: '1', transform: 'scale(1) rotate(0deg)', borderRadius: '8px', margin: '0', zIndex: '1100'
                            });
                            document.body.appendChild(flyer);
                            const targetX = cartRect.left + cartRect.width / 2 - (imgRect.width * 0.1) / 2;
                            const targetY = cartRect.top + cartRect.height / 2 - (imgRect.height * 0.1) / 2;
                            const finalTransform = `translate(${targetX - imgRect.left}px, ${targetY - imgRect.top}px) scale(0.1) rotate(480deg)`;
                            flyer.style.setProperty('--fly-target-transform', finalTransform);
                            requestAnimationFrame(() => {
                                flyer.classList.add('animate');
                            });
                            setTimeout(() => {
                                if (cartIcon) {
                                    cartIcon.classList.add('cart-shake');
                                    setTimeout(() => {
                                        if (cartIcon) cartIcon.classList.remove('cart-shake');
                                    }, 600);
                                }
                            }, 600);
                            setTimeout(() => { if (document.body.contains(flyer)) flyer.remove(); }, 800);
                        } catch (animError) { console.error("Error during fly animation:", animError); }
                    } else {
                        console.warn("Could not find product image or cart icon for animation.");
                    }
                    if (typeof updateCartCounter === 'function') updateCartCounter(data.cartItemCount);
                    button.innerHTML = 'Додано!';
                    setTimeout(() => {
                         if (document.body.contains(button) && button.innerHTML === 'Додано!') {
                            button.innerHTML = originalButtonContent;
                            button.disabled = false;
                         }
                     }, 2000);
                } else {
                    console.error('Failed to add item:', data.message);
                    alert(`Помилка: ${data.message || 'Не вдалося додати товар.'}`);
                    button.innerHTML = originalButtonContent;
                    button.disabled = false;
                }
            } catch (error) {
                console.error('Error adding to cart:', error);
                alert(`Помилка: ${error.message || 'Не вдалося з\'єднатися з сервером.'}`);
                if (document.body.contains(button)) {
                    button.innerHTML = originalButtonContent;
                    button.disabled = false;
                }
            }
        });
    }

    fetchProducts(currentPage, {}, false);
    updateActiveFiltersDisplay();
});

function updateCartCounter(count) {
    const cartCountElement = document.querySelector('.cart-count');
    if (cartCountElement) {
        const currentCount = parseInt(cartCountElement.textContent) || 0;
        cartCountElement.textContent = count;
        if (count > currentCount) {
            cartCountElement.classList.add('updated');
            setTimeout(() => { if(cartCountElement) cartCountElement.classList.remove('updated'); }, 600);
        }
    }
}

function renderPagination(currentPage, totalPages) {
     if (!paginationContainer || totalPages <= 1) { if (paginationContainer) paginationContainer.innerHTML = ''; return; }
     paginationContainer.innerHTML = '';
     const delta = 1;
     const range = [];
     const rangeWithDots = [];
     range.push(1);
     if (totalPages > 1) {
         let left = Math.max(2, currentPage - delta);
         let right = Math.min(totalPages - 1, currentPage + delta);
         if (currentPage - delta <= 2) right = Math.min(totalPages - 1, 1 + delta * 2);
         if (currentPage + delta >= totalPages - 1) left = Math.max(2, totalPages - delta * 2);
         left = Math.min(left, right);
         for (let i = left; i <= right; i++) range.push(i);
         range.push(totalPages);
     }
     const uniqueRange = [...new Set(range)].sort((a, b) => a - b);
     let l;
     uniqueRange.forEach(i => {
         if (l) {
             if (i - l === 2)
                 rangeWithDots.push(l + 1);
             else if (i - l > 1)
                 rangeWithDots.push('...');
         }
         rangeWithDots.push(i);
         l = i;
     });
     const fragment = document.createDocumentFragment();
     const prevLi = document.createElement('li');
     prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
     prevLi.innerHTML = `<button type="button" class="page-link prev" data-page="${currentPage - 1}" aria-label="Попередня">&laquo;</button>`;
     fragment.appendChild(prevLi);
     rangeWithDots.forEach(page => {
         const li = document.createElement('li');
         li.className = `page-item ${page === currentPage ? 'active' : ''} ${page === '...' ? 'disabled' : ''}`;
         li.innerHTML = page === '...' ? `<span class="page-link dots">...</span>` : `<button type="button" class="page-link" data-page="${page}">${page}</button>`;
         fragment.appendChild(li);
     });
     const nextLi = document.createElement('li');
     nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
     nextLi.innerHTML = `<button type="button" class="page-link next" data-page="${currentPage + 1}" aria-label="Наступна">&raquo;</button>`;
     fragment.appendChild(nextLi);
     paginationContainer.appendChild(fragment);
}
