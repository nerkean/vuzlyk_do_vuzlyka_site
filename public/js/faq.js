function initFaqAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');

    if (faqItems.length === 0) {
        console.log('No FAQ items found.');
        return;
    }
    console.log(`Found ${faqItems.length} FAQ items. Initializing...`);

    faqItems.forEach((item, index) => {
        const questionButton = item.querySelector('.faq-question');
        const answerPanel = item.querySelector('.faq-answer');

        if (!questionButton || !answerPanel) {
            console.warn(`FAQ item #${index} is missing question or answer panel:`, item);
            return;
        }

        questionButton.setAttribute('aria-expanded', 'false');
        answerPanel.classList.remove('is-open');
        questionButton.classList.remove('is-active');


        questionButton.addEventListener('click', () => {
            const isExpanded = questionButton.getAttribute('aria-expanded') === 'true';
            console.log(`FAQ #${index} clicked. Currently expanded: ${isExpanded}`);

            questionButton.setAttribute('aria-expanded', String(!isExpanded));

            questionButton.classList.toggle('is-active'); 
            answerPanel.classList.toggle('is-open');  

            console.log(`FAQ #${index} - Toggled classes. New state: expanded=${!isExpanded}`);
        });
    });

    console.log('FAQ Accordion Initialized successfully (class toggle version).');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFaqAccordion);
} else {
    initFaqAccordion();
}
