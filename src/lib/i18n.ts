export type Locale = "ru" | "en";

const dictionaries = {
  ru: {
    // Navigation
    nav_dashboard: "Панель",
    nav_contacts: "Контакты",
    nav_telegram: "Telegram",
    nav_logout: "Выйти",

    // Dashboard
    dashboard_title: "Панель управления",
    dashboard_total_contacts: "Всего контактов",
    dashboard_upcoming: "Ближайшие дни рождения",
    dashboard_next_birthday: "Следующий день рождения",
    dashboard_chart_title: "Распределение дней рождения по месяцам",
    dashboard_chart_total: "Всего контактов",

    // Contacts
    contacts_title: "Контакты",
    contacts_add: "Добавить контакт",
    contacts_import: "Импорт",
    contacts_export_csv: "CSV",
    contacts_export_excel: "Excel",
    contacts_filter: "Фильтр по имени...",
    contacts_columns: "Столбцы",
    contacts_empty: "Нет результатов.",
    contacts_selected: "выбрано",

    // Contact form
    contact_name: "Имя",
    contact_birth_date: "Дата рождения",
    contact_notes: "Заметки",
    contact_save: "Сохранить",
    contact_cancel: "Отмена",
    contact_delete: "Удалить",
    contact_edit: "Редактировать",

    // Table headers
    col_name: "Имя",
    col_birth_date: "День рождения",
    col_age: "Возраст",
    col_days_until: "Дней до ДР",
    col_notes: "Заметки",
    col_actions: "Действия",

    // Telegram
    telegram_title: "Настройки Telegram",
    telegram_chat_id: "ID чата",
    telegram_chat_id_desc:
      "ID чата или группы, куда будут отправляться уведомления.",
    telegram_time: "Время уведомления",
    telegram_time_desc: "Время дня для отправки уведомлений (24-часовой формат).",
    telegram_timezone: "Часовой пояс",
    telegram_days_before: "Дней до ДР",
    telegram_days_before_desc:
      "За сколько дней до дня рождения отправлять напоминание (0 = в день ДР).",
    telegram_template: "Шаблон сообщения",
    telegram_template_desc:
      "Доступные переменные: {{name}}, {{days}}, {{notes}}.",
    telegram_save: "Сохранить настройки",
    telegram_test: "Проверить соединение",
    telegram_quick_setup: "Быстрое подключение (без токена)",
    telegram_quick_desc:
      "Используется общий бот приложения — вводить токен не нужно.",
    telegram_connect: "Подключить бота",
    telegram_connecting: "Подключение...",
    telegram_check: "Проверить подключение",
    telegram_checking: "Проверка...",
    telegram_new_link: "Новая ссылка",
    telegram_random: "Случайные поздравления",
    telegram_random_desc: "Использовать случайный текст из пула поздравлений",
    telegram_congratulations: "Управление поздравлениями",

    // Days
    days_today: "Сегодня!",
    days_tomorrow: "Завтра",
    days_plural: "дней",
    days_one: "день",
    days_few: "дня",
    years_old: "лет",

    // Auth
    auth_sign_in: "Войти",
    auth_sign_up: "Зарегистрироваться",
    auth_email: "Email",
    auth_password: "Пароль",
    auth_full_name: "Полное имя",
    auth_forgot: "Забыли пароль?",
    auth_no_account: "Нет аккаунта?",
    auth_has_account: "Уже есть аккаунт?",
    auth_reset_password: "Сбросить пароль",
    auth_new_password: "Новый пароль",
    auth_confirm_password: "Подтвердите пароль",
    auth_update_password: "Обновить пароль",

    // Notifications
    push_enable: "Включить push-уведомления",
    push_disable: "Отключить push-уведомления",
    push_enabled: "Push-уведомления включены",
    push_disabled: "Push-уведомления отключены",

    // Calendar
    calendar_export: "Экспорт в календарь",
    calendar_ics: "Скачать .ics файл",

    // General
    loading: "Загрузка...",
    error: "Ошибка",
    success: "Успех",
    save: "Сохранить",
    cancel: "Отмена",
    delete: "Удалить",
    edit: "Редактировать",
    add: "Добавить",
    back: "Назад",
    next: "Далее",
    prev: "Назад",
    search: "Поиск",
    no_data: "Нет данных",
  },
  en: {
    // Navigation
    nav_dashboard: "Dashboard",
    nav_contacts: "Contacts",
    nav_telegram: "Telegram",
    nav_logout: "Sign out",

    // Dashboard
    dashboard_title: "Dashboard",
    dashboard_total_contacts: "Total contacts",
    dashboard_upcoming: "Upcoming birthdays",
    dashboard_next_birthday: "Next birthday",
    dashboard_chart_title: "Birthday distribution by month",
    dashboard_chart_total: "Total contacts",

    // Contacts
    contacts_title: "Contacts",
    contacts_add: "Add contact",
    contacts_import: "Import",
    contacts_export_csv: "CSV",
    contacts_export_excel: "Excel",
    contacts_filter: "Filter by name...",
    contacts_columns: "Columns",
    contacts_empty: "No results.",
    contacts_selected: "selected",

    // Contact form
    contact_name: "Name",
    contact_birth_date: "Birthday",
    contact_notes: "Notes",
    contact_save: "Save",
    contact_cancel: "Cancel",
    contact_delete: "Delete",
    contact_edit: "Edit",

    // Table headers
    col_name: "Name",
    col_birth_date: "Birthday",
    col_age: "Age",
    col_days_until: "Days until",
    col_notes: "Notes",
    col_actions: "Actions",

    // Telegram
    telegram_title: "Telegram Settings",
    telegram_chat_id: "Chat ID",
    telegram_chat_id_desc: "Chat or group ID where notifications will be sent.",
    telegram_time: "Notification time",
    telegram_time_desc: "Time of day to send notifications (24-hour format).",
    telegram_timezone: "Timezone",
    telegram_days_before: "Days before",
    telegram_days_before_desc:
      "How many days before birthday to send reminder (0 = on the day).",
    telegram_template: "Message template",
    telegram_template_desc: "Available variables: {{name}}, {{days}}, {{notes}}.",
    telegram_save: "Save settings",
    telegram_test: "Test connection",
    telegram_quick_setup: "Quick setup (no token needed)",
    telegram_quick_desc:
      "Uses the app's shared bot — no token required.",
    telegram_connect: "Connect bot",
    telegram_connecting: "Connecting...",
    telegram_check: "Check connection",
    telegram_checking: "Checking...",
    telegram_new_link: "New link",
    telegram_random: "Random congratulations",
    telegram_random_desc: "Use random text from the congratulations pool",
    telegram_congratulations: "Manage congratulations",

    // Days
    days_today: "Today!",
    days_tomorrow: "Tomorrow",
    days_plural: "days",
    days_one: "day",
    days_few: "days",
    years_old: "years old",

    // Auth
    auth_sign_in: "Sign in",
    auth_sign_up: "Sign up",
    auth_email: "Email",
    auth_password: "Password",
    auth_full_name: "Full name",
    auth_forgot: "Forgot password?",
    auth_no_account: "Don't have an account?",
    auth_has_account: "Already have an account?",
    auth_reset_password: "Reset password",
    auth_new_password: "New password",
    auth_confirm_password: "Confirm password",
    auth_update_password: "Update password",

    // Notifications
    push_enable: "Enable push notifications",
    push_disable: "Disable push notifications",
    push_enabled: "Push notifications enabled",
    push_disabled: "Push notifications disabled",

    // Calendar
    calendar_export: "Export to calendar",
    calendar_ics: "Download .ics file",

    // General
    loading: "Loading...",
    error: "Error",
    success: "Success",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    back: "Back",
    next: "Next",
    prev: "Previous",
    search: "Search",
    no_data: "No data",
  },
} as const;

export type Dictionary = Record<string, string>;

export function getDictionary(locale: Locale): Dictionary {
  return (dictionaries[locale] ?? dictionaries.ru) as Dictionary;
}
