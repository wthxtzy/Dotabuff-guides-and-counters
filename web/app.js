(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const STORAGE_KEY = 'dotaDraft.v2';
  const MAX_TEAM = 5;
  const PRESETS = ['balanced', 'counters', 'meta', 'comfort'];
  const POSITIONS = [1, 2, 3, 4, 5];
  const ROLE_NAMES = {
    ru: ['Керри', 'Мидер', 'Оффлейнер', 'Софт-саппорт', 'Хард-саппорт'],
    en: ['Carry', 'Mid', 'Offlane', 'Soft Support', 'Hard Support'],
  };
  const ROLE_SHORT = {
    ru: ['Керри', 'Мид', 'Оффлейн', 'Софт', 'Хард'],
    en: ['Carry', 'Mid', 'Offlane', 'Soft', 'Hard'],
  };
  const ATTR_LABELS = {
    ru: { str: 'Сила', agi: 'Ловкость', int: 'Интеллект', all: 'Универсал' },
    en: { str: 'Strength', agi: 'Agility', int: 'Intelligence', all: 'Universal' },
  };
  const TAG_LABELS = {
    ru: {
      Carry: 'Керри', Support: 'Поддержка', Nuker: 'Урон', Disabler: 'Контроль',
      Initiator: 'Инициация', Durable: 'Стойкость', Escape: 'Эскейп', Pusher: 'Пуш',
    },
    en: {
      Carry: 'Carry', Support: 'Support', Nuker: 'Nuker', Disabler: 'Disabler',
      Initiator: 'Initiator', Durable: 'Durable', Escape: 'Escape', Pusher: 'Pusher',
    },
  };
  const GRADE_COLORS = { S: '#e9cb8a', A: '#4cc47c', B: '#59a9e6', C: '#b7a06e', D: '#e2615c' };
  const NEED_KEYS = ['initiation', 'disable', 'frontline', 'damage', 'save', 'scaling', 'push'];

  const I18N = {
    ru: {
      appTagline: 'помощник по драфту Dota 2',
      live: 'LIVE',
      update: 'Обновить',
      settings: 'Настройки',
      terminate: 'Завершить',
      heroPool: 'Пул героев',
      pickHeroes: 'Выберите героев',
      searchPlaceholder: 'Найти героя…',
      roleFilter: 'Роль',
      resetFilters: 'Сбросить',
      yourRole: 'Ваша роль',
      whichRole: 'На какой позиции вы играете?',
      radiant: 'Свет',
      dire: 'Тьма',
      yourTeam: 'Ваша команда',
      enemies: 'Команда врага',
      clear: 'Очистить',
      reset: 'Сбросить драфт',
      swapSides: 'Поменять стороны',
      recommendations: 'Рекомендации',
      byRole: 'Лучшие и худшие по ролям',
      byRoleSub: 'Оценка под каждую позицию',
      clickToAdd: 'Нажмите на карточку, чтобы добавить героя',
      position: 'Позиция',
      positionShort: 'Поз.',
      all: 'Все',
      attrAll: 'Все',
      attrStr: 'Сила',
      attrAgi: 'Ловкость',
      attrInt: 'Интеллект',
      attrUniversal: 'Универсал',
      loading: 'Загружаем данные и считаем рекомендации…',
      data: 'Данные',
      patch: 'патч',
      today: 'сегодня',
      yesterday: 'вчера',
      daysAgo: '{n} дн. назад',
      dataFooter: 'OpenDota · {date} · патч {patch}',
      localOnly: 'Работает локально на вашем компьютере',
      serverErrorTitle: 'Не удалось связаться с приложением',
      serverErrorText: 'Сервер не отвечает. Возможно, приложение было остановлено.',
      serverErrorHint: 'Если сервер остановлен, запустите приложение заново: DotaDraftAssistant.exe на Windows или ./start.sh на Linux.',
      reload: 'Обновить страницу',
      closeTab: 'Закрыть вкладку',
      terminatedEyebrow: 'Сеанс завершён',
      terminatedTitle: 'Приложение остановлено',
      terminatedText: 'Локальный сервер выключен. Данные драфта сохранены в браузере и восстановятся при следующем запуске.',
      restartWindows: 'Windows: запустите DotaDraftAssistant.exe, чтобы открыть приложение снова.',
      restartLinux: 'Linux: запустите ./start.sh, чтобы открыть приложение снова.',
      best: 'Лучшие',
      worst: 'Худшие',
      showWorst: 'показать худших',
      hideWorst: 'скрыть худших',
      topPick: 'Лучший пик',
      addToTeam: 'В мою команду',
      added: 'Добавлено: {hero}',
      noEmptySlot: 'В команде нет свободного слота',
      alreadyPicked: '{hero} уже выбран',
      removed: 'Убрано: {hero}',
      resetDone: 'Драфт сброшен',
      draftEmpty: 'Драфт уже пуст',
      cleared: 'Команда очищена',
      hintNoEnemies: 'Добавьте врагов — рекомендации сразу учтут контрпики.',
      hintNoAllies: 'Теперь добавьте свою команду: так точнее считается синергия состава.',
      hintOldData: 'Данным больше недели. Обновите их в настройках, чтобы мета была свежей.',
      hintStart: 'Начните с врагов: перетащите героев в слоты справа.',
      hintDrag: 'Рекомендации обновляются после каждого добавления героя.',
      winrate: 'Винрейт',
      picks: 'пиков',
      highBracket: 'Ancient + Divine',
      publicBracket: 'все ранги',
      games: 'игр',
      confidence: 'уверенность',
      counter: 'Контрпики',
      meta: 'Мета',
      synergy: 'Синергия',
      roleFit: 'Роль',
      why: 'Почему',
      lane: 'Лейн',
      estimatedRole: 'Оценочная позиция врага',
      unknownRole: 'Позиция не определена',
      reason_lane_counter: 'Лейн против {hero}: {value}',
      reason_counter: 'Контрит {hero}: {value}',
      reason_risky: 'Опасный матчап: {hero} {value}',
      reason_meta_good: 'Мета {value}',
      reason_meta_bad: 'Слабая мета {value}',
      reason_off_role: 'Неродная роль {value}',
      reason_role_fit: 'Родная роль {value}',
      reason_synergy_ally: 'Синергия с {hero}',
      reason_low_data: 'Мало матчей ({value})',
      reason_solid_pick: 'Ровный пик без слабых мест',
      reason_need_initiation: 'Закрывает инициацию',
      reason_need_disable: 'Добавляет контроль',
      reason_need_frontline: 'Даёт фронтлайн',
      reason_need_damage: 'Добавляет урон',
      reason_need_save: 'Есть сейв',
      reason_need_scaling: 'Добавляет скейл',
      reason_need_push: 'Усиливает пуш',
      need_initiation: 'Инициация',
      need_disable: 'Контроль',
      need_frontline: 'Фронтлайн',
      need_damage: 'Урон',
      need_save: 'Сейв',
      need_scaling: 'Скейл',
      need_push: 'Пуш',
      teamNeedsTitle: 'Состав',
      teamNeedsSub: 'эвристика',
      teamNeedsEmpty: 'Добавьте союзников, чтобы увидеть сильные и слабые стороны состава.',
      refresh: 'Обновить данные',
      refreshData: 'Обновить из OpenDota',
      refreshHint: 'Загрузим свежую мету и матрицу матчапов. Обычно это занимает 3–4 минуты.',
      refreshRunning: 'Обновляем данные…',
      refreshDone: 'Данные обновлены',
      refreshFailed: 'Не удалось обновить данные',
      refreshStarted: 'Обновление запущено — можно продолжать драфт',
      refreshPhaseHeroes: 'Загружаем список героев',
      refreshPhaseMatchups: 'Скачиваем матчапы',
      refreshPhaseSaving: 'Сохраняем датасет',
      refreshPhaseDone: 'Готово',
      refreshPhaseError: 'Ошибка обновления',
      dataStats: 'Текущий снимок',
      heroesLabel: 'Героев',
      matchupsLabel: 'матчапов',
      sourceLabel: 'Источник',
      generatedLabel: 'Собрано',
      sourcesTitle: 'Источники данных',
      sourceOpenDotaDesc: 'Основные данные: публичные матчи, винрейты, матчапы.',
      sourceDotabuffDesc: 'Ссылки на гайды и контрпики. Открытого API нет.',
      sourceStratzDesc: 'Ссылки на страницы героев. API требует токен.',
      sourceValveDesc: 'Официальные портреты героев через Steam CDN.',
      language: 'Язык',
      preset: 'Стиль рекомендаций',
      presetBalanced: 'Баланс',
      presetBalancedDesc: 'Учитывает всё понемногу.',
      presetCounters: 'Контрпики',
      presetCountersDesc: 'Сильнее опирается на матчапы против врагов.',
      presetMeta: 'Мета',
      presetMetaDesc: 'Ставит выше винрейт и популярность.',
      presetComfort: 'Комфорт',
      presetComfortDesc: 'Больше веса родной роли героя.',
      about: 'О приложении',
      aboutText: 'Dota Draft Assistant 2.0 работает локально в браузере. Драфт хранится только на этом компьютере. При обновлении данных приложение обращается к OpenDota.',
      versionLabel: 'Версия',
      confirmResetTitle: 'Сбросить драфт?',
      confirmResetText: 'Обе команды будут очищены. Позиция и настройки останутся.',
      confirmClearText: 'Очистить команду «{team}»?',
      confirmClearBtn: 'Очистить',
      terminateConfirmTitle: 'Завершить работу?',
      terminateConfirmSub: 'Локальный сервер будет остановлен.',
      terminateConfirmText: 'Вкладка перестанет работать. Драфт сохранится в браузере и восстановится при следующем запуске приложения.',
      terminateConfirmBtn: 'Завершить',
      shutdownFailed: 'Не удалось остановить сервер',
      errorGeneric: 'Что-то пошло не так',
      errorLoad: 'Не удалось загрузить данные',
      noResults: 'Ничего не найдено',
      slot: 'Слот {n}',
      emptySlot: 'Пустой слот {n}',
      menuHint: 'Можно перетащить героя в любой слот или выбрать команду здесь.',
      menuAlly: 'В мою команду',
      menuEnemy: 'В команду врага',
      menuMoveAlly: 'Перенести в свою команду',
      menuMoveEnemy: 'Перенести к врагам',
      menuRemove: 'Убрать из команды',
      tierTop: 'ТОП',
      tierLow: 'АУТ',
      grade: 'грейд',
      refreshError: 'Ошибка',
      refreshing: 'Обновляем…',
      retry: 'Повторить',
      recError: 'Не удалось получить рекомендации',
      allPicked: 'Все герои уже распределены по командам.',
      noData: 'нет данных',
      switchLanguage: 'Switch language',
      close: 'Закрыть',
      cancel: 'Отмена',
      confirm: 'Подтвердить',
      resetConfirm: 'Сбросить',
      settingsSub: 'Локальное приложение · данные OpenDota',
      searchHint: 'Поиск по имени героя',
      poolCountTitle: '{visible} из {total} героев',
    },
    en: {
      appTagline: 'Dota 2 draft assistant',
      live: 'LIVE',
      update: 'Update',
      settings: 'Settings',
      terminate: 'Terminate',
      heroPool: 'Hero pool',
      pickHeroes: 'Pick heroes',
      searchPlaceholder: 'Find a hero…',
      roleFilter: 'Role',
      resetFilters: 'Reset',
      yourRole: 'Your role',
      whichRole: 'Which position do you play?',
      radiant: 'Radiant',
      dire: 'Dire',
      yourTeam: 'Your team',
      enemies: 'Enemy team',
      clear: 'Clear',
      reset: 'Reset draft',
      swapSides: 'Swap sides',
      recommendations: 'Recommendations',
      byRole: 'Best and worst by role',
      byRoleSub: 'Scored for every position',
      clickToAdd: 'Click a card to add the hero',
      position: 'Position',
      positionShort: 'Pos.',
      all: 'All',
      attrAll: 'All',
      attrStr: 'Strength',
      attrAgi: 'Agility',
      attrInt: 'Intelligence',
      attrUniversal: 'Universal',
      loading: 'Loading data and calculating recommendations…',
      data: 'Data',
      patch: 'patch',
      today: 'today',
      yesterday: 'yesterday',
      daysAgo: '{n} d ago',
      dataFooter: 'OpenDota · {date} · patch {patch}',
      localOnly: 'Runs locally on your computer',
      serverErrorTitle: 'Cannot reach the application',
      serverErrorText: 'The server is not responding. It may have been stopped.',
      serverErrorHint: 'If the server is stopped, start the app again: DotaDraftAssistant.exe on Windows or ./start.sh on Linux.',
      reload: 'Reload page',
      closeTab: 'Close tab',
      terminatedEyebrow: 'Session finished',
      terminatedTitle: 'Application stopped',
      terminatedText: 'The local server is off. Your draft is saved in this browser and will be restored next time.',
      restartWindows: 'Windows: start DotaDraftAssistant.exe to open the app again.',
      restartLinux: 'Linux: run ./start.sh to open the app again.',
      best: 'Best',
      worst: 'Worst',
      showWorst: 'show worst',
      hideWorst: 'hide worst',
      topPick: 'Top pick',
      addToTeam: 'Add to my team',
      added: 'Added: {hero}',
      noEmptySlot: 'Your team is full',
      alreadyPicked: '{hero} is already picked',
      removed: 'Removed: {hero}',
      resetDone: 'Draft reset',
      draftEmpty: 'The draft is already empty',
      cleared: 'Team cleared',
      hintNoEnemies: 'Add enemies — recommendations will factor in counters immediately.',
      hintNoAllies: 'Now add your team for a more accurate composition score.',
      hintOldData: 'This data is over a week old. Refresh it in Settings for a fresh meta.',
      hintStart: 'Start with the enemies: drag heroes into the slots on the right.',
      hintDrag: 'Recommendations update after every hero added.',
      winrate: 'Win rate',
      picks: 'picks',
      highBracket: 'Ancient + Divine',
      publicBracket: 'all ranks',
      games: 'games',
      confidence: 'confidence',
      counter: 'Counters',
      meta: 'Meta',
      synergy: 'Synergy',
      roleFit: 'Role',
      why: 'Why',
      lane: 'Lane',
      estimatedRole: 'Estimated enemy position',
      unknownRole: 'Position not determined',
      reason_lane_counter: 'Lane vs {hero}: {value}',
      reason_counter: 'Counters {hero}: {value}',
      reason_risky: 'Risky matchup: {hero} {value}',
      reason_meta_good: 'Meta {value}',
      reason_meta_bad: 'Weak meta {value}',
      reason_off_role: 'Off-role pick {value}',
      reason_role_fit: 'Signature role {value}',
      reason_synergy_ally: 'Synergy with {hero}',
      reason_low_data: 'Small sample ({value})',
      reason_solid_pick: 'Well-rounded pick',
      reason_need_initiation: 'Fills initiation',
      reason_need_disable: 'Adds control',
      reason_need_frontline: 'Adds a frontline',
      reason_need_damage: 'Adds damage',
      reason_need_save: 'Has a save',
      reason_need_scaling: 'Adds scaling',
      reason_need_push: 'Adds push',
      need_initiation: 'Initiation',
      need_disable: 'Control',
      need_frontline: 'Frontline',
      need_damage: 'Damage',
      need_save: 'Save',
      need_scaling: 'Scaling',
      need_push: 'Push',
      teamNeedsTitle: 'Composition',
      teamNeedsSub: 'heuristic',
      teamNeedsEmpty: 'Add allies to see your composition strengths and gaps.',
      refresh: 'Refresh data',
      refreshData: 'Refresh from OpenDota',
      refreshHint: 'Fetches fresh meta and matchup data. Usually takes 3–4 minutes.',
      refreshRunning: 'Refreshing data…',
      refreshDone: 'Data updated',
      refreshFailed: 'Could not refresh data',
      refreshStarted: 'Refresh started — you can keep drafting',
      refreshPhaseHeroes: 'Loading hero list',
      refreshPhaseMatchups: 'Downloading matchups',
      refreshPhaseSaving: 'Saving dataset',
      refreshPhaseDone: 'Done',
      refreshPhaseError: 'Refresh error',
      dataStats: 'Current snapshot',
      heroesLabel: 'Heroes',
      matchupsLabel: 'matchups',
      sourceLabel: 'Source',
      generatedLabel: 'Generated',
      sourcesTitle: 'Data sources',
      sourceOpenDotaDesc: 'Primary data: public matches, win rates, matchups.',
      sourceDotabuffDesc: 'Links to guides and counters. No public API.',
      sourceStratzDesc: 'Hero page links. API requires a token.',
      sourceValveDesc: 'Official hero portraits via Steam CDN.',
      language: 'Language',
      preset: 'Recommendation style',
      presetBalanced: 'Balanced',
      presetBalancedDesc: 'A bit of everything.',
      presetCounters: 'Counters',
      presetCountersDesc: 'Leans on enemy matchup data.',
      presetMeta: 'Meta',
      presetMetaDesc: 'Prioritises win rate and popularity.',
      presetComfort: 'Comfort',
      presetComfortDesc: 'Gives more weight to the hero’s signature role.',
      about: 'About',
      aboutText: 'Dota Draft Assistant 2.0 runs locally in your browser. Your draft is stored on this computer only. Data refresh contacts OpenDota.',
      versionLabel: 'Version',
      confirmResetTitle: 'Reset draft?',
      confirmResetText: 'Both teams will be cleared. Your role and settings stay.',
      confirmClearText: 'Clear the “{team}” team?',
      confirmClearBtn: 'Clear',
      terminateConfirmTitle: 'Terminate the app?',
      terminateConfirmSub: 'The local server will be stopped.',
      terminateConfirmText: 'This tab will stop working. Your draft is saved in the browser and will be restored on the next launch.',
      terminateConfirmBtn: 'Terminate',
      shutdownFailed: 'Could not stop the server',
      errorGeneric: 'Something went wrong',
      errorLoad: 'Could not load data',
      noResults: 'Nothing found',
      slot: 'Slot {n}',
      emptySlot: 'Empty slot {n}',
      menuHint: 'Drag the hero into any slot or choose a team here.',
      menuAlly: 'To my team',
      menuEnemy: 'To the enemy team',
      menuMoveAlly: 'Move to my team',
      menuMoveEnemy: 'Move to enemies',
      menuRemove: 'Remove from team',
      tierTop: 'TOP',
      tierLow: 'LOW',
      grade: 'grade',
      refreshError: 'Error',
      refreshing: 'Refreshing…',
      retry: 'Retry',
      recError: 'Could not get recommendations',
      allPicked: 'All heroes are already assigned to teams.',
      noData: 'no data',
      switchLanguage: 'Switch language',
      close: 'Close',
      cancel: 'Cancel',
      confirm: 'Confirm',
      resetConfirm: 'Reset',
      settingsSub: 'Local app · OpenDota data',
      searchHint: 'Search by hero name',
      poolCountTitle: '{visible} of {total} heroes',
    },
  };

  const state = {
    data: null,
    heroById: new Map(),
    draft: { allies: [null, null, null, null, null], enemies: [null, null, null, null, null], role: 1, preset: 'balanced' },
    lang: 'ru',
    showWorst: true,
    filters: { search: '', attr: 'all', pos: 0 },
    rec: null,
    recLoading: false,
    recError: null,
    recAbort: null,
    recTimer: null,
    recSeq: 0,
    drag: null,
    refresh: null,
    refreshPoll: null,
    pollingRefresh: false,
    modalKind: null,
    modalOnClose: null,
    modalPrevFocus: null,
    lastTopId: null,
    heroMenu: null,
  };

  function t(key, vars) {
    const dict = I18N[state.lang] || I18N.ru;
    let value = dict[key] ?? I18N.ru[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        value = value.replaceAll(`{${k}}`, String(v));
      }
    }
    return value;
  }

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (m) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));

  const locale = () => (state.lang === 'ru' ? 'ru-RU' : 'en-US');
  const nf = () => new Intl.NumberFormat(locale());
  const fmtInt = (v) => nf().format(Math.round(Number(v) || 0));
  const fmtPct = (v) => `${(Number(v) || 0).toFixed(1)}%`;
  const signedPct = (v) => `${Number(v) >= 0 ? '+' : ''}${(Number(v) || 0).toFixed(1)}%`;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function roleName(role) { return (ROLE_NAMES[state.lang] || ROLE_NAMES.ru)[role - 1] || ''; }
  function roleShort(role) { return (ROLE_SHORT[state.lang] || ROLE_SHORT.ru)[role - 1] || ''; }
  function attrLabel(attr) { return (ATTR_LABELS[state.lang] || ATTR_LABELS.ru)[attr] || attr; }
  function tagLabel(tag) { return (TAG_LABELS[state.lang] || TAG_LABELS.ru)[tag] || tag; }
  function heroName(id) { return state.heroById.get(Number(id))?.name || '?'; }
  function heroById(id) { return state.heroById.get(Number(id)); }

  function arrKey(side) { return side === 'ally' ? 'allies' : 'enemies'; }
  function sideLabel(side) { return side === 'ally' ? t('yourTeam') : t('enemies'); }

  function findHeroSlot(id) {
    const numeric = Number(id);
    for (const side of ['ally', 'enemy']) {
      const arr = state.draft[arrKey(side)];
      const index = arr.indexOf(numeric);
      if (index >= 0) return { side, index };
    }
    return null;
  }

  function laneInfo(id) {
    if (!state.rec || !Array.isArray(state.rec.laneMap)) return null;
    return state.rec.laneMap.find((item) => Number(item.heroId) === Number(id)) || null;
  }

  function imgTag(hero, square = false) {
    const localPath = square && hero.icon ? hero.icon : hero.img;
    const local = localPath ? `/${String(localPath).replace(/^\/+/, '')}` : (hero.remoteImg || '');
    return `<img src="${esc(local)}" data-remote="${esc(hero.remoteImg || '')}" alt="${esc(hero.name)}" loading="lazy" decoding="async">`;
  }

  function bindImages(root = document) {
    $$('img[data-remote]', root).forEach((img) => {
      if (img.dataset.bound === '1') return;
      img.dataset.bound = '1';
      img.addEventListener('error', () => {
        const remote = img.dataset.remote || '';
        if (img.dataset.fallback !== '1' && remote && img.src !== remote) {
          img.dataset.fallback = '1';
          img.src = remote;
          return;
        }
        img.style.visibility = 'hidden';
      });
    });
  }

  function heroTitle(hero) {
    const bracket = hero.high && hero.high.picks >= 250 ? t('highBracket') : t('publicBracket');
    const roles = (hero.roles || []).map(tagLabel).join(', ');
    const positions = (hero.pos || [])
      .map((w, i) => ({ w, i: i + 1 }))
      .filter((x) => x.w >= 0.2)
      .map((x) => `${x.i} (${Math.round(x.w * 100)}%)`)
      .join(', ');
    return `${hero.name}\n${t('winrate')}: ${fmtPct(hero.highWinRate || hero.winRate)} (${bracket})\n${t('roleFit')}: ${roles}\n${t('position')}: ${positions}`;
  }

  function sourceLabel(source) {
    if (!source || source === 'public') return t('publicBracket');
    return t('highBracket');
  }

  function daysSince(iso) {
    const ts = Date.parse(iso || '');
    if (!Number.isFinite(ts)) return null;
    return Math.max(0, Math.floor((Date.now() - ts) / 86400000));
  }

  function ageLabel(iso) {
    const days = daysSince(iso);
    if (days === null) return '—';
    if (days === 0) return t('today');
    if (days === 1) return t('yesterday');
    return t('daysAgo', { n: days });
  }

  function fmtDate(iso) {
    const date = new Date(iso || '');
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }

  function fmtDateTime(iso) {
    const date = new Date(iso || '');
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(locale(), {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }).format(date);
  }

  function normalizeSlots(raw) {
    const out = [null, null, null, null, null];
    if (!Array.isArray(raw)) return out;
    for (let i = 0; i < Math.min(MAX_TEAM, raw.length); i++) {
      const n = Number(raw[i]);
      if (Number.isInteger(n) && n > 0) out[i] = n;
    }
    return out;
  }

  function loadSaved() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!raw) return;
      state.lang = raw.lang === 'en' ? 'en' : 'ru';
      state.showWorst = raw.showWorst !== false;
      state.draft.allies = normalizeSlots(raw.allies);
      state.draft.enemies = normalizeSlots(raw.enemies);
      const role = Number(raw.role);
      state.draft.role = role >= 1 && role <= 5 ? role : 1;
      state.draft.preset = PRESETS.includes(raw.preset) ? raw.preset : 'balanced';
    } catch {
      // Ignore a corrupted localStorage entry and start clean.
    }
  }

  function sanitizeDraft() {
    const seen = new Set();
    for (const key of ['allies', 'enemies']) {
      const next = [null, null, null, null, null];
      state.draft[key].forEach((id, i) => {
        const n = Number(id);
        if (Number.isInteger(n) && state.heroById.has(n) && !seen.has(n)) {
          seen.add(n);
          next[i] = n;
        }
      });
      state.draft[key] = next;
    }
    if (![1, 2, 3, 4, 5].includes(state.draft.role)) state.draft.role = 1;
    if (!PRESETS.includes(state.draft.preset)) state.draft.preset = 'balanced';
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        allies: state.draft.allies,
        enemies: state.draft.enemies,
        role: state.draft.role,
        preset: state.draft.preset,
        lang: state.lang,
        showWorst: state.showWorst,
      }));
    } catch {
      // Private mode / quota issues should not break the app.
    }
  }

  async function api(path, options = {}) {
    const method = options.method || 'GET';
    const headers = { ...(options.headers || {}) };
    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json';
      headers['X-Dota-Draft'] = '1';
    }
    const res = await fetch(path, { ...options, method, headers });
    let payload = null;
    try { payload = await res.json(); } catch { /* non-JSON error */ }
    if (!res.ok) {
      throw new Error(payload?.error || `HTTP ${res.status}`);
    }
    return payload;
  }

  // ---------------------------------------------------------------- rendering

  function applyLanguage() {
    document.documentElement.lang = state.lang;
    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    $('#langBtn').textContent = state.lang === 'ru' ? 'EN' : 'RU';
    $('#langBtn').title = t('switchLanguage');
    $('#langBtn').setAttribute('aria-label', t('switchLanguage'));
    $('#refreshBtn').title = t('update');
    $('#refreshBtn').setAttribute('aria-label', t('update'));
    $('#terminateBtn').title = t('terminate');
    $('#terminateBtn').setAttribute('aria-label', t('terminate'));
    $('#toggleWorst').textContent = state.showWorst ? t('hideWorst') : t('showWorst');
    document.title = `Dota Draft Assistant 2.0 — ${t('appTagline')}`;
    if (state.data) {
      updateRecTitle();
      renderMeta();
    }
  }

  function setLanguage(lang) {
    if (!I18N[lang] || state.lang === lang) return;
    state.lang = lang;
    persist();
    applyLanguage();
    renderAll({ refetch: false });
    if (state.modalKind === 'settings') openSettings();
  }

  function showApp() {
    $('#loadingScreen').classList.add('hide');
    $('#app').hidden = false;
    setTimeout(() => { $('#loadingScreen').hidden = true; }, 360);
  }

  function showFatal(error) {
    $('#app').hidden = true;
    $('#loadingScreen').hidden = true;
    $('#fatalScreen').hidden = false;
    const detail = error?.message || String(error || t('errorLoad'));
    $('#fatalDetail').textContent = detail;
  }

  function showTerminated() {
    stopRefreshPolling();
    closeModal(false);
    closeHeroMenu();
    $('#app').hidden = true;
    $('#loadingScreen').hidden = true;
    $('#fatalScreen').hidden = true;
    $('#terminatedScreen').hidden = false;
    const platform = state.data?.platform;
    $('#terminatedHint').textContent = platform === 'windows' ? t('restartWindows') : t('restartLinux');
    document.title = `${t('terminatedTitle')} — Dota Draft Assistant 2.0`;
    setTimeout(() => $('#terminatedClose')?.focus(), 50);
  }

  function renderAll({ refetch = true } = {}) {
    if (!state.data) return;
    const pool = $('#heroPool');
    const scroll = pool ? pool.scrollTop : 0;
    renderRoleSelect();
    renderFilters();
    renderPool();
    if (pool) pool.scrollTop = scroll;
    renderSlots('ally');
    renderSlots('enemy');
    renderMeta();
    updateCounts();
    renderDraftHint();
    renderTeamNeeds();
    renderRec();
    if (refetch) requestRecommendations({ immediate: true });
  }

  function renderRoleSelect() {
    const container = $('#roleSelect');
    if (!container) return;
    container.innerHTML = POSITIONS.map((role) => `
      <button class="role-btn ${state.draft.role === role ? 'active' : ''}" type="button"
        data-role="${role}" role="radio" aria-checked="${state.draft.role === role}"
        title="${esc(roleName(role))}">
        <span class="num">${role}</span>
        <span class="lbl">${esc(roleShort(role))}</span>
      </button>
    `).join('');
    updateRecTitle();
  }

  function updateRecTitle() {
    const title = $('#recTitle');
    if (title) title.textContent = `${t('position')} ${state.draft.role} · ${roleName(state.draft.role)}`;
  }

  function renderFilters() {
    // Keep "all" unambiguous for screen readers while preserving the colour dot.
    const filterHTML = [
      `<button class="chip ${state.filters.attr === 'all' ? 'active' : ''}" type="button" data-attr="all"><span class="dot" style="background:var(--text)"></span>${esc(t('attrAll'))}</button>`,
      `<button class="chip ${state.filters.attr === 'str' ? 'active' : ''}" type="button" data-attr="str"><span class="dot"></span>${esc(t('attrStr'))}</button>`,
      `<button class="chip ${state.filters.attr === 'agi' ? 'active' : ''}" type="button" data-attr="agi"><span class="dot"></span>${esc(t('attrAgi'))}</button>`,
      `<button class="chip ${state.filters.attr === 'int' ? 'active' : ''}" type="button" data-attr="int"><span class="dot"></span>${esc(t('attrInt'))}</button>`,
      `<button class="chip ${state.filters.attr === 'universal' ? 'active' : ''}" type="button" data-attr="universal"><span class="dot"></span>${esc(t('attrUniversal'))}</button>`,
    ];
    $('#attrFilters').innerHTML = filterHTML.join('');

    const select = $('#posFilter');
    select.innerHTML = `<option value="0">${esc(t('all'))}</option>` + POSITIONS.map((role) => (
      `<option value="${role}">${role} · ${esc(roleName(role))}</option>`
    )).join('');
    select.value = String(state.filters.pos || 0);
  }

  function renderPool() {
    const pool = $('#heroPool');
    if (!pool) return;
    const query = state.filters.search.trim().toLowerCase();
    const heroes = Array.from(state.heroById.values())
      .filter((hero) => {
        if (state.filters.attr === 'str' && hero.attr !== 'str') return false;
        if (state.filters.attr === 'agi' && hero.attr !== 'agi') return false;
        if (state.filters.attr === 'int' && hero.attr !== 'int') return false;
        if (state.filters.attr === 'universal' && hero.attr !== 'all') return false;
        if (state.filters.pos && !(hero.pos?.[state.filters.pos - 1] >= 0.15)) return false;
        if (query) {
          const haystack = `${hero.name} ${hero.key}`.toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, state.lang === 'ru' ? 'ru' : 'en'));

    const count = $('#poolCount');
    if (count) {
      count.textContent = fmtInt(heroes.length);
      count.title = t('poolCountTitle', { visible: heroes.length, total: state.heroById.size });
    }

    if (!heroes.length) {
      pool.innerHTML = `<div class="pool-empty">${esc(t('noResults'))}</div>`;
      return;
    }

    pool.innerHTML = heroes.map((hero) => {
      const slot = findHeroSlot(hero.id);
      const picked = slot ? `picked picked-${slot.side}` : '';
      return `
        <button class="hero-card attr-${esc(hero.attr)} ${picked}" type="button"
          draggable="true" data-hero-id="${hero.id}"
          title="${esc(heroTitle(hero))}"
          aria-label="${esc(`${hero.name}, ${t('winrate')} ${fmtPct(hero.winRate)}`)}">
          ${imgTag(hero)}
          <span class="hero-pos">${hero.primaryPos}</span>
          <span class="hero-attr"></span>
          <span class="hero-name">${esc(hero.name)}</span>
          ${slot ? '<span class="pick-mark"></span>' : ''}
        </button>
      `;
    }).join('');
    bindImages(pool);
  }

  function renderSlots(side) {
    const container = side === 'ally' ? $('#allySlots') : $('#enemySlots');
    if (!container) return;
    const arr = state.draft[arrKey(side)];
    const html = arr.map((id, index) => {
      if (!id) {
        return `
          <button class="slot empty" type="button" data-side="${side}" data-index="${index}"
            aria-label="${esc(t('emptySlot', { n: index + 1 }))}">
            <span class="plus">+</span><span>${esc(t('slot', { n: index + 1 }))}</span>
          </button>
        `;
      }
      const hero = heroById(id);
      if (!hero) return '';
      const lane = side === 'enemy' ? laneInfo(id) : null;
      let badge;
      if (lane) {
        const known = Number(lane.confidence) >= 0.25;
        badge = `<span class="slot-pos ${known ? 'lane' : 'unknown'}" title="${esc(t('estimatedRole'))}">${known ? `~${lane.role}` : '?'}</span>`;
      } else {
        badge = `<span class="slot-pos" title="${esc(t('position'))}">${hero.primaryPos}</span>`;
      }
      return `
        <div class="slot filled" data-side="${side}" data-index="${index}" data-hero-id="${hero.id}"
          draggable="true" tabindex="0" role="button"
          title="${esc(heroTitle(hero))}"
          aria-label="${esc(`${hero.name}, ${sideLabel(side)}`)}">
          ${imgTag(hero)}
          <span class="slot-shade"></span>
          ${badge}
          <button class="slot-remove" type="button" data-action="remove"
            aria-label="${esc(t('menuRemove'))}" title="${esc(t('menuRemove'))}">
            <svg class="icon"><use href="#i-close"/></svg>
          </button>
          <span class="slot-name">${esc(hero.name)}</span>
        </div>
      `;
    }).join('');
    container.innerHTML = html;
    bindImages(container);
  }

  function updateCounts() {
    const allies = state.draft.allies.filter(Boolean).length;
    const enemies = state.draft.enemies.filter(Boolean).length;
    $('#allyCount').textContent = `${allies} / ${MAX_TEAM}`;
    $('#enemyCount').textContent = `${enemies} / ${MAX_TEAM}`;
    const clearA = $('#clearAllies');
    const clearE = $('#clearEnemies');
    if (clearA) clearA.disabled = allies === 0;
    if (clearE) clearE.disabled = enemies === 0;
    const reset = $('#resetBtn');
    if (reset) reset.disabled = allies + enemies === 0;
    const swap = $('#swapSidesBtn');
    if (swap) swap.disabled = allies + enemies === 0;
  }

  function renderDraftHint() {
    const hint = $('#draftHint');
    if (!hint) return;
    const allies = state.draft.allies.filter(Boolean).length;
    const enemies = state.draft.enemies.filter(Boolean).length;
    if (allies + enemies === 0) hint.textContent = t('hintStart');
    else if (enemies === 0) hint.textContent = t('hintNoEnemies');
    else if (allies === 0) hint.textContent = t('hintNoAllies');
    else hint.textContent = t('hintDrag');
  }

  function renderMeta() {
    if (!state.data) return;
    const meta = state.data.meta || {};
    const days = daysSince(meta.generatedAt);
    $('#metaPatch').textContent = meta.patch || '—';
    $('#metaAge').textContent = ageLabel(meta.generatedAt);
    const chip = $('#metaChip');
    chip.classList.toggle('stale', days !== null && days > 7);
    chip.title = `${meta.source || 'OpenDota'} · ${t('generatedLabel')}: ${fmtDateTime(meta.generatedAt)} · ${fmtInt(meta.totalMatchups)} ${t('matchupsLabel')}`;
    $('#footerData').textContent = t('dataFooter', { date: fmtDate(meta.generatedAt), patch: meta.patch || '—' });
    $('#footerVersion').textContent = `v${state.data.version || '2.0.0'}`;
  }

  // ------------------------------------------------------------ recommendations

  function requestRecommendations({ immediate = false } = {}) {
    if (!state.data) return;
    clearTimeout(state.recTimer);
    state.recError = null;
    setRecLoading(true);
    state.recTimer = setTimeout(fetchRecommendations, immediate ? 0 : 110);
  }

  async function fetchRecommendations() {
    if (!state.data) return;
    const seq = ++state.recSeq;
    if (state.recAbort) state.recAbort.abort();
    state.recAbort = new AbortController();
    const payload = {
      role: state.draft.role,
      allies: state.draft.allies.filter(Boolean),
      enemies: state.draft.enemies.filter(Boolean),
      preset: state.draft.preset,
    };
    try {
      const rec = await api('/api/recommend', {
        method: 'POST',
        body: JSON.stringify(payload),
        signal: state.recAbort.signal,
      });
      if (seq !== state.recSeq) return;
      state.rec = rec;
      state.recError = null;
      setRecLoading(false);
      renderRec();
      renderSlots('enemy');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      if (seq !== state.recSeq) return;
      state.recError = error?.message || t('errorGeneric');
      setRecLoading(false);
      renderRec();
      toast(`${t('recError')}: ${state.recError}`, 'error');
    }
  }

  function setRecLoading(loading) {
    state.recLoading = loading;
    const panel = $('#recPanel');
    if (panel) {
      panel.classList.toggle('loading', loading);
      panel.setAttribute('aria-busy', loading ? 'true' : 'false');
    }
    if (loading && !state.rec) renderRec();
  }

  function renderRec() {
    const body = $('#recBody');
    if (!body) return;
    updateRecTitle();
    const rec = state.rec;
    if (!rec) {
      if (state.recError) {
        body.innerHTML = `
          <div class="rec-empty">
            <p>${esc(t('recError'))}</p>
            <p style="margin-top:6px;color:var(--muted-2)">${esc(state.recError)}</p>
            <button class="link-btn" type="button" data-retry-rec style="margin-top:9px">${esc(t('retry'))}</button>
          </div>`;
        body.querySelector('[data-retry-rec]')?.addEventListener('click', () => requestRecommendations({ immediate: true }));
      } else if (state.recLoading) {
        body.innerHTML = `<div class="rec-skeleton"><div class="sk-top"></div><div class="sk-row"></div><div class="sk-row"></div><div class="sk-row"></div></div>`;
      } else {
        body.innerHTML = `<div class="rec-empty">${esc(t('hintStart'))}</div>`;
      }
      renderRoleMatrix(null);
      renderTeamNeeds();
      return;
    }

    const hints = [];
    if (!state.draft.enemies.some(Boolean)) {
      hints.push(`<div class="rec-hint"><svg class="icon"><use href="#i-info"/></svg><span>${esc(t('hintNoEnemies'))}</span></div>`);
    }
    if (!state.draft.allies.some(Boolean)) {
      hints.push(`<div class="rec-hint muted"><svg class="icon"><use href="#i-users"/></svg><span>${esc(t('hintNoAllies'))}</span></div>`);
    }
    const days = daysSince(state.data?.meta?.generatedAt);
    if (days !== null && days > 7) {
      hints.push(`<div class="rec-hint muted"><svg class="icon"><use href="#i-clock"/></svg><span>${esc(t('hintOldData'))}</span></div>`);
    }

    const list = rec.recommendations || [];
    if (!list.length) {
      body.innerHTML = hints.join('') + `<div class="rec-empty">${esc(t('allPicked'))}</div>`;
      renderRoleMatrix(rec);
      renderTeamNeeds();
      return;
    }

    const top = list[0];
    const rows = list.slice(1).map((item, index) => recRowHTML(item, index + 2)).join('');
    body.innerHTML = hints.join('') + topPickHTML(top) + (rows ? `<div class="rec-list">${rows}</div>` : '');
    bindImages(body);
    renderRoleMatrix(rec);
    renderTeamNeeds();
  }

  function componentHTML(rec) {
    const parts = [
      ['counter', t('counter'), rec.components?.counter],
      ['meta', t('meta'), rec.components?.meta],
      ['synergy', t('synergy'), rec.components?.synergy],
      ['role', t('roleFit'), rec.components?.role],
    ];
    return `<div class="components">${parts.map(([key, label, value]) => `
      <div class="component ${key}">
        <div class="component-top"><span>${esc(label)}</span><b>${(Number(value) || 0).toFixed(1)}</b></div>
        <div class="component-bar"><i style="width:${clamp(Number(value) || 0, 0, 100)}%"></i></div>
      </div>`).join('')}</div>`;
  }

  function reasonsHTML(rec) {
    const reasons = rec.reasons?.length ? rec.reasons : [{ code: 'solid_pick' }];
    return `<div class="top-pick-reasons">${reasons.map((reason) => reasonChip(reason)).join('')}</div>`;
  }

  function topPickHTML(rec) {
    const hero = heroById(rec.heroId);
    if (!hero) return '';
    const grade = rec.grade || 'C';
    const color = GRADE_COLORS[grade] || GRADE_COLORS.C;
    const emptySlot = state.draft.allies.includes(null);
    const addDisabled = emptySlot ? '' : 'disabled';
    const counter = rec.counter || {};
    const meta = rec.meta || {};
    const metaBits = [
      `${t('winrate')} <b>${fmtPct(meta.winRate)}</b>`,
      `${fmtInt(meta.picks)} ${t('picks')}`,
      `${sourceLabel(meta.source)}`,
    ];
    if (counter.games) {
      metaBits.push(`${t('counter')} <b>${signedPct(counter.avgDelta)}</b>`);
      metaBits.push(`${t('confidence')} ${Math.round((Number(counter.confidence) || 0) * 100)}%`);
    }
    if (counter.laneDelta !== undefined && counter.laneDelta !== null) {
      metaBits.push(`${t('lane')} <b>${signedPct(counter.laneDelta)}</b>`);
    }

    return `
      <article class="top-pick" data-rec-hero="${hero.id}">
        <div class="top-pick-bg">${imgTag(hero)}</div>
        <div class="top-pick-inner">
          <div class="top-pick-label"><svg class="icon"><use href="#i-spark"/></svg>${esc(t('topPick'))}</div>
          <div class="top-pick-head">
            <div class="top-pick-portrait">${imgTag(hero)}</div>
            <div class="top-pick-name">
              <h3>${esc(hero.name)}</h3>
              <div class="hero-line">
                <span class="pill">${esc(attrLabel(hero.attr))}</span>
                <span class="pill gold">${esc(roleShort(state.draft.role))} · ${state.draft.role}</span>
                <span class="pill ${grade === 'S' || grade === 'A' ? 'green' : ''}">${esc(grade)}</span>
              </div>
            </div>
            <div class="top-pick-score">
              <div class="score-ring" style="--score:${clamp(Number(rec.score) || 0, 0, 100)};--grade-color:${color}"><b>${(Number(rec.score) || 0).toFixed(1)}</b></div>
              <span class="grade-badge grade-${esc(grade)}">${esc(grade)}</span>
            </div>
          </div>
          ${reasonsHTML(rec)}
          ${componentHTML(rec)}
          <div class="top-pick-actions">
            <button class="primary-btn" type="button" data-add-hero="${hero.id}" ${addDisabled}
              title="${esc(emptySlot ? t('addToTeam') : t('noEmptySlot'))}">${esc(t('addToTeam'))}</button>
            <a class="icon-btn" href="https://www.dotabuff.com/heroes/${encodeURIComponent(hero.key)}/counters" target="_blank" rel="noreferrer" title="Dotabuff counters" aria-label="Dotabuff counters"><svg class="icon"><use href="#i-external"/></svg></a>
            <a class="icon-btn" href="https://stratz.com/heroes/${hero.id}" target="_blank" rel="noreferrer" title="Stratz" aria-label="Stratz"><svg class="icon"><use href="#i-external"/></svg></a>
          </div>
          <div class="top-pick-meta">${metaBits.map((bit) => `<span>${bit}</span>`).join('<span class="sep">·</span>')}</div>
        </div>
      </article>
    `;
  }

  function recRowHTML(rec, rank) {
    const hero = heroById(rec.heroId);
    if (!hero) return '';
    const grade = rec.grade || 'C';
    const sub = rec.counter?.games
      ? `${t('counter')} ${signedPct(rec.counter.avgDelta)} · ${fmtInt(rec.counter.games)} ${t('games')}`
      : `${t('meta')} ${fmtPct(rec.meta?.winRate)} · ${fmtInt(rec.meta?.picks)} ${t('picks')}`;
    return `
      <div class="rec-row" data-rec-hero="${hero.id}" role="button" tabindex="0" aria-label="${esc(`${hero.name}, ${rec.score}`)}">
        <span class="rec-rank">${rank}</span>
        <span class="rec-portrait">${imgTag(hero)}</span>
        <span class="rec-info">
          <span class="rec-name"><span>${esc(hero.name)}</span><span class="grade-badge grade-${esc(grade)}">${esc(grade)}</span></span>
          <span class="rec-sub">${esc(sub)}</span>
        </span>
        <span class="rec-right">
          <span class="rec-score">${(Number(rec.score) || 0).toFixed(1)}</span>
          <button class="rec-add" type="button" data-add-hero="${hero.id}" title="${esc(t('addToTeam'))}" aria-label="${esc(t('addToTeam'))}">
            <svg class="icon"><use href="#i-plus"/></svg>
          </button>
        </span>
      </div>
    `;
  }

  function reasonChip(reason) {
    const code = reason?.code || 'solid_pick';
    const negative = ['risky', 'meta_bad', 'low_data', 'off_role'].includes(code);
    const icon = negative ? 'i-warning' : code === 'lane_counter' || code === 'counter' ? 'i-sword' : 'i-check';
    const text = reasonText(reason);
    return `<span class="reason ${negative ? 'negative' : 'positive'}" title="${esc(text)}"><svg class="icon"><use href="#${icon}"/></svg>${esc(text)}</span>`;
  }

  function reasonText(reason) {
    const code = reason?.code || '';
    const hero = reason?.heroId ? heroName(reason.heroId) : '';
    const value = Number(reason?.value) || 0;
    switch (code) {
      case 'lane_counter': return t('reason_lane_counter', { hero, value: signedPct(value) });
      case 'counter': return t('reason_counter', { hero, value: signedPct(value) });
      case 'risky': return t('reason_risky', { hero, value: signedPct(value) });
      case 'meta_good': return t('reason_meta_good', { value: fmtPct(value) });
      case 'meta_bad': return t('reason_meta_bad', { value: fmtPct(value) });
      case 'role_fit': return t('reason_role_fit', { value: fmtPct(value) });
      case 'off_role': return t('reason_off_role', { value: fmtPct(value) });
      case 'synergy_ally': return t('reason_synergy_ally', { hero });
      case 'low_data': return t('reason_low_data', { value: fmtInt(value) });
      case 'solid_pick': return t('reason_solid_pick');
      default:
        if (code.startsWith('need_')) return t(`reason_${code}`);
        return code;
    }
  }

  function renderTeamNeeds() {
    const container = $('#teamNeeds');
    if (!container) return;
    const allies = state.draft.allies.filter(Boolean).length;
    const needs = state.rec?.team?.needs || NEED_KEYS.map((key) => ({ key, have: 0, target: 1, fulfilled: 0 }));
    const head = `
      <div class="needs-head">
        <h3>${esc(t('teamNeedsTitle'))}</h3>
        <span title="${esc(t('teamNeedsSub'))}">${esc(t('teamNeedsSub'))}</span>
      </div>`;
    const chips = needs.map((need) => {
      const fulfilled = Number(need.fulfilled) || 0;
      const stateClass = fulfilled >= 0.999 ? 'ok' : fulfilled >= 0.5 ? 'mid' : 'miss';
      const target = Math.ceil(Number(need.target) || 1);
      return `
        <div class="need ${stateClass}" title="${esc(t(`need_${need.key}`))}: ${need.have}/${target}">
          <div class="need-top"><span class="need-label">${esc(t(`need_${need.key}`))}</span><span class="need-val">${need.have}/${target}</span></div>
          <div class="need-bar"><i style="width:${clamp(fulfilled * 100, 0, 100)}%"></i></div>
        </div>`;
    }).join('');
    const empty = allies === 0 ? `<div class="needs-empty">${esc(t('teamNeedsEmpty'))}</div>` : '';
    container.innerHTML = head + chips + empty;
  }

  function renderRoleMatrix(rec = state.rec) {
    const container = $('#roleMatrix');
    if (!container) return;
    const toggle = $('#toggleWorst');
    if (toggle) toggle.textContent = state.showWorst ? t('hideWorst') : t('showWorst');

    if (!rec) {
      container.innerHTML = POSITIONS.map((role) => `
        <div class="matrix-row ${state.draft.role === role ? 'active' : ''}">
          <div class="matrix-role"><span class="pos">${role}</span><span class="name">${esc(roleName(role))}</span></div>
          <div class="matrix-picks"><span class="matrix-more">—</span></div>
        </div>`).join('');
      return;
    }

    const blocks = new Map((rec.roles || []).map((block) => [Number(block.role), block]));
    container.innerHTML = POSITIONS.map((role) => {
      const block = blocks.get(role);
      const best = block?.best || [];
      const worst = (block?.worst || []).slice().reverse();
      const bestHTML = best.map((pick) => miniHeroHTML(pick, false)).join('');
      const worstHTML = state.showWorst ? worst.map((pick) => miniHeroHTML(pick, true)).join('') : '';
      const gap = state.showWorst && worstHTML ? '<span class="matrix-gap"></span>' : '';
      return `
        <div class="matrix-row ${state.draft.role === role ? 'active' : ''}">
          <div class="matrix-role"><span class="pos">${role}</span><span class="name" title="${esc(roleName(role))}">${esc(roleShort(role))}</span></div>
          <div class="matrix-picks">${bestHTML}${gap}${worstHTML || (bestHTML ? '' : `<span class="matrix-more">${esc(t('noData'))}</span>`)}</div>
        </div>`;
    }).join('');
    bindImages(container);
  }

  function miniHeroHTML(pick, low) {
    const hero = heroById(pick.heroId);
    if (!hero) return '';
    const title = `${hero.name} · ${Number(pick.score || 0).toFixed(1)} · ${pick.grade || ''}`;
    return `
      <button class="mini-hero ${low ? 'low' : ''}" type="button" data-add-hero="${hero.id}"
        title="${esc(title)}" aria-label="${esc(title)}">
        ${imgTag(hero, true)}
        <span class="mini-score">${Math.round(Number(pick.score) || 0)}</span>
      </button>`;
  }

  // ------------------------------------------------------------- draft actions

  function afterDraftChange() {
    persist();
    const pool = $('#heroPool');
    const scroll = pool ? pool.scrollTop : 0;
    renderPool();
    if (pool) pool.scrollTop = scroll;
    renderSlots('ally');
    renderSlots('enemy');
    updateCounts();
    renderDraftHint();
    requestRecommendations();
  }

  function addHero(heroId, side) {
    const hero = heroById(heroId);
    if (!hero) return;
    const current = findHeroSlot(heroId);
    if (current && current.side === side) {
      toast(t('alreadyPicked', { hero: hero.name }), 'info');
      return;
    }
    const arr = state.draft[arrKey(side)];
    const index = arr.indexOf(null);
    if (index < 0) {
      toast(t('noEmptySlot'), 'error');
      return;
    }
    if (current) state.draft[arrKey(current.side)][current.index] = null;
    arr[index] = hero.id;
    closeHeroMenu();
    afterDraftChange();
    toast(t('added', { hero: hero.name }), 'success');
  }

  function removeHero(side, index) {
    const arr = state.draft[arrKey(side)];
    const id = arr[index];
    if (!id) return;
    const hero = heroById(id);
    arr[index] = null;
    afterDraftChange();
    if (hero) toast(t('removed', { hero: hero.name }), 'info');
  }

  function removeHeroById(id) {
    const slot = findHeroSlot(id);
    if (slot) removeHero(slot.side, slot.index);
  }

  function handleDrop(drag, side, targetIndex) {
    if (!drag) return;
    const heroId = Number(drag.heroId);
    const targetArr = state.draft[arrKey(side)];
    const source = drag.side ? { side: drag.side, index: drag.index } : null;
    if (source && source.side === side && source.index === targetIndex) return;

    const existing = findHeroSlot(heroId);
    if (source && existing && (existing.side !== source.side || existing.index !== source.index)) {
      // The card moved between dragstart and drop (e.g. a background re-render).
      drag = { heroId, side: existing.side, index: existing.index };
    }

    let index = targetIndex;
    if (index === null || index === undefined) index = targetArr.indexOf(null);
    if (index < 0) {
      toast(t('noEmptySlot'), 'error');
      return;
    }

    if (existing) state.draft[arrKey(existing.side)][existing.index] = null;
    const occupant = targetArr[index];
    if (occupant && occupant !== heroId) {
      let alt = -1;
      if (source && source.side === side) alt = source.index;
      if (alt < 0) alt = targetArr.indexOf(null);
      if (alt < 0) {
        if (existing) state.draft[arrKey(existing.side)][existing.index] = heroId;
        toast(t('noEmptySlot'), 'error');
        return;
      }
      targetArr[alt] = occupant;
    }
    targetArr[index] = heroId;
    afterDraftChange();
  }

  function clearTeam(side) {
    const arr = state.draft[arrKey(side)];
    if (!arr.some(Boolean)) return;
    confirmDialog({
      title: t('confirmClearTitle'),
      subtitle: sideLabel(side),
      body: `<p class="danger-copy">${esc(t('confirmClearText', { team: sideLabel(side) }))}</p>`,
      confirmLabel: t('confirmClearBtn'),
    }).then((ok) => {
      if (!ok) return;
      state.draft[arrKey(side)] = [null, null, null, null, null];
      afterDraftChange();
      toast(t('cleared'), 'info');
    });
  }

  function resetDraft() {
    if (!state.draft.allies.some(Boolean) && !state.draft.enemies.some(Boolean)) {
      toast(t('draftEmpty'), 'info');
      return;
    }
    confirmDialog({
      title: t('confirmResetTitle'),
      subtitle: t('reset'),
      body: `<p class="danger-copy">${esc(t('confirmResetText'))}</p>`,
      confirmLabel: t('resetConfirm'),
    }).then((ok) => {
      if (!ok) return;
      state.draft.allies = [null, null, null, null, null];
      state.draft.enemies = [null, null, null, null, null];
      afterDraftChange();
      toast(t('resetDone'), 'success');
    });
  }

  function swapSides() {
    const allies = state.draft.allies.slice();
    const enemies = state.draft.enemies.slice();
    if (!allies.some(Boolean) && !enemies.some(Boolean)) {
      toast(t('draftEmpty'), 'info');
      return;
    }
    state.draft.allies = enemies;
    state.draft.enemies = allies;
    afterDraftChange();
  }

  function setRole(role) {
    const next = Number(role);
    if (![1, 2, 3, 4, 5].includes(next) || next === state.draft.role) return;
    state.draft.role = next;
    persist();
    renderRoleSelect();
    renderRoleMatrix();
    requestRecommendations({ immediate: true });
  }

  function setPreset(preset) {
    if (!PRESETS.includes(preset) || state.draft.preset === preset) return;
    state.draft.preset = preset;
    persist();
    $$('.preset-card').forEach((card) => card.classList.toggle('active', card.dataset.preset === preset));
    requestRecommendations({ immediate: true });
  }

  // ------------------------------------------------------------- hero menu

  function closeHeroMenu() {
    if (state.heroMenu) {
      state.heroMenu.backdrop?.remove();
      state.heroMenu.menu?.remove();
      state.heroMenu = null;
    }
    document.removeEventListener('keydown', heroMenuEscape);
  }

  function heroMenuEscape(event) {
    if (event.key === 'Escape') closeHeroMenu();
  }

  function openHeroMenu(heroId, anchor) {
    const hero = heroById(heroId);
    if (!hero) return;
    closeHeroMenu();
    const current = findHeroSlot(heroId);
    const actions = [];
    if (current) {
      actions.push(`<button class="hero-menu-btn remove" type="button" data-menu-action="remove"><span class="dot" style="background:var(--dire)"></span>${esc(t('menuRemove'))}</button>`);
      if (current.side === 'ally') {
        actions.push(`<button class="hero-menu-btn enemy" type="button" data-menu-action="enemy"><span class="dot"></span>${esc(t('menuMoveEnemy'))}</button>`);
      } else {
        actions.push(`<button class="hero-menu-btn ally" type="button" data-menu-action="ally"><span class="dot"></span>${esc(t('menuMoveAlly'))}</button>`);
      }
    } else {
      actions.push(`<button class="hero-menu-btn ally" type="button" data-menu-action="ally"><span class="dot"></span>${esc(t('menuAlly'))}</button>`);
      actions.push(`<button class="hero-menu-btn enemy" type="button" data-menu-action="enemy"><span class="dot"></span>${esc(t('menuEnemy'))}</button>`);
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'hero-menu-backdrop';
    backdrop.addEventListener('pointerdown', closeHeroMenu);

    const menu = document.createElement('div');
    menu.className = 'hero-menu';
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', hero.name);
    menu.innerHTML = `
      <div class="hero-menu-head">
        <span class="hero-menu-img">${imgTag(hero)}</span>
        <span class="hero-menu-title">
          <h4>${esc(hero.name)}</h4>
          <p>${esc(t('winrate'))} ${fmtPct(hero.highWinRate || hero.winRate)} · ${esc(attrLabel(hero.attr))} · ${esc(roleShort(hero.primaryPos))} ${hero.primaryPos}</p>
        </span>
      </div>
      <div class="hero-menu-actions">${actions.join('')}</div>
      <div class="hero-menu-hint">${esc(t('menuHint'))}</div>
    `;
    menu.querySelectorAll('[data-menu-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.menuAction;
        closeHeroMenu();
        if (action === 'remove') {
          const slot = findHeroSlot(heroId);
          if (slot) removeHero(slot.side, slot.index);
        } else if (action === 'ally') {
          addHero(heroId, 'ally');
        } else if (action === 'enemy') {
          addHero(heroId, 'enemy');
        }
      });
    });

    document.body.append(backdrop, menu);
    bindImages(menu);
    state.heroMenu = { menu, backdrop };

    const rect = anchor?.getBoundingClientRect?.();
    if (rect && window.innerWidth > 560) {
      const width = 274;
      let left = rect.left + rect.width / 2 - width / 2;
      left = clamp(left, 8, window.innerWidth - width - 8);
      let top = rect.bottom + 8;
      const height = menu.offsetHeight || 160;
      if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 8);
      menu.style.left = `${left}px`;
      menu.style.top = `${top}px`;
    }
    menu.querySelector('button')?.focus({ preventScroll: true });
    document.addEventListener('keydown', heroMenuEscape);
  }

  // ------------------------------------------------------------- settings / modals

  function openSettings(scrollToData = false) {
    if (!state.data) return;
    const st = state.refresh || state.data.refresh || { running: false, phase: 'idle' };
    const meta = state.data.meta || {};
    const presets = [
      ['balanced', t('presetBalanced'), t('presetBalancedDesc')],
      ['counters', t('presetCounters'), t('presetCountersDesc')],
      ['meta', t('presetMeta'), t('presetMetaDesc')],
      ['comfort', t('presetComfort'), t('presetComfortDesc')],
    ];

    const sourceDescriptions = {
      opendota: t('sourceOpenDotaDesc'),
      dotabuff: t('sourceDotabuffDesc'),
      stratz: t('sourceStratzDesc'),
      valve: t('sourceValveDesc'),
    };

    const body = `
      <section class="modal-section">
        <div class="modal-label">${esc(t('language'))}</div>
        <div class="segmented" id="languageSegment">
          <button type="button" data-settings-lang="ru" class="${state.lang === 'ru' ? 'active' : ''}">Русский</button>
          <button type="button" data-settings-lang="en" class="${state.lang === 'en' ? 'active' : ''}">English</button>
        </div>
      </section>

      <section class="modal-section">
        <div class="modal-label">${esc(t('preset'))}</div>
        <div class="preset-grid">
          ${presets.map(([id, title, desc]) => `
            <button class="preset-card ${state.draft.preset === id ? 'active' : ''}" type="button" data-preset="${id}">
              <span class="radio"></span>
              <span><b>${esc(title)}</b><span>${esc(desc)}</span></span>
            </button>`).join('')}
        </div>
      </section>

      <section class="modal-section" id="settingsDataSection">
        <div class="modal-label">${esc(t('dataStats'))}</div>
        <div class="data-card">
          <div class="data-stats">
            <div class="data-stat"><span>${esc(t('patch'))}</span><b>${esc(meta.patch || '—')}</b></div>
            <div class="data-stat"><span>${esc(t('heroesLabel'))}</span><b>${fmtInt(meta.heroes)}</b></div>
            <div class="data-stat"><span>${esc(t('matchupsLabel'))}</span><b>${fmtInt(meta.totalMatchups)}</b></div>
            <div class="data-stat"><span>${esc(t('generatedLabel'))}</span><b>${esc(fmtDateTime(meta.generatedAt))}</b></div>
          </div>
          <div class="data-actions">
            <button class="primary-btn" id="doRefresh" type="button" style="height:32px;font-size:10px">${esc(st.running ? t('refreshing') : t('refreshData'))}</button>
            <span class="data-note" style="margin:0">${esc(t('refreshHint'))}</span>
          </div>
          <div class="refresh-box" id="refreshBox" ${st.running || st.phase === 'done' || st.phase === 'error' ? '' : 'hidden'}>
            <div class="progress-track"><i id="refreshBar" style="width:${st.total ? Math.round((st.done / st.total) * 100) : 0}%"></i></div>
            <div class="refresh-status"><span id="refreshPhase">${esc(refreshPhaseText(st))}</span><span id="refreshCount">${st.done || 0} / ${st.total || 0}</span></div>
            <div class="refresh-status"><span class="err" id="refreshError" ${st.error ? '' : 'hidden'}>${esc(st.error || '')}</span></div>
          </div>
        </div>
      </section>

      <section class="modal-section">
        <div class="modal-label">${esc(t('sourcesTitle'))}</div>
        <div class="source-list">
          ${(state.data.sources || []).map((source) => `
            <a class="source-row" href="${esc(source.url)}" target="_blank" rel="noreferrer">
              <span class="source-badge">${esc(source.name.slice(0, 2).toUpperCase())}</span>
              <span class="source-copy"><b>${esc(source.name)}</b><span>${esc(sourceDescriptions[source.id] || '')}</span></span>
              <svg class="icon"><use href="#i-external"/></svg>
            </a>`).join('')}
        </div>
      </section>

      <section class="modal-section">
        <div class="modal-label">${esc(t('about'))}</div>
        <div class="about-box">
          <b>Dota Draft Assistant 2.0</b> · ${esc(t('versionLabel'))} ${esc(state.data.version || '2.0.0')}<br>
          ${esc(t('aboutText'))}
        </div>
      </section>
    `;
    const footer = `<button class="secondary-btn" id="settingsClose" type="button">${esc(t('close'))}</button>`;
    openModal({
      kind: 'settings',
      title: t('settings'),
      subtitle: t('settingsSub'),
      body,
      footer,
    });

    $('#settingsClose').onclick = () => closeModal(false);
    $$('[data-settings-lang]').forEach((btn) => {
      btn.addEventListener('click', () => setLanguage(btn.dataset.settingsLang));
    });
    $$('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => setPreset(btn.dataset.preset));
    });
    $('#doRefresh')?.addEventListener('click', startRefresh);
    if (st.running) startRefreshPolling();
    updateRefreshUI();

    if (scrollToData) {
      setTimeout(() => {
        $('#settingsDataSection')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }, 60);
    }
  }

  function openModal({ kind = null, title, subtitle = '', body, footer = '', size = '' }) {
    closeModal(false);
    state.modalKind = kind;
    state.modalPrevFocus = document.activeElement;
    const root = $('#modalRoot');
    root.innerHTML = `
      <div class="modal-backdrop" data-modal-backdrop>
        <div class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
          <div class="modal-head">
            <div><h3 id="modalTitle">${esc(title)}</h3>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
            <button class="modal-close" id="modalClose" type="button" aria-label="${esc(t('close'))}">
              <svg class="icon"><use href="#i-close"/></svg>
            </button>
          </div>
          <div class="modal-body">${body}</div>
          ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
        </div>
      </div>`;
    document.body.classList.add('modal-open');
    document.addEventListener('keydown', modalKeydown);
    $('#modalClose').onclick = () => closeModal(false);
    root.querySelector('[data-modal-backdrop]').addEventListener('mousedown', (event) => {
      if (event.target === event.currentTarget) closeModal(false);
    });
    bindImages(root);
    setTimeout(() => {
      const first = root.querySelector('.modal button, .modal a, .modal input, .modal select');
      first?.focus();
    }, 30);
  }

  function closeModal(result = false) {
    const root = $('#modalRoot');
    if (!root || !root.firstElementChild) {
      state.modalKind = null;
      state.modalOnClose = null;
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', modalKeydown);
      return;
    }
    const callback = state.modalOnClose;
    state.modalOnClose = null;
    state.modalKind = null;
    root.innerHTML = '';
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', modalKeydown);
    if (callback) callback(result === true);
    if (state.modalPrevFocus && typeof state.modalPrevFocus.focus === 'function') {
      state.modalPrevFocus.focus();
    }
    state.modalPrevFocus = null;
  }

  function modalKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal(false);
      return;
    }
    if (event.key !== 'Tab') return;
    const modal = $('.modal');
    if (!modal) return;
    const items = $$('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]', modal)
      .filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function confirmDialog({ title, subtitle = '', body, confirmLabel, danger = false }) {
    return new Promise((resolve) => {
      openModal({
        kind: 'confirm',
        title,
        subtitle,
        body,
        size: 'small',
        footer: `
          <button class="secondary-btn" id="modalCancel" type="button">${esc(t('cancel'))}</button>
          <button class="${danger ? 'danger-btn' : 'primary-btn'}" id="modalConfirm" type="button">${esc(confirmLabel)}</button>`,
      });
      state.modalOnClose = (result) => resolve(result === true);
      $('#modalCancel').onclick = () => closeModal(false);
      $('#modalConfirm').onclick = () => closeModal(true);
    });
  }

  function refreshPhaseText(st) {
    if (!st) return '';
    switch (st.phase) {
      case 'heroes': return t('refreshPhaseHeroes');
      case 'matchups': return st.current ? `${t('refreshPhaseMatchups')} · ${st.current}` : t('refreshPhaseMatchups');
      case 'saving': return t('refreshPhaseSaving');
      case 'done': return t('refreshPhaseDone');
      case 'error': return t('refreshPhaseError');
      default: return t('refreshRunning');
    }
  }

  // ------------------------------------------------------------- data refresh

  function startRefresh() {
    if (state.refresh?.running) return;
    const btn = $('#doRefresh');
    if (btn) btn.disabled = true;
    api('/api/refresh', { method: 'POST' }).then((res) => {
      state.refresh = res.status || { running: true, phase: 'heroes', done: 0, total: 0 };
      updateRefreshUI();
      startRefreshPolling();
      toast(t('refreshStarted'), 'info');
    }).catch((error) => {
      if (btn) btn.disabled = false;
      toast(`${t('refreshFailed')}: ${error.message}`, 'error');
    });
  }

  function startRefreshPolling() {
    if (state.refreshPoll) return;
    state.refreshPoll = setInterval(pollRefresh, 1000);
    pollRefresh();
  }

  function stopRefreshPolling() {
    if (state.refreshPoll) clearInterval(state.refreshPoll);
    state.refreshPoll = null;
    state.pollingRefresh = false;
  }

  async function pollRefresh() {
    if (state.pollingRefresh) return;
    state.pollingRefresh = true;
    try {
      const st = await api('/api/refresh');
      state.refresh = st;
      updateRefreshUI();
      if (!st.running) {
        stopRefreshPolling();
        if (st.phase === 'done') {
          await refreshAppState();
          toast(t('refreshDone'), 'success');
        } else if (st.phase === 'error') {
          toast(`${t('refreshFailed')}: ${st.error || ''}`, 'error');
        }
      }
    } catch (error) {
      stopRefreshPolling();
    } finally {
      state.pollingRefresh = false;
    }
  }

  async function refreshAppState() {
    try {
      const data = await api('/api/state');
      state.data = data;
      state.heroById = new Map((data.heroes || []).map((hero) => [hero.id, hero]));
      state.refresh = data.refresh || state.refresh;
      sanitizeDraft();
      persist();
      renderAll({ refetch: true });
      if (state.modalKind === 'settings') openSettings();
    } catch (error) {
      toast(`${t('refreshFailed')}: ${error.message}`, 'error');
    }
  }

  function updateRefreshUI() {
    const st = state.refresh;
    const box = $('#refreshBox');
    if (!box) return;
    const active = st && (st.running || st.phase === 'done' || st.phase === 'error');
    box.hidden = !active;
    if (!active) return;
    const pct = st.total ? clamp(Math.round((st.done / st.total) * 100), 0, 100) : 0;
    const bar = $('#refreshBar');
    if (bar) bar.style.width = `${pct}%`;
    const phase = $('#refreshPhase');
    if (phase) phase.textContent = refreshPhaseText(st);
    const count = $('#refreshCount');
    if (count) count.textContent = `${st.done || 0} / ${st.total || 0}`;
    const err = $('#refreshError');
    if (err) {
      err.textContent = st.error || '';
      err.hidden = !st.error;
    }
    const btn = $('#doRefresh');
    if (btn) {
      btn.disabled = !!st.running;
      btn.textContent = st.running ? t('refreshing') : t('refreshData');
    }
  }

  // ------------------------------------------------------------- terminate

  async function terminateApp() {
    const ok = await confirmDialog({
      title: t('terminateConfirmTitle'),
      subtitle: t('terminateConfirmSub'),
      body: `<div class="confirm-icon"><svg class="icon"><use href="#i-power"/></svg></div><p class="danger-copy">${esc(t('terminateConfirmText'))}</p>`,
      confirmLabel: t('terminateConfirmBtn'),
      danger: true,
    });
    if (!ok) return;
    try {
      await api('/api/shutdown', { method: 'POST' });
      showTerminated();
    } catch (error) {
      toast(`${t('shutdownFailed')}: ${error.message}`, 'error');
    }
  }

  // ------------------------------------------------------------- toasts

  function toast(message, type = 'info') {
    const host = $('#toasts');
    if (!host) return;
    while (host.children.length >= 4) host.firstElementChild?.remove();
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icon = type === 'error' ? 'i-warning' : type === 'success' ? 'i-check' : 'i-info';
    el.innerHTML = `<svg class="icon"><use href="#${icon}"/></svg><span>${esc(message)}</span>`;
    host.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 220);
    }, 3400);
  }

  // ------------------------------------------------------------- events

  function bindEvents() {
    $('#searchInput').addEventListener('input', (event) => {
      state.filters.search = event.target.value;
      renderPool();
    });
    $('#searchInput').addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.target.value = '';
        state.filters.search = '';
        renderPool();
        event.target.blur();
      }
    });

    $('#attrFilters').addEventListener('click', (event) => {
      const btn = event.target.closest('[data-attr]');
      if (!btn) return;
      state.filters.attr = btn.dataset.attr;
      renderFilters();
      renderPool();
    });

    $('#posFilter').addEventListener('change', (event) => {
      state.filters.pos = Number(event.target.value) || 0;
      renderPool();
    });

    $('#clearFilters').addEventListener('click', () => {
      state.filters = { search: '', attr: 'all', pos: 0 };
      $('#searchInput').value = '';
      renderFilters();
      renderPool();
    });

    $('#roleSelect').addEventListener('click', (event) => {
      const btn = event.target.closest('[data-role]');
      if (btn) setRole(Number(btn.dataset.role));
    });

    $('#clearAllies').addEventListener('click', () => clearTeam('ally'));
    $('#clearEnemies').addEventListener('click', () => clearTeam('enemy'));
    $('#resetBtn').addEventListener('click', resetDraft);
    $('#swapSidesBtn').addEventListener('click', swapSides);

    $('#settingsBtn').addEventListener('click', () => openSettings(false));
    $('#refreshBtn').addEventListener('click', () => openSettings(true));
    $('#metaChip').addEventListener('click', () => openSettings(true));
    $('#terminateBtn').addEventListener('click', terminateApp);
    $('#langBtn').addEventListener('click', () => setLanguage(state.lang === 'ru' ? 'en' : 'ru'));

    $('#toggleWorst').addEventListener('click', () => {
      state.showWorst = !state.showWorst;
      persist();
      renderRoleMatrix();
    });

    $('#heroPool').addEventListener('click', (event) => {
      const card = event.target.closest('.hero-card');
      if (card) openHeroMenu(Number(card.dataset.heroId), card);
    });

    $('#heroPool').addEventListener('dragstart', (event) => {
      const card = event.target.closest('.hero-card');
      if (!card) return;
      const heroId = Number(card.dataset.heroId);
      const source = findHeroSlot(heroId);
      state.drag = source
        ? { heroId, side: source.side, index: source.index }
        : { heroId, side: null, index: null };
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(heroId));
      card.classList.add('dragging');
    });

    for (const side of ['ally', 'enemy']) {
      const container = side === 'ally' ? $('#allySlots') : $('#enemySlots');
      container.addEventListener('click', (event) => {
        const slot = event.target.closest('.slot');
        if (!slot) return;
        const index = Number(slot.dataset.index);
        if (event.target.closest('[data-action="remove"]')) {
          removeHero(side, index);
          return;
        }
        if (slot.classList.contains('filled')) {
          openHeroMenu(Number(slot.dataset.heroId), slot);
        } else {
          focusSearch();
        }
      });
      container.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        if (event.target.closest('button')) return;
        const slot = event.target.closest('.slot');
        if (!slot) return;
        event.preventDefault();
        if (slot.classList.contains('filled')) openHeroMenu(Number(slot.dataset.heroId), slot);
        else focusSearch();
      });
      container.addEventListener('dragstart', (event) => {
        const slot = event.target.closest('.slot.filled');
        if (!slot) return;
        const heroId = Number(slot.dataset.heroId);
        state.drag = { heroId, side, index: Number(slot.dataset.index) };
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(heroId));
        slot.classList.add('drag-source');
      });
    }

    $('#recBody').addEventListener('click', (event) => {
      if (event.target.closest('a')) return;
      if (event.target.closest('[data-retry-rec]')) {
        requestRecommendations({ immediate: true });
        return;
      }
      const add = event.target.closest('[data-add-hero]');
      if (add) {
        addHero(Number(add.dataset.addHero), 'ally');
        return;
      }
      const row = event.target.closest('[data-rec-hero]');
      if (row) addHero(Number(row.dataset.recHero), 'ally');
    });

    $('#recBody').addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const row = event.target.closest('.rec-row');
      if (!row) return;
      event.preventDefault();
      addHero(Number(row.dataset.recHero), 'ally');
    });

    $('#roleMatrix').addEventListener('click', (event) => {
      const add = event.target.closest('[data-add-hero]');
      if (add) addHero(Number(add.dataset.addHero), 'ally');
    });

    document.addEventListener('dragover', (event) => {
      if (!state.drag) return;
      const zone = event.target.closest('.slot, .team-panel, .pool-panel');
      if (!zone) return;
      if (zone.classList.contains('slot') && zone.classList.contains('empty') === false) {
        // filled slots accept swaps too
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      highlightDropZone(zone);
    });

    document.addEventListener('dragleave', (event) => {
      const zone = event.target.closest('.slot, .team-panel, .pool-panel');
      if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove('dragover');
    });

    document.addEventListener('drop', (event) => {
      if (!state.drag) return;
      const zone = event.target.closest('.slot, .team-panel, .pool-panel');
      if (!zone) return;
      event.preventDefault();
      const drag = state.drag;
      clearDragState();
      if (zone.classList.contains('pool-panel')) {
        if (drag.side) removeHero(drag.side, drag.index);
        return;
      }
      const slot = zone.closest('.slot');
      if (slot) {
        handleDrop(drag, slot.dataset.side, Number(slot.dataset.index));
        return;
      }
      const team = zone.closest('.team-panel');
      if (team) handleDrop(drag, team.dataset.side, null);
    });

    document.addEventListener('dragend', clearDragState);

    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        focusSearch();
      }
    });

    window.addEventListener('resize', closeHeroMenu);

    $('#reloadBtn').addEventListener('click', () => location.reload());
    $('#fatalClose').addEventListener('click', () => window.close());
    $('#terminatedClose').addEventListener('click', () => window.close());
  }

  function focusSearch() {
    const input = $('#searchInput');
    if (!input) return;
    input.focus();
    input.select();
    const row = input.closest('.search-row');
    if (row) {
      row.style.borderColor = 'rgba(201,164,92,.7)';
      setTimeout(() => { row.style.borderColor = ''; }, 900);
    }
  }

  function highlightDropZone(zone) {
    $$('.dragover').forEach((el) => { if (el !== zone) el.classList.remove('dragover'); });
    zone.classList.add('dragover');
  }

  function clearDragState() {
    state.drag = null;
    $$('.dragover, .drag-source, .dragging').forEach((el) => {
      el.classList.remove('dragover', 'drag-source', 'dragging');
    });
  }

  // ------------------------------------------------------------- init

  async function init() {
    loadSaved();
    applyLanguage();
    bindEvents();
    try {
      const data = await api('/api/state');
      state.data = data;
      state.heroById = new Map((data.heroes || []).map((hero) => [hero.id, hero]));
      state.refresh = data.refresh || null;
      sanitizeDraft();
      persist();
      renderAll({ refetch: true });
      showApp();
      if (data.refresh?.running) startRefreshPolling();
    } catch (error) {
      showFatal(error);
    }
  }

  init();
})();
