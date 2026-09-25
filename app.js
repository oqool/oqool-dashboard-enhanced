// js/app.js
import { InboxModule } from './modules/inbox.js?v=1.0.1';
import { ContactsModule } from './modules/contacts.js';
import { BillingModule } from './modules/billing.js?v=20260909-phase5a';
import { ChannelsModule } from './modules/channels.js';
import { IntegrationCenterModule } from './modules/integrationCenter.js';

import { AutomationsModule } from './modules/automations.js';
import { AnalyticsModule } from './modules/analytics.js';
import { SettingsModule } from './modules/settings.js';
import { getState, setState, clearState } from './state.js';

import { CompaniesModule } from './modules/companies.js';
import { ApiService } from './api.js';
import { ServicesModule } from './modules/services.js';
import { TeamModule } from './modules/team.js';
import { AppointmentsModule } from './modules/appointments.js';
import { ProvidersModule } from './modules/providers.js';
import { loadSupportTickets } from "./modules/support.js";
import { AdminSupportModule } from './modules/admin-support.js';
import { NotificationsModule } from './modules/notifications.js';
import { ProfileModule } from './modules/profile.js';
import { showToast } from "./utils/toast.js";
import { LivechatModule } from './modules/livechat.js';
import { CustomerInvoicesModule } from "./modules/customer-invoices.js";
import { KnowledgeModule } from "./modules/knowledge.js";
import { initAbandonedCarts } from './modules/automationsAbandonedCart.js';
import { initAutomationBuilder } from './modules/automationBuilder.js';
import { ProductsModule } from './modules/products.js';
import { OrdersModule } from './modules/orders.js?v=20260811-1';
import { SalesModule } from './modules/sales.js?v=20260815-1';
import { InventoryModule } from './modules/inventory.js';

const SUBSCRIPTION_FREE_SECTIONS = new Set([
    'dashboard',
    'companies',
    'billing',
    'wallet',
    'payment-methods',
    'platform-invoices',
    'refunds',
    'support',
    'notifications',
    'profile',
    'admin_support',
    'settings'
]);

function canOpenSectionBySubscription(section, liveSubscription) {
    // الأقسام العامة لا تعتمد على حالة الاشتراك
    if (SUBSCRIPTION_FREE_SECTIONS.has(section)) {
        return {
            allowed: true,
            reason: null
        };
    }

    // حماية Fail Closed:
    // لا نفتح الأقسام التشغيلية إذا تعذر التحقق من الاشتراك
    if (!liveSubscription) {
        return {
            allowed: false,
            reason: 'verification_failed'
        };
    }

    if (liveSubscription.access === true) {
        return {
            allowed: true,
            reason: null
        };
    }

    return {
        allowed: false,
        reason: liveSubscription.status || 'expired'
    };
}

function getSubscriptionLockMessage(reason, companyName = 'الشركة') {
    const messages = {
        verification_failed: {
            pageTitle: 'تعذر التحقق من الاشتراك',
            heading: 'تعذر التحقق من حالة الاشتراك',
            message:
                'لم نتمكن من التحقق من حالة اشتراك الشركة حاليًا. تحقق من اتصال الإنترنت ثم حاول مرة أخرى.',
            showBillingButton: false
        },

        trial_expired: {
            pageTitle: 'انتهت الفترة التجريبية',
            heading: `انتهت الفترة التجريبية لـ ${companyName}`,
            message:
                'للاستمرار في استخدام الخدمات والمواعيد والمحادثات والذكاء الاصطناعي، يرجى تفعيل الاشتراك.',
            showBillingButton: true
        },

        pending_payment: {
            pageTitle: 'فاتورة بانتظار السداد',
            heading: `يوجد اشتراك بانتظار السداد لـ ${companyName}`,
            message:
                'أكمل سداد الفاتورة من قسم الاشتراك والفواتير لاستعادة جميع وظائف النظام.',
            showBillingButton: true
        },

        cancelled: {
            pageTitle: 'الاشتراك ملغي',
            heading: `تم إلغاء اشتراك ${companyName}`,
            message:
                'يمكنك اختيار باقة جديدة وإعادة تفعيل الاشتراك من قسم الاشتراك والفواتير.',
            showBillingButton: true
        },

        suspended: {
            pageTitle: 'الحساب موقوف',
            heading: `حساب ${companyName} موقوف مؤقتًا`,
            message:
                'يرجى مراجعة قسم الاشتراك أو التواصل مع الدعم لمعرفة سبب إيقاف الحساب.',
            showBillingButton: true
        },

        expired: {
            pageTitle: 'انتهى الاشتراك',
            heading: `انتهى اشتراك ${companyName}`,
            message:
                'جدد الاشتراك من قسم الاشتراك والفواتير لاستعادة جميع وظائف النظام.',
            showBillingButton: true
        }
    };

    return messages[reason] || messages.expired;
}

const App = {
    async init() {
        console.log("OQOOL OS Initializing...");

        const token = localStorage.getItem('oqool_token');
        const userStored = localStorage.getItem('oqool_user');

        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        this.viewport = document.querySelector('#app-viewport') || document.getElementById('viewport') || document.querySelector('.main-content');
        this.pageTitle = document.querySelector('#page-title');

        if (!this.viewport || !this.pageTitle) {
            console.error("Dashboard elements missing.");
            return;
        }

        this.setupNavigation();
        this.setupLogout();
        this.loadStoreSwitcher();
        this.setupNotificationsBell();

        if (userStored) {
            this.updateUserUI(JSON.parse(userStored));
        }

        if (userStored) {
            this.applyRoleVisibility(JSON.parse(userStored));
        }

        this.loadDefaultPage();
        this.loadNotificationsBadge();

if (window.oqoolNotificationsBadgeLoop) {
    clearInterval(
        window.oqoolNotificationsBadgeLoop
    );
}

window.oqoolNotificationsBadgeLoop =
    setInterval(() => {
        this.loadNotificationsBadge();
    }, 10000);

// تشغيل الشات العائم بعد التحقق من صلاحية الاشتراك
        const selectedCompany = JSON.parse(localStorage.getItem('oqool_selected_company') || '{}');
    },

    // مراقبة التفعيل الحي من مصدر قرار الاشتراك المركزي
    async refreshCompanyLiveStatus() {
        try {
            const token =
                localStorage.getItem(
                    'oqool_token'
                );

            const selectedCompany =
                JSON.parse(
                    localStorage.getItem(
                        'oqool_selected_company'
                    ) || '{}'
                );

            if (
                !token ||
                !selectedCompany.id
            ) {
                return;
            }

            const res = await fetch(
                `https://api.oqool.sa/api/subscription/resolve?company_id=${selectedCompany.id}`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`,

                        'x-company-id':
                            selectedCompany.id
                    }
                }
            );

            const data =
                await res.json();

            if (
                !res.ok ||
                !data?.success ||
                !data?.result
            ) {
                return;
            }

            const resolved =
                data.result;

            const previousStatus =
                selectedCompany
                    .subscription_status;

            selectedCompany
                .subscription_status =
                    resolved.status || null;

            localStorage.setItem(
                'oqool_selected_company',
                JSON.stringify(
                    selectedCompany
                )
            );

            if (
                resolved.access === true &&
                resolved.status === 'active' &&
                previousStatus !== 'active'
            ) {
                console.log(
                    "OQOOL OS: Live subscription activation detected."
                );

                if (
                    window
                        .oqoolActivationLiveLoop
                ) {
                    clearInterval(
                        window
                            .oqoolActivationLiveLoop
                    );

                    window
                        .oqoolActivationLiveLoop =
                            null;
                }

                const currentHash =
                    window.location.hash
                        .replace('#', '') ||
                    'dashboard';

                this.navigate(
                    currentHash
                );

                showToast(
                    "تم تفعيل اشتراك المنشأة بنجاح."
                );
            }

        } catch (error) {
            console.error(
                "Live subscription resolve error:",
                error
            );
        }
    },

    setupLogout() {
        const logoutBtn = document.getElementById('logout-trigger');

        if (logoutBtn) {
            logoutBtn.onclick = () => {
                if (confirm('هل أنت متأكد من تسجيل الخروج ؟')) {
                    localStorage.removeItem('oqool_token');
                    localStorage.removeItem('oqool_user');
                    localStorage.removeItem('oqool_selected_company');
                    localStorage.removeItem('selected_company_id');

                    if (typeof clearState === 'function') {
                        clearState();
                    }

                    window.location.replace('login.html');
                }
            };
        }
    },

updateUserUI(user) {
    const nameElement = document.querySelector('.user-name');

    if (nameElement && user) {
        nameElement.innerText =
            user.full_name ||
            user.name ||
            'مستخدم OQOOL';
    }
},

setupNavigation() {
    document.addEventListener('click', async (e) => {
        const target = e.target.closest('.nav-item');
        if (!target) return;

        const section = target.getAttribute('data-section');
        if (!section) return;

        const scrollTo = target.getAttribute('data-scroll-to');

if (section === 'billing' && scrollTo) {
    localStorage.setItem('oqool_billing_view', scrollTo);
}

        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        target.classList.add('active');

        window.location.hash = `#${section}`;

        await this.navigate(section);

if (section === 'billing' && scrollTo) {
    setTimeout(() => {
        const targetSection = document.getElementById(scrollTo);

        if (!targetSection) {
            console.error('القسم غير موجود:', scrollTo);
            return;
        }

        document.querySelectorAll(
            '#billing-subscription, #billing-payment-methods, #billing-wallet, #billing-history, #billing-refunds'
        ).forEach(el => {
            el.style.display = el.id === scrollTo ? 'block' : 'none';
        });

        targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 500);
}

    });

    window.addEventListener('hashchange', () => {
        const currentHash = window.location.hash.replace('#', '');
        if (currentHash) {
            this.navigate(currentHash);
        }
    });
},

    async navigate(section) {
        try {
            section = decodeURIComponent(
                String(section || '')
            );
        } catch (error) {
            console.error(
                'Navigation section decode error:',
                error
            );
        }
        let selectedCompany = null;
        try {
            const localData = localStorage.getItem('oqool_selected_company');
            if (localData && localData !== 'null' && localData !== 'undefined') {
                selectedCompany = JSON.parse(localData);
            }
        } catch (e) {
            console.error("Error reading company status:", e);
        }

let liveSubscription = null;

if (selectedCompany && selectedCompany.id) {
    try {
        const token = localStorage.getItem('oqool_token');

        const res = await fetch(`https://api.oqool.sa/api/subscription/resolve?company_id=${selectedCompany.id}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'x-company-id': selectedCompany.id
            }
        });

        const data = await res.json();

        if (res.ok && data.success && data.result) {
            liveSubscription = data.result;

            selectedCompany.subscription_status = liveSubscription.status;
            selectedCompany.account_status = liveSubscription.access ? 'active' : 'expired';
            selectedCompany.trial_status = liveSubscription.status === 'trial' ? 'active' : 'expired';

            localStorage.setItem('oqool_selected_company', JSON.stringify(selectedCompany));
        }
    } catch (error) {
        console.error("Live subscription resolve error:", error);
    }
}

if (
    selectedCompany?.id &&
    typeof this.updateAppointmentsBadge === 'function'
) {
    this.updateAppointmentsBadge(
        selectedCompany.id
    );
}

const subscriptionDecision = canOpenSectionBySubscription(
    section,
    liveSubscription
);

const shouldBlockSection =
    selectedCompany &&
    subscriptionDecision.allowed === false;

if (shouldBlockSection) {
    const lockMessage = getSubscriptionLockMessage(
        subscriptionDecision.reason,
        selectedCompany.name
    );

this.pageTitle.innerText = lockMessage.pageTitle;

            this.viewport.innerHTML = `
                <div class="oq-panel" style="text-align:center; padding:60px 20px; max-width:600px; margin:40px auto; direction:rtl;">
                    <div style="color:#ef4444; font-size:48px; margin-bottom:20px;"><i class="fas fa-exclamation-triangle"></i></div>

<h2 style="color:#0f172a; font-weight:800; margin-bottom:15px;">
    ${lockMessage.heading}
</h2>
<p style="color:#64748b; font-size:14px; line-height:1.6; margin-bottom:25px;">
    ${lockMessage.message}
</p>
                    <div style="display:flex; gap:12px; justify-content:center;">

${lockMessage.showBillingButton ? `
    <button
        class="btn btn-primary"
        style="padding:12px 22px; font-weight:bold; font-size:13px; border-radius:6px;"
        onclick="window.location.hash = '#billing';">
        <i class="fas fa-credit-card me-2"></i>
        الانتقال للفواتير والاشتراك
    </button>
` : `
    <button
        class="btn btn-primary"
        style="padding:12px 22px; font-weight:bold; font-size:13px; border-radius:6px;"
        onclick="window.App.navigate(window.location.hash.replace('#', '') || 'dashboard');">
        <i class="fas fa-redo me-2"></i>
        إعادة المحاولة
    </button>
`}

                        <button class="oq-btn-ghost" style="padding:12px 22px; font-size:13px;"
                            onclick="window.location.hash = '#companies'; window.App.navigate('companies');">
                            <i class="fas fa-building me-2"></i> تغيير الشركة لعرض المتاجر
                        </button>
                    </div>
                </div>
            `;

setTimeout(() => {
    if (window.loadDashboardStats) {
        window.loadDashboardStats();
    }
}, 150);

            const floatingChat = document.getElementById('oqool-chat-wrapper') || document.getElementById('oqool-floating-chat-container');
            if (floatingChat) floatingChat.style.display = 'none';

            document.querySelectorAll('#main-nav .nav-item').forEach(el => {
                const s = el.getAttribute('data-section');
                if (!['billing', 'wallet', 'payment-methods', 'platform-invoices', 'refunds', 'companies', 'dashboard'].includes(s)) {
                    el.style.opacity = '0.4';
                } else {
                    el.style.opacity = '1';
                }
            });

            // 🌟 [التعديل الثاني الرئيسي]: تفقد حالة السداد حياً من قاعدة البيانات كل 3 ثوانٍ لفتح القفل تلقائياً
            if (!window.oqoolActivationLiveLoop) {
                window.oqoolActivationLiveLoop = setInterval(() => {
                    this.refreshCompanyLiveStatus();
                }, 3000);
            }

            return; // 🛑 كسر ومقاطعة التنفيذ لحجب القسم
        }

        // ✨ إذا تخطى الحجب ووصل هنا (الشركة نشطة وسليمة)، نقوم بإيقاف التايمر تماماً لتوفير موارد السيرفر
        if (window.oqoolActivationLiveLoop) {
            clearInterval(window.oqoolActivationLiveLoop);
            window.oqoolActivationLiveLoop = null;
        }

        // إظهار الشات واللوحة إذا كانت الشركة نشطة وسليمة
        document.querySelectorAll('#main-nav .nav-item').forEach(el => el.style.opacity = '1');

if (selectedCompany && liveSubscription && liveSubscription.access === true) {
            // 🧹 تنظيف أي شات معلق لمنع تضارب مستمعات الأحداث (DOM Events) الميتة
            const oldChat = document.getElementById('oqool-chat-wrapper');
            if (oldChat) {
                oldChat.remove();
            }

            // حقن الشات العائم على بياض بمستمعاته الحية والجديدة
            if (typeof LivechatModule !== 'undefined' && LivechatModule.initFloatingChat) {
                LivechatModule.initFloatingChat();
            }
        } else {
            const oldChat = document.getElementById('oqool-chat-wrapper');
            if (oldChat) oldChat.remove();
        }

const titles = {
    dashboard: 'OQOOL OS',
    analytics: 'التقارير والتحليلات',

    companies: 'إدارة المتاجر والشركات',
    services: 'إدارة الخدمات',
    products: 'المنتجات',
    orders: 'الطلبات',
    sales: 'المبيعات',
   inventory: 'المخزون',
    appointments: 'إدارة المواعيد',
    providers: 'مقدمو الخدمة',
    team: 'فريق العمل',
      'customer service': 'خدمة العملاء',
      supervisor: 'المشرفين',

    inbox: 'صندوق الوارد',
    contacts: 'إدارة العملاء',
    'customer-invoices': 'فواتير العملاء',

    knowledge: 'قاعدة المعرفة',

    'ai-settings': 'الرد الذكي',
    automations: 'قوالب الأتمتة',
    'voice-ai': 'الوكيل الصوتي',

    'integration-center': 'مركز التكاملات',

  channels: 'قنوات الربط',

    billing: 'الاشتراك والترقية',
    wallet: 'المحفظة',
    'payment-methods': 'وسائل الدفع',
    'platform-invoices': 'فواتير OQOOL',
    refunds: 'الاستردادات',

    support: 'تذاكر الدعم',
    notifications: 'الإشعارات',

    profile: 'الحساب الشخصي',

    settings: 'إعدادات المنصة',
    admin_support: 'مركز دعم OQOOL'
};
        const user = JSON.parse(localStorage.getItem('oqool_user') || '{}');

        // Support ownership:
        // support = company workspace
        // admin_support = OQOOL platform support center
        if (
            section === 'support' &&
            user.role === 'super_admin'
        ) {
            section = 'admin_support';
            window.location.hash = '#admin_support';
        }

        if (
            section === 'admin_support' &&
            user.role !== 'super_admin'
        ) {
            this.showAccessDenied(
                user.name ||
                user.full_name ||
                'المستخدم'
            );
            return;
        }

        if (section === 'settings' && user.role !== 'super_admin') {
            this.showAccessDenied(user.name || 'المستخدم');
            return;
        }

const billingAllowedRoles = [
    'super_admin',
    'admin',
    'account_manager',
    'client_owner',
];

const analyticsAllowedRoles = [
    'super_admin',
    'admin',
    'account_manager',
    'client_owner'
];

if (
    [
        'billing',
        'wallet',
        'payment-methods',
        'platform-invoices',
        'refunds'
    ].includes(section) &&
    !billingAllowedRoles.includes(user.role)
) {
    this.showAccessDenied(user.name || 'المستخدم');
    return;
}

if (
    section === 'analytics' &&
    !analyticsAllowedRoles.includes(user.role)
) {
    this.showAccessDenied(user.name || 'المستخدم');
    return;
}

if (
    section === 'providers' &&
    ![
        'super_admin',
        'admin',
        'account_manager',
        'client_owner',
    ].includes(user.role)
) {
    this.showAccessDenied(user.name || 'المستخدم');
    return;
}

if (
    ['channels', 'integration-center'].includes(section) &&
    ![
        'super_admin',
        'admin',
        'account_manager',
        'client_owner',
    ].includes(user.role)
) {
    this.showAccessDenied(user.name || 'المستخدم');
    return;
}

if (
    ['ai-settings', 'automations', 'voice-ai'].includes(section) &&
    ![
        'super_admin',
        'admin',
        'account_manager',
        'client_owner',
    ].includes(user.role)
) {
    this.showAccessDenied(user.name || 'المستخدم');
    return;
}


        this.pageTitle.innerText = titles[section] || 'OQOOL OS';
        document.body.setAttribute('data-current-section', section);
        this.loadNotificationsBadge();
        this.updateTrialBannerStatus();

        if (typeof LivechatModule !== 'undefined' && typeof LivechatModule.destroy === 'function') {
            LivechatModule.destroy();
        }

        if (this.viewport) {
            this.viewport.innerHTML = '';
        }

        try {
            switch (section) {
                case 'companies':
                    await CompaniesModule.render();
                    break;

                case 'dashboard':
                    await this.renderDashboardHome();
                    break;

                case 'abandoned-carts':
                    initAbandonedCarts();
                    break;


                case 'contacts':
                    await ContactsModule.render();
                    break;

                case 'inbox':
                    await InboxModule.render();
                    break;

case 'billing':
case 'wallet':
case 'payment-methods':
case 'platform-invoices':
case 'refunds':
    await BillingModule.render(section);
    break;

case 'automations':
    await initAutomationBuilder();
    break;

case 'ai-settings':
    await AutomationsModule.render();
    break;

case 'voice-ai':
    this.viewport.innerHTML = `
        <div class="oq-panel p-5 text-center">
            <i class="fas fa-microphone-alt fa-3x mb-3 text-primary"></i>
            <h3>الوكيل الصوتي</h3>
            <p class="text-muted">
                قريباً سيتمكن الوكيل الصوتي من استقبال المكالمات والرد عليها بالذكاء الاصطناعي.
            </p>
        </div>
    `;
    break;

case 'channels':
    await ChannelsModule.render();
    break;

case 'integration-center':
    await IntegrationCenterModule.render();
    break;

case 'analytics':
    await AnalyticsModule.render();
    break;

case 'settings':
    await SettingsModule.render();
    break;

case 'services':
    await ServicesModule.render();
    break;

case 'appointments':
    await AppointmentsModule.render();
    break;

case 'providers':
    await ProvidersModule.render();
    break;

case 'team':
      await TeamModule.render('all');
      break;

  case 'customer service':
      await TeamModule.render('customer_service');
      break;

  case 'supervisor':
      await TeamModule.render('supervisors');
      break;

case "support":
    loadSupportTickets();
    break;

case 'admin_support':
    await AdminSupportModule.render();
    break;

case 'notifications':
    await NotificationsModule.render();
    break;

case 'profile':
    await ProfileModule.render();
    break;

case "customer-invoices":
    await CustomerInvoicesModule.render();
    break;

case "knowledge":
    await KnowledgeModule.render();
    break;

case 'products':
  await ProductsModule.render();
  break;

case 'orders':
  await OrdersModule.render();
  break;

case 'sales':
  await SalesModule.render();
  break;

case 'inventory':
  await InventoryModule.render();
  break;

            }

        } catch (error) {
            console.error(`Error loading section ${section}:`, error);
            this.viewport.innerHTML = `
                <div class="card" style="color:#ef4444;">
                    حدث خطأ أثناء تحميل القسم. تأكد من وجود ملف الموديول.
                </div>
            `;
        }
    },

    updateTrialBannerStatus() {
        if (typeof window.forceOqoolTrialBannerCheck === 'function') {
            window.forceOqoolTrialBannerCheck();
        }
    },

async renderDashboardHome() {
        if (!this.viewport) return;

        let selectedCompany = null;
        try {
            const localData = localStorage.getItem('oqool_selected_company');
            if (localData && localData !== 'null' && localData !== 'undefined') {
                selectedCompany = JSON.parse(localData);
            }
        } catch (e) {
            console.error("Error parsing company data:", e);
        }

        if (selectedCompany && !selectedCompany.id) {
            selectedCompany = null;
        }

        const title = document.getElementById('page-title');
        this.updateTrialBannerStatus();

        // 🌟 شاشة الترحيب الرسمية الأفقية (المزدوجة) عند عدم اختيار متجر
if (!selectedCompany) {
            if (title) title.innerText = 'مرحباً بك في OQOOL OS';

            localStorage.removeItem('selected_company_id');
            localStorage.removeItem('oqool_selected_company');

            document.querySelectorAll('#main-nav .nav-item').forEach(el => {
                const section = el.getAttribute('data-section');
                const idAttr = el.getAttribute('id');

                const isGeneral = [
                    'profile',
                    'account',
                    'companies',
                    'billing',
                    'wallet',
                    'payment-methods',
                    'platform-invoices',
                    'refunds',
                    'support',
                    'admin_support',
                    'dashboard'
                ].includes(section);

                const isLogout = (idAttr === 'logout-trigger' || section === 'logout');
                if (isGeneral || isLogout) {
                    el.style.display = 'flex';
                } else {
                    el.style.display = 'none';
                }
            });

            const currentUser = JSON.parse(
                localStorage.getItem('oqool_user') || '{}'
            );

            document
                .querySelectorAll('[data-section="support"]')
                .forEach(el => {
                    el.style.display =
                        currentUser.role === 'super_admin'
                            ? 'none'
                            : 'flex';
                });

            document
                .querySelectorAll('[data-section="admin_support"]')
                .forEach(el => {
                    el.style.display =
                        currentUser.role === 'super_admin'
                            ? 'flex'
                            : 'none';
                });

            document.querySelectorAll('#main-nav .nav-category').forEach(el => el.style.display = 'none');

            this.viewport.innerHTML = `
                <div class="dashboard-home-wrap">
                    <div class="dashboard-hero-card">
                        <div class="dashboard-hero-image">
                            <div class="dashboard-image-frame"></div>
                            <div class="dashboard-logo-box">
                                <img src="/images/logo.png?v=2" alt="OQOOL">
                            </div>
                        </div>
                        <div class="dashboard-hero-text">
                            <div class="dashboard-badge"><i class="fas fa-shield-alt"></i> OQOOL OS Dashboard</div>
                            <h2>ابدأ إدارة أعمالك<br>من لوحة واحدة ذكية</h2>
                            <p>اختر المتجر أو الشركة لعرض الخدمات، المواعيد، العملاء، الرسائل، وإعدادات الربط في مكان واحد.</p>
                            <button class="btn btn-primary dashboard-main-btn" onclick="document.querySelector('[data-section=\\'companies\\']').click()">انتقل للمتاجر والشركات <i class="fas fa-arrow-left ms-2"></i></button>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        if (title) title.innerText = `لوحة تحكم ${selectedCompany.name}`;

        document.querySelectorAll('#main-nav .nav-item').forEach(el => el.style.display = 'flex');
        document.querySelectorAll('#main-nav .nav-category').forEach(el => el.style.display = 'block');

        if (typeof this.applyRoleVisibility === 'function') {
            const userStored = localStorage.getItem('oqool_user');
            if (userStored) this.applyRoleVisibility(JSON.parse(userStored));
        }

        // الواجهة الرئيسية الرسمية عند وجود متجر
        this.viewport.innerHTML = `
            <div class="dashboard-wrapper p-3">
                
                <div class="card border-0 text-white p-4 mb-4 shadow-sm" style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); border-radius: 12px;">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h4 class="fw-bold mb-1">لوحة أداء ${selectedCompany.name || 'المتجر'}</h4>
                            <p class="mb-0 text-white-50 small">مراقبة فورية لأداء القنوات، الردود الذكية، والمؤشرات الحية للمتجر الحالي.</p>
                        </div>
                        <button class="btn btn-light btn-sm fw-bold px-3 text-primary" id="oqool-change-company-trigger" style="border-radius: 6px;">
                            <i class="fas fa-building me-1"></i> تغيير الشركة
                        </button>
                    </div>
                </div>

                <div class="row g-3 mb-4">
                    <div class="col-md-3">
                        <div class="card border-0 shadow-sm p-3" style="border-radius: 12px; background: #fff;">
                            <span class="text-muted small fw-bold d-block mb-1">إجمالي الرسائل</span>
                            <h3 class="fw-bold text-dark mb-0" id="total-messages">0</h3>
                            <span class="text-muted" style="font-size:11px;">صادرة ووارة</span>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-0 shadow-sm p-3" style="border-radius: 12px; background: #fff;">
                            <span class="text-muted small fw-bold d-block mb-1">إجمالي العملاء</span>
                            <h3 class="fw-bold text-dark mb-0" id="total-clients">0</h3>
                            <span class="text-muted" style="font-size:11px;">عميل مسجل</span>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-0 shadow-sm p-3" style="border-radius: 12px; background: #fff;">
                            <span class="text-muted small fw-bold d-block mb-1">مواعيد بانتظار التأكيد</span>
                            <h3 class="fw-bold text-dark mb-0" id="pending-appointments">0</h3>
                            <span class="text-muted" style="font-size:11px;">تحتاج مراجعة</span>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card border-0 shadow-sm p-3" style="border-radius: 12px; background: #fff;">
                            <span class="text-muted small fw-bold d-block mb-1">رسائل غير مقروءة</span>
                            <h3 class="fw-bold text-dark mb-0" id="inbox-badge">0</h3>
                            <span class="text-muted" style="font-size:11px;">في صندوق الوارد</span>
                        </div>
                    </div>
                </div>

                <div class="row g-3 mb-4">
                    <div class="col-md-6">
                        <div class="card border-0 shadow-sm p-3" style="border-radius: 12px; background: #fff;">
                            <div class="d-flex align-items-center gap-3">
                                <div class="p-3 bg-light text-primary rounded-3">
                                    <i class="fas fa-microphone-alt fs-3"></i>
                                </div>
                                <div class="flex-grow-1">
                                    <span class="text-muted small fw-bold d-block">الدقائق الصوتية الترحيبية</span>
                                    <h4 class="fw-bold text-dark mb-0" id="text-gift-minutes">-- دقيقة</h4>
                                    <span class="text-muted" style="font-size:11px;">الرصيد المخصص للاستجابة الصوتية</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card border-0 shadow-sm p-3" style="border-radius: 12px; background: #fff;">
                            <div class="d-flex align-items-center justify-content-between">
                                <div class="d-flex align-items-center gap-3">
                                    <div class="p-3 bg-light text-success rounded-3">
                                        <i class="fas fa-wallet fs-3"></i>
                                    </div>
                                    <div>
                                        <span class="text-muted small fw-bold d-block">رصيد محفظة المكالمات</span>
                                        <h4 class="fw-bold text-dark mb-0" id="text-wallet-balance">--.00 ر.س</h4>
                                        <span class="text-muted" style="font-size:11px;" id="text-minute-rate">تكلفة الدقيقة الفورية: 20 هللة</span>
                                    </div>
                                </div>
                                <button class="btn btn-outline-primary btn-sm fw-bold px-3" onclick="window.location.hash = '#wallet';">
                                    شحن المحفظة
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="row g-3">
                    <div class="col-md-6">
                        <div class="card border-0 shadow-sm p-3 h-100 d-flex flex-column justify-content-between" style="border-radius: 12px; background: #fff;">
                            <div>
                                <h6 class="fw-bold mb-2"><i class="fas fa-link text-primary me-2"></i> قنوات الاتصال النشطة</h6>
                                <p class="text-muted small mb-3">حالة ربط المنصات ومواقع التواصل الحالية للمتجر.</p>
                                <div class="d-flex gap-2 flex-wrap mb-3">
                                    <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">WhatsApp: متصل</span>
                                    <span class="badge bg-warning-subtle text-warning border border-warning-subtle px-2 py-1">Voice Bot: جاهز للربط</span>
                                </div>
                            </div>
                            <div>
                                <button class="btn btn-light btn-sm fw-bold w-100" onclick="document.querySelector('[data-section=\\'channels\\']').click()">إدارة القنوات والربط</button>
                            </div>
                        </div>
                    </div>

                    <div class="col-md-6">
                        <div class="card border-0 shadow-sm p-3 h-100 d-flex flex-column justify-content-between text-white" style="border-radius: 12px; background: #0f172a;">
                            <div>
                                <h6 class="fw-bold mb-2 text-white"><i class="fas fa-brain me-2 text-primary"></i> الأنظمة الذكية (AI)</h6>
                                <p class="text-white-50 small mb-3">الوكيل الصوتي الذكي والمساعد النصي نشطين وجاهزين لتلقي وضبط التعليمات الاستراتيجية.</p>
                            </div>
                            <div>
                                <button class="btn btn-outline-light btn-sm fw-bold w-100" onclick="document.querySelector('[data-section=\\'ai-settings\\']').click()">إعدادات الذكاء الاصطناعي</button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        `;

        if (typeof this.loadCompanyStats === 'function') {
            this.loadCompanyStats(selectedCompany.id);
        }

        if (typeof window.updateOqoolWalletUI === 'function') {
            window.updateOqoolWalletUI();
        }

       if (typeof this.updateAppointmentsBadge === 'function') {
           this.updateAppointmentsBadge(selectedCompany.id);
        }

    },

async loadCompanyStats(companyId) {
    try {
        const stats = await ApiService.request('/dashboard', {
            method: 'GET',
            headers: { 'x-company-id': companyId }
        });

        const msgEl =
            document.getElementById('total-messages');

        const cliEl =
            document.getElementById('total-clients');

        const pendingEl =
            document.getElementById('pending-appointments');

        const appointmentsBadge =
            document.getElementById('appointments-badge');

        if (msgEl) {
            msgEl.innerText =
                stats.total_messages || 0;
        }

        if (cliEl) {
            cliEl.innerText =
                stats.total_clients || 0;
        }

        if (pendingEl) {
            pendingEl.innerText =
                stats.pending_appointments || 0;
        }

        if (appointmentsBadge) {
            appointmentsBadge.innerText =
                stats.pending_appointments || 0;
        }

    } catch (error) {
        console.error(
            "فشل جلب الإحصائيات:",
            error
        );

        const msgEl =
            document.getElementById('total-messages');

        const cliEl =
            document.getElementById('total-clients');

        const pendingEl =
            document.getElementById('pending-appointments');

        const appointmentsBadge =
            document.getElementById('appointments-badge');

        if (msgEl) msgEl.innerText = "0";
        if (cliEl) cliEl.innerText = "0";
        if (pendingEl) pendingEl.innerText = "0";
        if (appointmentsBadge) {
            appointmentsBadge.innerText = "0";
        }
    }
},

async updateAppointmentsBadge(companyId) {
    try {
        if (!companyId) return;

        const stats = await ApiService.request('/dashboard', {
            method: 'GET',
            headers: {
                'x-company-id': companyId
            }
        });

        const appointmentsBadge =
            document.getElementById('appointments-badge');

        if (appointmentsBadge) {
            appointmentsBadge.innerText =
                stats.pending_appointments || 0;
        }

    } catch (error) {
        console.error(
            "فشل تحديث عداد المواعيد:",
            error
        );
    }
},

    showAccessDenied(name) {
        this.viewport.innerHTML = `
            <div style="text-align:center; padding:100px;">
                <h2>دخول مرفوض</h2>
                <p>عذراً يا ${name}.. لا تملك الصلاحية للوصول لهذا القسم.</p>
            </div>
        `;
    },

applyRoleVisibility(user) {
    if (!user) return;

    const isSuperAdmin =
        user.role === 'super_admin';
    const isProvider = 
        user.role === 'provider';

    const canAccessBilling = [
        'super_admin',
        'admin',
        'account_manager',
        'client_owner',
    ].includes(user.role);

    const canAccessAnalytics = [
        'super_admin',
        'admin',
        'account_manager',
        'client_owner'
    ].includes(user.role);

const canManageTeam = [
    'super_admin',
    'admin',
    'account_manager',
    'client_owner',
].includes(user.role);

const canManageIntegrations = [
    'super_admin',
    'admin',
    'account_manager',
    'client_owner',
].includes(user.role);

const canManageAI = [
    'super_admin',
    'admin',
    'account_manager',
    'client_owner',
].includes(user.role);

    document
        .querySelectorAll('.super-admin-only')
        .forEach(el => {
            el.style.display =
                isSuperAdmin ? '' : 'none';
        });

    document
        .querySelectorAll(
            '[data-section="settings"]'
        )
        .forEach(el => {
            el.style.display =
                isSuperAdmin ? '' : 'none';
        });

    document
        .querySelectorAll(
            '[data-section="admin_support"]'
        )
        .forEach(el => {
            el.style.display =
                isSuperAdmin ? '' : 'none';
        });

    document
        .querySelectorAll(
            '[data-section="support"]'
        )
        .forEach(el => {
            el.style.display =
                isSuperAdmin ? 'none' : '';
        });

    document
        .querySelectorAll(
            '[data-section="billing"], [data-section="wallet"], [data-section="payment-methods"], [data-section="platform-invoices"], [data-section="refunds"]'
        )
        .forEach(el => {
            el.style.display =
                canAccessBilling ? '' : 'none';
        });

    document
        .querySelectorAll(
            '[data-category="billing-cat"], [data-category-content="billing-cat"]'
        )
        .forEach(el => {
            el.style.display =
                canAccessBilling ? '' : 'none';
        });

document
    .querySelectorAll('[data-section="analytics"]')
    .forEach(el => {
        el.style.display =
            canAccessAnalytics ? '' : 'none';
    });

document
    .querySelectorAll('[data-section="providers"]')
    .forEach(el => {
        el.style.display =
            canManageTeam ? '' : 'none';
    });

document
    .querySelectorAll(
        '[data-section="channels"], [data-section="integration-center"]'
    )
    .forEach(el => {
        el.style.display =
            canManageIntegrations ? '' : 'none';
    });

document
    .querySelectorAll(
        '[data-category="integrations"], [data-category-content="integrations"]'
    )
    .forEach(el => {
        el.style.display =
            canManageIntegrations ? '' : 'none';
    });

document
    .querySelectorAll(
        '[data-section="ai-settings"], [data-section="automations"], [data-section="voice-ai"]'
    )
    .forEach(el => {
        el.style.display =
            canManageAI ? '' : 'none';
    });

document
    .querySelectorAll(
        '[data-category="ai"], [data-category-content="ai"]'
    )
    .forEach(el => {
        el.style.display =
            canManageAI ? '' : 'none';
    });

document
    .querySelectorAll('[data-section="customer-invoices"]')
    .forEach(el => {
        el.style.display = isProvider ? 'none' : '';
    });

},

setupNotificationsBell() {
    const bell =
        document.getElementById(
            'oq-notifications-bell'
        );

    if (!bell) return;

    bell.onclick = async () => {
        window.location.hash =
            '#notifications';

        await this.navigate(
            'notifications'
        );
    };
},

    async loadNotificationsBadge() {
        try {
            const token = localStorage.getItem('oqool_token');
            const selectedCompany = getState('selectedCompany') || JSON.parse(localStorage.getItem('oqool_selected_company') || 'null');
            const companyId = selectedCompany?.id || localStorage.getItem('selected_company_id');
            const sidebarBadge =
    document.getElementById(
        'notifications-badge'
    );

const topBadge =
    document.getElementById(
        'oq-bell-count'
    );

if (
    !token ||
    !companyId
) {
    return;
}


            const res = await fetch('https://api.oqool.sa/api/notifications', {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'x-company-id': companyId
                }
            });

const data = await res.json();

if (!res.ok) return;

const unreadCount =
    Number(data.unreadCount || 0);

[
    sidebarBadge,
    topBadge
].forEach(badge => {
    if (!badge) return;

    if (unreadCount > 0) {
        badge.innerText =
            unreadCount;

        badge.style.display =
            'inline-flex';
    } else {
        badge.innerText = '0';
        badge.style.display =
            'none';
    }
});

        } catch (error) {
            console.error('Notifications badge error:', error);
        }
    },

    async loadStoreSwitcher() {
        try {
            const companies = await ApiService.request('/companies', {
                method: 'GET'
            });

            const menu = document.getElementById('storesDropdownMenu');
            const name = document.getElementById('currentStoreName');

            if (!menu || !name) return;

            if (!companies || !companies.length) {
                name.innerText = 'لا توجد متاجر';
                menu.innerHTML = `
                    <li>
                        <span class="dropdown-item-text text-muted">
                            لا توجد متاجر
                        </span>
                    </li>
                `;
                return;
            }

            const selected = JSON.parse(
                localStorage.getItem('oqool_selected_company') || 'null'
            );

            name.innerText = selected?.name || 'اختر متجر';

            menu.innerHTML = companies.map(company => `
                <li>
                    <button
                        class="dropdown-item text-end"
                        type="button"
                        data-store-id="${company.id}">
                        ${company.name}
                    </button>
                </li>
            `).join('');

            menu.querySelectorAll('[data-store-id]').forEach(btn => {
            btn.addEventListener('click', async () => {

                    const companyId = Number(btn.getAttribute('data-store-id'));
                    const company = companies.find(c => Number(c.id) === companyId);

                    if (!company) return;

                    localStorage.setItem('oqool_selected_company', JSON.stringify(company));
                    localStorage.setItem('selected_company_id', company.id);

                    if (typeof setState === 'function') {
                        setState('selectedCompany', company);
                    }

                    name.innerText = company.name;

                    // 🌟 التحكم الفوري والمطوّر للشات العائم والواجهة بمجرد تبديل المتجر علوياً
let resolvedAccess = false;

try {
    const subscriptionResult = await ApiService.request(
        `/subscription/resolve?company_id=${company.id}`,
        {
            method: 'GET',
            headers: {
                'x-company-id': company.id
            }
        }
    );

    if (subscriptionResult?.success && subscriptionResult?.result) {
        const resolved = subscriptionResult.result;

        company.subscription_status = resolved.status;
        company.account_status = resolved.access ? 'active' : 'expired';
        company.trial_status = resolved.status === 'trial' ? 'active' : 'expired';

        localStorage.setItem('oqool_selected_company', JSON.stringify(company));

        resolvedAccess = resolved.access === true;
    }
} catch (error) {
    console.error('STORE SWITCHER SUBSCRIPTION RESOLVE ERROR:', error);
}

const oldChat = document.getElementById('oqool-chat-wrapper');
if (oldChat) oldChat.remove();

if (resolvedAccess) {
    if (typeof LivechatModule !== 'undefined' && LivechatModule.initFloatingChat) {
        LivechatModule.initFloatingChat();
    }
}
                    window.location.hash = '#dashboard';
                    this.navigate('dashboard');
                });
            });

        } catch (error) {
            console.error('LOAD STORE SWITCHER ERROR:', error);
            const menu = document.getElementById('storesDropdownMenu');
            const name = document.getElementById('currentStoreName');

            if (name) name.innerText = 'فشل التحميل';
            if (menu) {
                menu.innerHTML = `
                    <li>
                        <span class="dropdown-item-text text-danger">
                            فشل تحميل المتاجر
                        </span>
                    </li>
                `;
            }
        }
    },

    loadDefaultPage() {
        const hash = window.location.hash.replace("#", "");
        const selectedCompany = localStorage.getItem('oqool_selected_company');
        const defaultSection = (selectedCompany && selectedCompany !== 'null') ? "dashboard" : "companies";

        const section = hash || defaultSection;

        window.location.hash = `#${section}`;

        const navItem = document.querySelector(`[data-section="${section}"]`);
        if (navItem) {
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            navItem.classList.add('active');
        }
        this.navigate(section);
    }
};

document.addEventListener('click', (e) => {
    const changeTrigger = e.target.closest('#oqool-change-company-trigger') ||
                         (e.target.closest('button') && e.target.innerText.includes('تغيير الشركة'));

    if (changeTrigger) {
        localStorage.removeItem('selected_company_id');
        localStorage.removeItem('oqool_selected_company');
        sessionStorage.removeItem('current_company_id');

        window.location.hash = '#dashboard';
        window.location.reload();
    }
});

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
