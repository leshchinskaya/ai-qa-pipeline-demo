/**
 * Firebase Configuration
 * 
 * ВАЖНО: Замените значения ниже на ваши собственные из Firebase Console
 * 
 * Как получить эти данные:
 * 1. Перейдите в https://console.firebase.google.com/
 * 2. Создайте новый проект или выберите существующий
 * 3. Перейдите в Project Settings (шестеренка)
 * 4. В разделе "Your apps" нажмите на иконку Web (</>)
 * 5. Зарегистрируйте приложение и скопируйте конфигурацию
 */

const firebaseConfig = {
    apiKey: "DEMO_NO_FIREBASE",
    authDomain: "demo-project.firebaseapp.com",
    projectId: "demo-project",
    storageBucket: "demo-project.firebasestorage.app",
    messagingSenderId: "000000000000",
    appId: "demo-app-id"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);

// Сервисы Firebase
const auth = firebase.auth();
const db = firebase.firestore();

// Устанавливаем сохранение сессии в localStorage (переживает перезагрузку)
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
        console.log('Auth persistence set to LOCAL');
    })
    .catch((error) => {
        console.error('Error setting persistence:', error);
    });

// Настройка Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();
// Убираем prompt: 'select_account' чтобы не спрашивать аккаунт каждый раз
googleProvider.setCustomParameters({
    // prompt: 'select_account' // Раскомментируйте, если хотите выбирать аккаунт каждый раз
});

// Коллекции Firestore
const COLLECTIONS = {
    USERS: 'users',
    DEVICES: 'devices',
    BOOKINGS: 'bookings',
    BOOKINGS_ARCHIVE: 'bookings_archive',
    PROJECTS: 'projects',
    PROJECT_ASSIGNMENTS: 'projectAssignments',
    CONFIG: 'config',
    MESSAGES: 'messages',
    TYPING: 'typing',
    MESSAGE_REACTIONS: 'messageReactions',
    USER_PRESENCE: 'userPresence'
};

/**
 * Структура документа config/app в Firestore:
 * {
 *   minVersion: "1.15.0",           // Минимальная требуемая версия приложения
 *   updateMessage: "Доступна новая версия с важными исправлениями",  // Сообщение для пользователя
 *   forceUpdate: true               // Включить/выключить принудительное обновление
 * }
 * 
 * Для создания документа выполните в Firebase Console:
 * 1. Перейдите в Firestore Database
 * 2. Создайте коллекцию "config"
 * 3. Добавьте документ с ID "app"
 * 4. Добавьте поля: minVersion (string), updateMessage (string), forceUpdate (boolean)
 */

// Статусы устройств
const DEVICE_STATUS = {
    AVAILABLE: 'available',
    BOOKED: 'booked',
    EXTERNAL: 'external'
};

// Типы действий бронирования
const BOOKING_ACTIONS = {
    TAKE: 'take',           // Использую (в офисе)
    RETURN: 'return',       // Вернул устройство
    BOOK: 'book',           // Забрал домой
    DATE_CHANGE: 'date_change',  // Изменил дату возврата
    TRANSFERRED: 'transferred',   // Передано (админ бронирует на другого)
    RECEIPT_CONFIRMED: 'receipt_confirmed'  // Подтверждено получение
};

// Типы бронирования (где находится устройство)
const BOOKING_TYPES = {
    OFFICE: 'office',  // Использую в офисе
    HOME: 'home'       // Взято домой
};

// Типы устройств
const DEVICE_TYPES = {
    phone: { label: 'Телефон', icon: 'phone' },
    tablet: { label: 'Планшет', icon: 'tablet' }
};

// Операционные системы
const OS_TYPES = {
    android: { label: 'Android', color: '#3DDC84' },
    ios: { label: 'iOS', color: '#007AFF' },
    ipados: { label: 'iPadOS', color: '#007AFF' }
};

console.log('Firebase configuration loaded');
