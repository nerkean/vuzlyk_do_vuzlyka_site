document.addEventListener('DOMContentLoaded', () => {
    const mainImage = document.getElementById('mainProductImage');
    const thumbnails = document.querySelectorAll('.thumbnail-item img');
    const thumbnailItems = document.querySelectorAll('.thumbnail-item');

    if (mainImage && thumbnails.length > 0) {
        thumbnails.forEach((thumbnail, index) => {
            thumbnail.addEventListener('click', () => {
                const largeImageSrc = thumbnail.dataset.large || thumbnail.src;
                if (largeImageSrc) {
                    mainImage.src = largeImageSrc;
                    mainImage.alt = thumbnail.alt.replace('Мініатюра', 'Фото');
                    thumbnailItems.forEach(item => item.classList.remove('active'));
                    if (thumbnailItems[index]) {
                        thumbnailItems[index].classList.add('active');
                    }
                }
            });
        });
    } else if (mainImage && thumbnails.length === 0) {
         const thumbnailList = document.querySelector('.thumbnail-list');
         if (thumbnailList) {
             thumbnailList.style.display = 'none';
         }
    }

    const customFileInput = document.getElementById('customFile');
    const customFileTriggerButton = document.querySelector('.trigger-file-upload');
    const customFileNameSpan = document.querySelector('.file-name');
    const customPreviewContainer = document.getElementById('imagePreviewContainer');
    const customImagePreview = document.getElementById('imagePreview');

    if(customFileTriggerButton && customFileInput) {
        customFileTriggerButton.addEventListener('click', () => {
            customFileInput.click();
        });
    }

    if(customFileInput && customFileNameSpan && customPreviewContainer && customImagePreview) {
        customFileInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                customFileNameSpan.textContent = file.name;
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        customImagePreview.src = e.target.result;
                        customPreviewContainer.style.display = 'block';
                    }
                    reader.readAsDataURL(file);
                } else {
                    customImagePreview.src = '#';
                    customPreviewContainer.style.display = 'none';
                }
            } else {
                customFileNameSpan.textContent = 'Файл не вибрано';
                customImagePreview.src = '#';
                customPreviewContainer.style.display = 'none';
            }
        });
    }

    const reviewForm = document.getElementById('review-form');
    const reviewFormMessage = document.getElementById('review-form-message');

    if (reviewForm) {
        reviewForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!reviewFormMessage) return;

            reviewFormMessage.textContent = '';
            reviewFormMessage.className = 'form-message';

            const formData = new FormData(reviewForm);
            const data = Object.fromEntries(formData.entries());

            if (!data.rating) {
                reviewFormMessage.textContent = 'Будь ласка, оберіть оцінку (кількість зірок).';
                reviewFormMessage.classList.add('error');
                return;
            }
            const submitButton = reviewForm.querySelector('button[type="submit"]');
            if (submitButton) submitButton.disabled = true;
            reviewFormMessage.textContent = 'Відправка відгуку...';
            reviewFormMessage.classList.add('loading');

            try {
                const response = await fetch(`/api/products/${data.productId}/reviews`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        rating: parseInt(data.rating),
                        text: data.review_text || '',
                        author: data.review_author || 'Анонім'
                    }),
                });

                const result = await response.json();
                reviewFormMessage.classList.remove('loading');

                if (response.ok && result.success) {
                    reviewFormMessage.textContent = 'Дякуємо! Ваш відгук успішно додано.';
                    reviewFormMessage.classList.add('success');
                    reviewForm.reset();
                } else {
                    reviewFormMessage.textContent = result.message || 'Сталася помилка при відправці відгуку.';
                    reviewFormMessage.classList.add('error');
                }

            } catch (error) {
                console.error('Помилка відправки відгуку:', error);
                reviewFormMessage.classList.remove('loading');
                reviewFormMessage.textContent = 'Не вдалося відправити відгук. Перевірте з\'єднання.';
                reviewFormMessage.classList.add('error');
            } finally {
                 if (submitButton) submitButton.disabled = false;
            }
        });
    } else {
        console.log('Review form not found on this page.');
    }

    if (typeof AOS !== 'undefined') {
        AOS.init({ once: true, duration: 600, easing: 'ease-out-cubic', offset: 50 });
    }
});
