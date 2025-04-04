document.addEventListener('DOMContentLoaded', () => {
    const filterForm = document.getElementById('filter-form');
    const sortSelect = document.getElementById('sort-by');
    const productGridContainer = document.getElementById('product-grid-container');
    const paginationContainer = document.getElementById('pagination-container');
    const productCountElement = document.getElementById('product-count-value');
    const clearFiltersButton = document.querySelector('.clear-filters-btn');

    let currentPage = 1;
    let currentSort = 'default';
    let currentFilters = {};

    function pluralizeProduct(count) {
        const num = Math.abs(count) % 100;
        const num1 = num % 10;
        if (num > 10 && num < 20) { return 'товарів'; }
        if (num1 > 1 && num1 < 5) { return 'товари'; }
        if (num1 === 1) { return 'товар'; }
        return 'товарів';
    }

    function updateProductCount(count) {
        if (productCountElement) {
            console.log(`Updating count. Element found. Received count: ${count} (type: ${typeof count})`);
            productCountElement.textContent = `${count} ${pluralizeProduct(count)}`;
        } else {
            console.warn('Елемент для лічильника товарів не знайдено (#product-count-value)');
        }
    }

    function renderPagination(currentPage, totalPages) {
        const paginationList = paginationContainer ? paginationContainer.querySelector('ul') : null;
        if (!paginationList) {
            if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }

        paginationList.innerHTML = '';

        if (totalPages <= 1) {
            paginationContainer.style.display = 'none';
            return;
        } else {
            paginationContainer.style.display = 'block';
        }

        const maxVisiblePages = 5;
        let startPage, endPage;

        if (totalPages <= maxVisiblePages) {
            startPage = 1;
            endPage = totalPages;
        } else {
            const maxPagesBeforeCurrent = Math.floor((maxVisiblePages - 1) / 2);
            const maxPagesAfterCurrent = Math.ceil((maxVisiblePages - 1) / 2);

            if (currentPage <= maxPagesBeforeCurrent) {
                startPage = 1;
                endPage = maxVisiblePages - 1;
            } else if (currentPage + maxPagesAfterCurrent >= totalPages) {
                startPage = totalPages - maxVisiblePages + 2;
                endPage = totalPages;
            } else {
                startPage = currentPage - maxPagesBeforeCurrent + 1;
                endPage = currentPage + maxPagesAfterCurrent - 1;
            }
        }

        if (currentPage > 1) {
            paginationList.insertAdjacentHTML('beforeend', `<li><button class="page-link prev" data-page="${currentPage - 1}" aria-label="Попередня сторінка">&lt;</button></li>`);
        } else {
            paginationList.insertAdjacentHTML('beforeend', `<li><button class="page-link prev disabled" aria-disabled="true" aria-label="Попередня сторінка">&lt;</button></li>`);
        }

        if (startPage > 1) {
            paginationList.insertAdjacentHTML('beforeend', `<li><button class="page-link" data-page="1">1</button></li>`);
            if (startPage > 2) {
                paginationList.insertAdjacentHTML('beforeend', `<li class="ellipsis"><span>...</span></li>`);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            if (i === currentPage) {
                paginationList.insertAdjacentHTML('beforeend', `<li><button class="page-link active" aria-current="page" data-page="${i}">${i}</button></li>`);
            } else {
                paginationList.insertAdjacentHTML('beforeend', `<li><button class="page-link" data-page="${i}">${i}</button></li>`);
            }
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationList.insertAdjacentHTML('beforeend', `<li class="ellipsis"><span>...</span></li>`);
            }
            paginationList.insertAdjacentHTML('beforeend', `<li><button class="page-link" data-page="${totalPages}">${totalPages}</button></li>`);
        }

        if (currentPage < totalPages) {
            paginationList.insertAdjacentHTML('beforeend', `<li><button class="page-link next" data-page="${currentPage + 1}" aria-label="Наступна сторінка">&gt;</button></li>`);
        } else {
            paginationList.insertAdjacentHTML('beforeend', `<li><button class="page-link next disabled" aria-disabled="true" aria-label="Наступна сторінка">&gt;</button></li>`);
        }
    }

    async function fetchAndRenderProducts() {
        const formData = filterForm ? new FormData(filterForm) : new FormData();
        const params = new URLSearchParams();
        const filterData = {};
        formData.forEach((value, key) => { if (!filterData[key]) { filterData[key] = []; } if ((key === 'price_from' || key === 'price_to') && value === '') { return; } filterData[key].push(value); });
        for (const key in filterData) { filterData[key].forEach(value => { params.append(key, value); }); }
        params.set('sort', currentSort);
        params.set('page', currentPage);
        const queryString = params.toString();
        const newUrl = `/catalog?${queryString}`;
        if (window.location.search !== `?${queryString}`) { history.pushState({ path: newUrl }, '', newUrl); }
        productGridContainer.innerHTML = '<p>Завантаження товарів...</p>';
        if (paginationContainer && paginationContainer.querySelector('ul')) { paginationContainer.querySelector('ul').innerHTML = ''; }

        try {
            console.log(`Fetching: /api/products?${queryString}`);
            const response = await fetch(`/api/products?${queryString}`, {
                method: 'GET',
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            if (!response.ok) {
                if (response.status === 304) {
                     console.warn("Отримано статус 304 Not Modified - відповідь може бути порожньою.");
                }
                if (response.status < 200 || response.status >= 300) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            }
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const textData = await response.text();
                console.error('Отримана відповідь не є JSON:', textData);
                throw new Error(`Неправильний формат відповіді від сервера (${contentType || 'тип не вказано'})`);
            }
            const data = await response.json();
            console.log('Received data:', data);
            if (data.success) {
                renderProductGrid(data.products);
                renderPagination(data.currentPage, data.totalPages);
                updateProductCount(data.totalProducts);
                if (typeof AOS !== 'undefined') { AOS.refreshHard(); }
            } else { throw new Error(data.message || 'Помилка отримання даних'); }
        } catch (error) {
            console.error('Помилка при завантаженні товарів:', error);
            productGridContainer.innerHTML = `<p>Помилка завантаження товарів. Спробуйте ще раз. (${error.message})</p>`;
        }
    }

    function renderProductGrid(products) {
        productGridContainer.innerHTML = '';
        if (products && products.length > 0) {
            products.forEach((product, index) => {
                const imageSrc = product.images && product.images.length > 0 ? product.images[0] : '/images/placeholder.webp';
                const productCard = `
                    <article class="product-card" data-aos="fade-up" data-aos-delay="${index * 50}">
                        <div class="product-image-wrapper">
                            <a href="/product/${product._id}">
                                <img src="${imageSrc}" alt="${product.name || 'Зображення товару'}" loading="lazy">
                                <div class="product-overlay"><span class="view-details-btn">Детальніше</span></div>
                            </a>
                        </div>
                        <div class="product-info">
                            <a href="/product/${product._id}"><h3>${product.name || 'Назва товару'}</h3></a>
                            <p class="price">${product.price || 0} грн</p>
                            <button class="btn btn-tertiary add-to-cart-button" data-product-id="${product._id}">
                                <svg class="icon icon-cart-plus" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor"><path d="M0 24C0 10.7 10.7 0 24 0H69.5c22 0 41.5 12.8 50.6 32h411c26.3 0 45.5 25 38.6 50.4l-41 152.3c-8.5 31.4-37 53.3-69.5 53.3H170.7l5.4 28.5c2.2 11.3 12.1 19.5 23.6 19.5H488c13.3 0 24 10.7 24 24s-10.7 24-24 24H199.7c-34.6 0-64.3-24.6-70.7-58.5L77.4 54.5c-.7-3.8-4-6.5-7.9-6.5H24C10.7 48 0 37.3 0 24zM128 464a48 48 0 1 1 96 0 48 48 0 1 1 -96 0zm336-48a48 48 0 1 1 0 96 48 48 0 1 1 0-96zM252 160c0-11 9-20 20-20h40c11 0 20 9 20 20v40h40c11 0 20 9 20 20s-9 20-20 20H332v40c0 11-9 20-20 20h-40c-11 0-20-9-20-20v-40H212c-11 0-20-9-20-20s9-20 20-20h40v-40z"/></svg>
                                В кошик
                            </button>
                        </div>
                    </article>
                `;
                productGridContainer.insertAdjacentHTML('beforeend', productCard);
            });
        } else {
            productGridContainer.innerHTML = '<p>На жаль, товари за вашим запитом не знайдено.</p>';
        }
    }

    function applyUrlFilters() {
        try {
            const initialUrlParams = new URLSearchParams(window.location.search);
            currentPage = parseInt(initialUrlParams.get('page')) || 1;
            currentSort = initialUrlParams.get('sort') || 'default';
            if (sortSelect) {
                sortSelect.value = currentSort;
            }
            if (filterForm) {
                filterForm.reset();
                initialUrlParams.forEach((value, key) => {
                    if (key === 'page' || key === 'sort') return;
                    const inputs = filterForm.querySelectorAll(`[name="${CSS.escape(key)}"]`);
                    inputs.forEach(input => {
                        if (input.type === 'checkbox' || input.type === 'radio') {
                            if (initialUrlParams.getAll(key).includes(input.value)) {
                                input.checked = true;
                            }
                        } else {
                            input.value = value;
                        }
                    });
                });
                console.log('Початкові фільтри встановлено з URL');
            }
        } catch (e) {
            console.error("Помилка обробки початкових параметрів URL:", e);
        }
    }

    if (filterForm) {
        filterForm.addEventListener('submit', (event) => {
            event.preventDefault();
            currentPage = 1;
            currentSort = sortSelect ? sortSelect.value : 'default';
            fetchAndRenderProducts();
        });
        filterForm.addEventListener('change', (event) => {
            if (event.target.type === 'number' || event.target.tagName === 'SELECT') return;
            currentPage = 1;
            currentSort = sortSelect ? sortSelect.value : 'default';
            fetchAndRenderProducts();
        });
        if (clearFiltersButton) {
            clearFiltersButton.addEventListener('click', () => {
                filterForm.reset();
                if (sortSelect) {
                    sortSelect.value = 'default';
                }
                currentSort = 'default';
                currentPage = 1;
                fetchAndRenderProducts();
            });
        }
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            currentSort = sortSelect.value;
            currentPage = 1;
            fetchAndRenderProducts();
        });
    }

    if (paginationContainer) {
        paginationContainer.addEventListener('click', (event) => {
            const pageButton = event.target.closest('.page-link');
            if (!pageButton || pageButton.classList.contains('disabled') || pageButton.classList.contains('active')) {
                return;
            }
            event.preventDefault();
            const page = parseInt(pageButton.dataset.page);
            if (!isNaN(page)) {
                currentPage = page;
                fetchAndRenderProducts();
                productGridContainer.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }

    applyUrlFilters();
    fetchAndRenderProducts();
});
