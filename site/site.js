(() => {
  const CONFIG = {
    // Store buttons stay hidden until this is set to the PingTo listing URL.
    storeUrl: '',
    // Must match BILLING_CONFIG.checkoutUrl in modules/billing-config.js.
    checkoutUrl: '',
    repoUrl: 'https://github.com/Baraulia/pingTO',
    supportUrl: 'https://github.com/Baraulia/pingTO/issues',
  };

  const SHOTS = {
    rest: { src: 'assets/shot-rest.png', alt: 'altRest' },
    environments: { src: 'assets/shot-environments.png', alt: 'altEnv' },
    curl: { src: 'assets/shot-curl.png', alt: 'altCurl' },
    graphql: { src: 'assets/shot-graphql.png', alt: 'altGql' },
    loadtest: { src: 'assets/shot-loadtest.png', alt: 'altLoad' },
  };

  const EN_EXTRA = {
    altRest: 'PingTo sending a GET request with a path parameter and showing a JSON response',
    altEnv: 'Environment editor with variables, some marked as secret',
    altCurl: 'cURL import and a generated Python code snippet',
    altGql: 'GraphQL introspection query and schema response',
    altLoad: 'Load test report with requests per second and latency percentile charts',
    ctaBuySoon: 'Coming soon',
    ctaBuyInExt: 'Upgrade inside the extension',
  };

  const RU = {
    navFeatures: 'Возможности',
    navScreens: 'Скриншоты',
    navLoad: 'Нагрузка',
    navPricing: 'Цены',
    navFaq: 'Вопросы',
    navPrivacy: 'Приватность',
    navSupport: 'Поддержка',
    ctaInstallShort: 'Установить',
    ctaInstall: 'Установить в Chrome — бесплатно',
    ctaPricing: 'Смотреть цены',
    ctaBuy: 'Купить Pro',
    ctaBuySoon: 'Скоро в продаже',
    ctaBuyInExt: 'Оформить Pro в расширении',
    heroEyebrow: 'Расширение Chrome для разработчиков',
    heroTitle: 'Локальный API-клиент в&nbsp;Chrome',
    heroLead: 'Отправляйте HTTP-запросы прямо из браузера, храните коллекции и окружения на этом устройстве и обходитесь без десктопного приложения. Без аккаунта и облачного воркспейса.',
    factLocal: 'Данные остаются на этом компьютере',
    factAccount: 'Без регистрации',
    factLicense: 'Лицензия MIT',
    altRest: 'PingTo отправляет GET-запрос с path-параметром и показывает JSON-ответ',
    altEnv: 'Редактор окружения с переменными, часть отмечена как секретные',
    altCurl: 'Импорт cURL и сгенерированный сниппет на Python',
    altGql: 'Интроспекция GraphQL и ответ со схемой',
    altLoad: 'Отчёт нагрузочного теста с графиками запросов в секунду и перцентилей задержки',
    pLocalTitle: 'Локально по умолчанию',
    pLocalText: 'Коллекции, окружения, история и тела ответов хранятся в <code>chrome.storage.local</code>. На сервер ничего не синхронизируется.',
    pCorsTitle: 'CORS не мешает',
    pCorsText: 'Запрос отправляет расширение, а не страница, поэтому правила CORS страницы его не блокируют.',
    pKeysTitle: 'Управление с клавиатуры',
    pKeysText: 'Открыть — <span class="keys"><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>A</kbd></span>, отправить — <span class="keys"><kbd>Ctrl</kbd>+<kbd>Enter</kbd></span>, перейти куда угодно — <span class="keys"><kbd>Ctrl</kbd>+<kbd>K</kbd></span>.',
    featEyebrow: 'Возможности',
    featTitle: 'Всё, что нужно для ежедневной работы с API',
    featLead: 'Бесплатный план полностью закрывает работу с REST. Pro добавляет протоколы, автоматизацию и импорт из других клиентов.',
    fHttpTitle: 'HTTP-запросы',
    fHttpText: 'GET, POST, PUT, PATCH, DELETE, OPTIONS и HEAD. Query и path-параметры, заголовки, cookies, тела JSON, form, multipart и text. Неограниченное число вкладок.',
    fCollTitle: 'Коллекции и окружения',
    fCollText: 'Папки, перетаскивание, документация к каждому запросу. Переменные <code>{{base_url}}</code> в URL, заголовках, теле и авторизации; секретные значения скрыты.',
    fRespTitle: 'Разбор ответа',
    fRespText: 'Сворачиваемое дерево JSON с копированием пути по клику, подсветка XML, raw-вид с номерами строк, предпросмотр HTML и изображений, фильтр JSONPath, цепочка редиректов.',
    fCurlTitle: 'cURL и сниппеты кода',
    fCurlText: 'Вставьте cURL — получите запрос; скопируйте любой запрос как cURL с подставленными значениями окружения. В Pro — сниппеты на JavaScript, Python, PHP и Go.',
    fAuthTitle: 'Авторизация',
    fAuthText: 'Bearer, Basic и API Key, а также наследование от папки или коллекции. В Pro — Digest и OAuth 2.0: client credentials и authorization code с PKCE.',
    fGqlTitle: 'GraphQL',
    fGqlText: 'Редактор запросов, переменные и интроспекция схемы для любого GraphQL-эндпоинта.',
    fWsTitle: 'WebSocket и SSE',
    fWsText: 'Живые соединения, отправка сообщений и чтение потоков событий с автоматическим переподключением по желанию.',
    fAutoTitle: 'Скрипты, тесты и прогоны',
    fAutoText: 'Pre-request скрипты и тесты на JavaScript выполняются в изолированной песочнице на этом устройстве. Снимки, diff ответов и прогон коллекций, где строки JSON или CSV заполняют <code>{{переменные}}</code>.',
    fImportTitle: 'Импорт и экспорт',
    fImportText: 'Postman v2, Insomnia и Bruno в обе стороны; импорт OpenAPI и HAR. Файл workspace переносит коллекции, окружения и настройки на другой компьютер.',
    screensEyebrow: 'Скриншоты',
    screensTitle: 'Настоящий интерфейс',
    screensLead: 'Сняты с работающего расширения на локальном тестовом сервере.',
    tabRest: 'REST',
    tabEnv: 'Окружения',
    tabCurl: 'cURL и код',
    tabGql: 'GraphQL',
    tabLoad: 'Нагрузка',
    loadEyebrow: 'Нагрузочное тестирование',
    loadTitle: 'Нагрузочные тесты на вашей машине',
    loadLead: 'Chrome не откроет тысячи параллельных соединений, поэтому PingTo управляет небольшим агентом, который вы скачиваете под свою ОС. Он повторяет текущий HTTP-запрос и передаёт результаты обратно в расширение.',
    step1Title: 'Скачайте агент',
    step1Text: 'Сборки для Windows, macOS и Linux из GitHub Releases с контрольной суммой SHA-256 для проверки.',
    step2Title: 'Запустите локально',
    step2Text: 'Слушает только <code>127.0.0.1:8788</code>. Без логина и телеметрии.',
    step3Title: 'Ramp или Hold',
    step3Text: 'Плавный рост от нуля до целевой скорости или удержание пика. Правила abort останавливают прогон по доле ошибок, p95 или серии сбоев.',
    step4Title: 'Изучите отчёт',
    step4Text: 'Текущие и пиковые запросы в секунду, задержки p50/p95/p99 и коды статуса. Отчёт выгружается в HTML.',
    priceEyebrow: 'Цены',
    priceTitle: 'Начните бесплатно. Переходите на Pro, когда понадобится',
    priceLead: 'Один план для разработчиков. Без мест в команде и без оплаты за объём.',
    priceForever: 'навсегда',
    pricePerYear: 'в год',
    freeDesc: 'Всё необходимое для работы с REST.',
    free1: 'Неограниченные вкладки и все HTTP-методы',
    free2: 'Bearer, Basic, API Key и наследование авторизации',
    free3: '2 коллекции, 25 сохранённых запросов',
    free4: '1 окружение, 10 переменных',
    free5: 'История последних 50 запросов',
    free6: 'Импорт и экспорт cURL и PingTo JSON',
    free7: 'Светлая и тёмная тема, английский и русский',
    proBadge: 'Для ежедневной работы',
    proDesc: 'Один лицензионный ключ на 3 устройства.',
    pro1: 'Всё из Free',
    pro2: 'Неограниченные коллекции, запросы и окружения',
    pro3: 'История до 2000 запросов',
    pro4: 'GraphQL, WebSocket и SSE',
    pro5: 'Digest и OAuth 2.0',
    pro6: 'Скрипты, тесты, снимки, diff, бинарное тело',
    pro7: 'Прогон коллекций с данными JSON или CSV',
    pro8: 'Postman, Insomnia, Bruno, OpenAPI и HAR',
    pro9: 'Сниппеты кода: JavaScript, Python, PHP, Go',
    pro10: 'Нагрузочные тесты через локальный агент',
    pro11: 'Файл workspace для переноса между компьютерами',
    priceNote: 'Оплата раз в год в долларах США. Платёж проводит Lemon Squeezy; данные карты не попадают в PingTo. После оплаты вы получаете лицензионный ключ и вставляете его в расширение.',
    privEyebrow: 'Приватность',
    privTitle: 'Что уходит с вашего компьютера',
    privLead: 'PingTo работает без собственного бэкенда. Ниже — все сетевые обращения, которые расширение делает само.',
    priv1: 'Отправленные запросы, коллекции, окружения и история остаются в <code>chrome.storage.local</code> на этом устройстве.',
    priv2: 'Активация и деактивация лицензии обращаются к Lemon Squeezy.',
    priv3: 'Агент нагрузочного теста и его манифест скачиваются с GitHub только при использовании этой функции.',
    priv4: 'Скрипты Pro выполняются на изолированной sandbox-странице без доступа к API расширения.',
    priv5: 'Нет ни аккаунтов, ни облачного воркспейса.',
    faqEyebrow: 'Вопросы',
    faqTitle: 'Частые вопросы',
    q1: 'Нужен ли аккаунт?',
    a1: 'Нет. Установите расширение и отправляйте запросы. Лицензионный ключ нужен только для Pro.',
    q2: 'Где хранятся мои данные?',
    a2: 'В chrome.storage.local на этом устройстве. Чтобы перенести их на другой компьютер, используйте экспорт PingTo JSON или файл workspace в Pro.',
    q3: 'На сколько устройств действует лицензия Pro?',
    a3: 'До трёх. Активируйте один и тот же ключ на каждом устройстве; чтобы освободить место, деактивируйте одно из них.',
    q4: 'Что будет, если не продлить Pro?',
    a4: 'Данные останутся. Функции Pro заблокируются, а коллекции сверх первых двух станут недоступны, но не удалятся — до продления.',
    q5: 'Может ли PingTo игнорировать невалидные TLS-сертификаты?',
    a5: 'Нет. Расширения Chrome не могут обходить ошибки сертификатов. Используйте валидный сертификат или обычный HTTP для локальных сервисов.',
    q6: 'Безопасно ли запускать агент нагрузки?',
    a6: 'Он слушает только 127.0.0.1 и не отправляет телеметрию. Логина у него нет, поэтому любая программа на этом компьютере может обращаться к нему, пока он запущен. Останавливайте агент после работы и нагружайте только свои API или те, на которые есть разрешение.',
    ctaBandTitle: 'Откройте PingTo, вставьте URL, нажмите Send',
    ctaBandText: 'Установка бесплатна. Pro — только если понадобится больше.',
    footerTag: 'Локальный API-клиент для Chrome.',
    footerLicense: 'Распространяется по лицензии MIT.',
  };

  const STORAGE_KEY = 'pingto_site_lang';
  const original = new Map();
  let lang = 'en';

  function remember(el) {
    if (!original.has(el)) original.set(el, el.innerHTML);
    return original.get(el);
  }

  function t(key) {
    if (lang === 'ru' && RU[key]) return RU[key];
    return EN_EXTRA[key] || null;
  }

  function applyLanguage(next) {
    lang = next === 'ru' ? 'ru' : 'en';
    document.documentElement.lang = lang;

    document.querySelectorAll('[data-i18n], [data-i18n-html]').forEach((el) => {
      const base = remember(el);
      const key = el.dataset.i18n || el.dataset.i18nHtml;
      el.innerHTML = (lang === 'ru' && RU[key]) || base;
    });
    document.querySelectorAll('[data-i18n-alt]').forEach((el) => {
      el.alt = t(el.dataset.i18nAlt) || el.alt;
    });

    const toggle = document.getElementById('langToggle');
    if (toggle) {
      toggle.textContent = lang === 'ru' ? 'EN' : 'RU';
      toggle.setAttribute('aria-label', lang === 'ru' ? 'Switch to English' : 'Переключить на русский');
    }
    syncCheckoutButton();
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* storage may be blocked */ }
  }

  function syncCheckoutButton() {
    const buy = document.getElementById('buyPro');
    if (!buy) return;
    const target = isUrl(CONFIG.checkoutUrl) ? CONFIG.checkoutUrl : CONFIG.storeUrl;
    if (!isUrl(target)) {
      buy.removeAttribute('href');
      buy.setAttribute('aria-disabled', 'true');
      buy.textContent = t('ctaBuySoon');
      return;
    }
    buy.href = target;
    buy.target = '_blank';
    buy.rel = 'noopener';
    buy.removeAttribute('aria-disabled');
    if (target === CONFIG.storeUrl) buy.textContent = t('ctaBuyInExt');
  }

  function isUrl(value) {
    return /^https:\/\//i.test(String(value || '').trim());
  }

  function applyLinks() {
    const map = { store: CONFIG.storeUrl, repo: CONFIG.repoUrl, support: CONFIG.supportUrl };
    document.querySelectorAll('[data-link]').forEach((el) => {
      const url = map[el.dataset.link];
      if (!isUrl(url)) {
        el.hidden = true;
        el.removeAttribute('href');
        return;
      }
      el.hidden = false;
      el.href = url;
      el.target = '_blank';
      el.rel = 'noopener';
    });
    const heroPricing = document.getElementById('heroPricing');
    if (heroPricing && isUrl(CONFIG.storeUrl)) {
      heroPricing.classList.replace('btn-primary', 'btn-ghost');
    }
  }

  function initGallery() {
    const image = document.getElementById('galleryImage');
    const tabs = document.querySelectorAll('.gallery-tab');
    if (!image || !tabs.length) return;
    Object.values(SHOTS).forEach(({ src }) => { new Image().src = src; });
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const shot = SHOTS[tab.dataset.shot];
        if (!shot) return;
        tabs.forEach((other) => {
          const active = other === tab;
          other.classList.toggle('is-active', active);
          other.setAttribute('aria-selected', String(active));
        });
        image.src = shot.src;
        image.dataset.i18nAlt = shot.alt;
        image.alt = t(shot.alt);
      });
    });
  }

  function initialLanguage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'ru' || saved === 'en') return saved;
    } catch { /* storage may be blocked */ }
    return (navigator.language || '').toLowerCase().startsWith('ru') ? 'ru' : 'en';
  }

  applyLinks();
  initGallery();
  applyLanguage(initialLanguage());
  document.getElementById('langToggle')?.addEventListener('click', () => {
    applyLanguage(lang === 'ru' ? 'en' : 'ru');
  });
})();
