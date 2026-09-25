// js/modules/profile.js

import { getState } from "../state.js";
import { showToast } from "../utils/toast.js";

const API_BASE_URL = "https://api.oqool.sa";

export const ProfileModule = {
  async render() {
    const viewport = document.getElementById("app-viewport");
    if (!viewport) return;

    // 🎯 قراءة ذكية وآمنة لبيانات الشركة والجلسة
    let selectedCompany = null;
    try {
        const localData = localStorage.getItem("oqool_selected_company");
        if (localData && localData !== 'null' && localData !== 'undefined') {
            selectedCompany = JSON.parse(localData);
        }
    } catch (e) {
        console.error("Error parsing profile company data:", e);
    }

    const companyId = selectedCompany?.id || localStorage.getItem("selected_company_id");
    const token = localStorage.getItem("oqool_token");
    
    // محاولة قراءة مبدئية من الذاكرة المحلية
    let user = JSON.parse(localStorage.getItem("oqool_user") || "{}");

    if (!token) {
      viewport.innerHTML = `<div class="card" style="color:#ef4444;">انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.</div>`;
      return;
    }

    // 🚀 سحب الهوية الحية من الباك إند ديناميكياً عبر المسار المخصص الجديد /api/users/me
try {
  const userRes = await fetch(`${API_BASE_URL}/api/users/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const userData = await userRes.json();

  if (userRes.ok && userData.success) {
    user = userData.user;
    localStorage.setItem(
      "oqool_user",
      JSON.stringify(user)
    );
  }

} catch (err) {
  console.error(
    "Failed to fetch live user profile via /api/users/me, switching to cache:",
    err
  );
}

const isProvider =
  user.role === "provider";

const canManageCompanyProfile = [
  "super_admin",
  "admin",
  "client_owner"
].includes(user.role);

    // 🌟 [الوضع الأول]: في حال عدم اختيار شركة (الساحة العامة) - عرض بيانات المستخدم الفعلي الحالي
    if (!companyId) {
      this.renderUserProfileOnly(viewport, user, token);
      return;
    }

    // 🔄 [الوضع الثاني]: إذا كان هناك متجر نشط، يتم شحن واجهة الشركة والمستخدم معاً
    viewport.innerHTML = `
      <div class="loader-container" style="text-align:center;padding:50px;">
        <i class="fas fa-circle-notch fa-spin fa-2x"></i>
        <p>جاري تحميل بيانات الحساب...</p>
      </div>
    `;

    try {
      const res = await fetch(`${API_BASE_URL}/api/company/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل تحميل بيانات الحساب");

      const companyData = data.company || {};
      const company = {
        name: companyData.name || "-",
        email: companyData.email || "-",
        phone: companyData.phone || "-",
        industry: companyData.industry || "-",
        subscription_status: companyData.subscription_status || "-",
        billing_name: companyData.billing_name || "",
        tax_number: companyData.tax_number || "",
        commercial_register: companyData.commercial_register || "",
        billing_address: companyData.billing_address || "",
        billing_email: companyData.billing_email || "",
        logo: companyData.logo || "",
        owner_user_id: companyData.owner_user_id || null,
        owner_name: companyData.owner_name || "غير معين",
        owner_email: companyData.owner_email || "",
        owner_phone: companyData.owner_phone || "",
        owner_role: companyData.owner_role || "",
        account_manager_name: companyData.account_manager_name || "غير مسند",
        account_manager_email: companyData.account_manager_email || "",
        account_manager_phone: companyData.account_manager_phone || ""

      };

      // 🌟 [التصحيح السحري]: فحص ديناميكي لحالة المتجر الفعلي المختار لمنع خديعة النصوص الثابتة
      let activityTypeText = company.industry;
      let subscriptionStatusText = translateStatus(company.subscription_status);
      let badgeColor = "bg-success";
      let statusTextColor = "#10b981";

      // إذا كانت قيمة العمود في الداتابيز معلقة للدفع أو منتهية
      if (selectedCompany?.subscription_status === 'pending_payment' || company.subscription_status === 'pending' || company.subscription_status === 'expired') {
          activityTypeText = 'انتهت فترة التجربة ⚠️';
          subscriptionStatusText = 'بانتظار الدفع والشحن';
                 badgeColor = "bg-danger";
          statusTextColor = "#ef4444";
      }

      viewport.innerHTML = `
        <div class="profile-page">
          <div class="profile-hero">
            <div>
              <p>إدارة بيانات المستخدم الحالي ومتجرك النشط.</p>
            </div>
            <div class="profile-avatar" id="change-avatar-btn" style="cursor:pointer;">
              ${user.avatar ? `<img src="${API_BASE_URL}${user.avatar}" class="profile-avatar-img" style="width:60px;height:60px;border-radius:50%;object-fit:cover;">` : `<i class="fas fa-user-shield"></i>`}
            </div>
          </div>

          <div class="profile-grid">
            <div class="card profile-card">
              <div class="card-header-row">
                <div>
                  <h3>بيانات الشركة</h3>
                  <small>معلومات الحساب الحالية</small>
                </div>
${canManageCompanyProfile ? `
  <button class="secondary-btn" id="edit-company-btn">
    <i class="fas fa-pen"></i> تعديل
  </button>
` : `
  <span style="font-size:12px;color:#64748b;">
    عرض فقط
  </span>
`}

              </div>

              <div class="profile-info-list" id="company-info-display">
                <div class="profile-info-item"><span>اسم الشركة</span><strong>${company.name}</strong></div>
                <div class="profile-info-item"><span>البريد الإلكتروني</span><strong>${company.email}</strong></div>
                <div class="profile-info-item"><span>رقم الجوال</span><strong>${company.phone}</strong></div>
                
                <!-- 🔄 تحديث نوع النشاط ليصبح ديناميكياً عند انتهاء الفترة التجريبية -->
                <div class="profile-info-item">
                    <span>نوع النشاط</span>
                    <span class="badge ${badgeColor}" style="font-weight:bold; padding:6px 12px; border-radius:6px; font-size:11px; color:#fff;">
                        ${activityTypeText}
                    </span>
                </div>
                
                <!-- 🔄 تحديث حالة الاشتراك لتظهر بوضوح باللون الأحمر بانتظار الدفع -->
                <div class="profile-info-item">
                    <span>حالة الاشتراك</span>
                    <strong style="color: ${statusTextColor}; font-weight:800;">
                        ${subscriptionStatusText}
                    </strong>
                </div>

<div class="profile-info-item">
  <span>مالك المؤسسة</span>
  <strong style="color:#24397c;font-weight:800;">
    ${company.owner_name || 'غير معين'}
  </strong>
</div>

${company.owner_email ? `
  <div class="profile-info-item">
    <span>بريد مالك المؤسسة</span>
    <strong>${company.owner_email}</strong>
  </div>
` : ''}

${company.owner_phone ? `
  <div class="profile-info-item">
    <span>جوال مالك المؤسسة</span>
    <strong>${company.owner_phone}</strong>
  </div>
` : ''}

<div class="profile-info-item">
  <span>مدير الحساب</span>
  <strong style="color:#24397c;font-weight:800;">
    ${company.account_manager_name || 'غير مسند'}
  </strong>
</div>

${company.account_manager_email ? `
  <div class="profile-info-item">
    <span>بريد مدير الحساب</span>
    <strong>${company.account_manager_email}</strong>
  </div>
` : ''}

${company.account_manager_phone ? `
  <div class="profile-info-item">
    <span>جوال مدير الحساب</span>
    <strong>${company.account_manager_phone}</strong>
  </div>
` : ''}

     </div>

${canManageCompanyProfile ? `
  <div id="company-edit-form" style="display:none;margin-top:25px;">
    <div class="form-group">
      <label>اسم الشركة</label>
      <input class="form-control" type="text" id="edit-company-name" value="${company.name}">
    </div>

    <div class="form-group">
      <label>البريد الإلكتروني</label>
      <input class="form-control" type="email" id="edit-company-email" value="${company.email}">
    </div>

    <div class="form-group">
      <label>رقم الجوال</label>
      <input class="form-control" type="text" id="edit-company-phone" value="${company.phone}">
    </div>

    <div class="form-group">
      <label>نوع النشاط</label>
      <input class="form-control" type="text" id="edit-company-industry" value="${company.industry}">
    </div>

    <div style="display:flex;gap:10px;margin-top:20px;">
      <button class="primary-btn" id="save-company-btn">
        حفظ التعديلات
      </button>

      <button class="secondary-btn" id="cancel-company-btn">
        إلغاء
      </button>
    </div>
  </div>
` : ''}

            </div>

            <div class="card profile-card">
              <div class="card-header-row">
                <div>
                  <h3>بيانات المستخدم</h3>
                  <small>بيانات الهوية الفردية الحالية</small>
                </div>
                <button class="secondary-btn" id="edit-user-btn"><i class="fas fa-user-edit"></i> تعديل</button>
              </div>
              
              <div class="profile-info-list" id="user-info-display">
<div class="profile-info-item">
  <span>الاسم الكامل</span>
  <strong>${user.full_name || user.name || "-"}</strong>
</div>

                <div class="profile-info-item"><span>البريد الإلكتروني</span><strong>${user.email || "-"}</strong></div>
                <div class="profile-info-item"><span>رقم الجوال الشخصي</span><strong>${user.phone || "-"}</strong></div>
                <div class="profile-info-item"><span>البلد / الدولة</span><strong>${user.country || "-"}</strong></div>
                <div class="profile-info-item"><span>المدينة</span><strong>${user.city || "-"}</strong></div>
                <div class="profile-info-item"><span>تاريخ إنشاء الحساب</span><strong>${user.created_at ? new Date(user.created_at).toLocaleDateString('ar-SA') : "-"}</strong></div>
                <div class="profile-info-item"><span>آخر تسجيل دخول</span><strong>${user.last_login ? new Date(user.last_login).toLocaleString('ar-SA') : "-"}</strong></div>
                <div class="profile-info-item"><span>الصلاحية بالنظام</span><strong>${translateRole(user.role)}</strong></div>
                <div class="profile-info-item"><span>حالة الحساب</span><strong style="color:#16a34a; background:#dcfce7; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:700;">${user.status || "فعال"}</strong></div>
              </div>

              <div id="user-edit-form" style="display:none;margin-top:25px;">
                <div class="form-group"><label>الاسم الكامل</label><input class="form-control" type="text" id="edit-user-name" value="${user.full_name || user.name || ''}"></div>
                <div class="form-group"><label>رقم الجوال الشخصي</label><input class="form-control" type="text" id="edit-user-phone" value="${user.phone || ''}"></div>
                <div class="form-group"><label>البلد / الدولة</label><input class="form-control" type="text" id="edit-user-country" value="${user.country || ''}"></div>
                <div class="form-group"><label>المدينة</label><input class="form-control" type="text" id="edit-user-city" value="${user.city || ''}"></div>
                <div style="display:flex;gap:10px;margin-top:20px;">
                  <button class="primary-btn" id="save-user-btn">حفظ البيانات</button>
                  <button class="secondary-btn" id="cancel-user-btn">إلغاء</button>
                </div>
              </div>

            </div>

            <div class="card profile-card">
              <div class="card-header-row">
                <div>
                  <h3>إعدادات متطورة</h3>
                  <small>إدارة تفضيلات الهوية والملف</small>
                </div>
                <div class="mini-avatar"><i class="fas fa-cog"></i></div>
              </div>
              <div class="upcoming-features">
                <button class="feature-item" id="change-password-btn" type="button"><i class="fas fa-lock"></i><span>تغيير كلمة المرور</span></button>
${canManageCompanyProfile ? `
  <button class="feature-item" id="language-timezone-btn" type="button">
    <i class="fas fa-language"></i>
    <span>اللغة والمنطقة الزمنية</span>
  </button>
` : ''}

${canManageCompanyProfile ? `
  <button class="feature-item" id="billing-info-btn" type="button">
    <i class="fas fa-file-invoice"></i>
    <span>بيانات الفاتورة</span>
  </button>

  <button class="feature-item" id="company-logo-btn" type="button">
    <i class="fas fa-image"></i>
    <span>شعار الشركة</span>
  </button>
` : ''}
</div>

              </div>
            </div>
          </div>
        </div>
      `;

      this.bindEvents(companyId, token, company, user);

    } catch (error) {
      console.error("PROFILE ERROR:", error);
      viewport.innerHTML = `<div class="card" style="color:#ef4444;">حدث خطأ أثناء تحميل الملف الشخصي: ${error.message}</div>`;
    }
  },

  renderUserProfileOnly(viewport, user, token) {
    viewport.innerHTML = `
      <div class="profile-page">
        <div class="profile-hero">
          <div>
            <h1>حسابي والشخصية</h1>
            <p>إدارة بياناتك وبيانات العبور الفردية كمسؤول في منصة عقول.</p>
          </div>
          <div class="profile-avatar" id="change-avatar-sa-btn" style="cursor:pointer;">
            ${user.avatar ? `<img src="${API_BASE_URL}${user.avatar}" class="profile-avatar-img" style="width:60px;height:60px;border-radius:50%;object-fit:cover;">` : `<i class="fas fa-user-circle"></i>`}
          </div>
        </div>

        <div class="profile-grid">
          <div class="card profile-card" style="grid-column: span 2;">
            <div class="card-header-row">
              <div>
                <h3>بيانات المستخدم الشخصية</h3>
                <small>بيانات الهوية الفردية الحالية</small>
              </div>
              <button class="secondary-btn" id="edit-user-btn"><i class="fas fa-user-edit"></i> تعديل البيانات</button>
            </div>
            
            <div class="profile-info-list" id="user-info-display">
              <div class="profile-info-item"><span>الاسم الكامل</span><strong>${user.full_name || user.name || "-"}</strong></div>
              <div class="profile-info-item"><span>البريد الإلكتروني</span><strong>${user.email || "-"}</strong></div>
              <div class="profile-info-item"><span>رقم الجوال الشخصي</span><strong>${user.phone || "-"}</strong></div>
              <div class="profile-info-item"><span>البلد / الدولة</span><strong>${user.country || "-"}</strong></div>
              <div class="profile-info-item"><span>المدينة</span><strong>${user.city || "-"}</strong></div>
              <div class="profile-info-item"><span>تاريخ إنشاء الحساب</span><strong>${user.created_at ? new Date(user.created_at).toLocaleDateString('ar-SA') : "-"}</strong></div>
              <div class="profile-info-item"><span>آخر تسجيل دخول</span><strong>${user.last_login ? new Date(user.last_login).toLocaleString('ar-SA') : "-"}</strong></div>
              <div class="profile-info-item"><span>الصلاحية بالنظام</span><strong>${translateRole(user.role)}</strong></div>
              <div class="profile-info-item"><span>حالة الحساب</span><strong style="color:#16a34a; background:#dcfce7; padding:4px 10px; border-radius:20px; font-size:12px; font-weight:700;">${user.status || "فعال"}</strong></div>
            </div>

            <div id="user-edit-form" style="display:none;margin-top:25px;">
              <div class="form-group"><label>الاسم الكامل</label><input class="form-control" type="text" id="edit-user-name" value="${user.full_name || user.name || ''}"></div>
              <div class="form-group"><label>رقم الجوال الشخصي</label><input class="form-control" type="text" id="edit-user-phone" value="${user.phone || ''}"></div>
              <div class="form-group"><label>البلد / الدولة</label><input class="form-control" type="text" id="edit-user-country" value="${user.country || ''}"></div>
              <div class="form-group"><label>المدينة</label><input class="form-control" type="text" id="edit-user-city" value="${user.city || ''}"></div>
              <div style="display:flex;gap:10px;margin-top:20px;">
                <button class="primary-btn" id="save-user-btn">حفظ البيانات</button>
                <button class="secondary-btn" id="cancel-user-btn">إلغاء</button>
              </div>
            </div>
          </div>

          <div class="card profile-card" style="grid-column: span 1;">
            <div class="card-header-row">
              <div>
                <h3>أمان الحساب</h3>
                <small>إدارة كلمة المرور والعبور</small>
              </div>
              <div class="mini-avatar"><i class="fas fa-shield-alt"></i></div>
            </div>
            <div class="upcoming-features" style="margin-top:15px;">
              <button class="feature-item" id="change-password-btn" type="button" style="width:100%; text-align:right;">
                <i class="fas fa-lock"></i><span>تغيير كلمة المرور الشخصية</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(0, token, {}, user);
  },

  bindEvents(companyId, token, company, user) {
    const editCompanyBtn = document.getElementById("edit-company-btn");
    const companyForm = document.getElementById("company-edit-form");
    const cancelCompanyBtn = document.getElementById("cancel-company-btn");
    const saveCompanyBtn = document.getElementById("save-company-btn");
const canManageCompanyProfile = [
  "super_admin",
  "admin",
  "client_owner"
].includes(user.role);

    if (editCompanyBtn && companyForm) {
      editCompanyBtn.onclick = () => {
        companyForm.style.display = "block";
        editCompanyBtn.style.display = "none";
      };
    }
    if (cancelCompanyBtn && companyForm && editCompanyBtn) {
      cancelCompanyBtn.onclick = () => {
        companyForm.style.display = "none";
        editCompanyBtn.style.display = "inline-flex";
      };
    }

    const editUserBtn = document.getElementById("edit-user-btn");
    const userForm = document.getElementById("user-edit-form");
    const cancelUserBtn = document.getElementById("cancel-user-btn");
    const saveUserBtn = document.getElementById("save-user-btn");
    const userInfoDisplay = document.getElementById("user-info-display");

    if (editUserBtn && userForm) {
      editUserBtn.onclick = () => {
        userForm.style.display = "block";
        if(userInfoDisplay) userInfoDisplay.style.display = "none";
        editUserBtn.style.display = "none";
      };
    }
    if (cancelUserBtn && userForm && editUserBtn) {
      cancelUserBtn.onclick = () => {
        userForm.style.display = "none";
        if(userInfoDisplay) userInfoDisplay.style.display = "block";
        editUserBtn.style.display = "inline-flex";
      };
    }

    if (saveUserBtn) {
      saveUserBtn.onclick = async () => {
        try {
          saveUserBtn.disabled = true;
          saveUserBtn.innerText = "جاري الحفظ...";

          const updatedName = document.getElementById("edit-user-name").value.trim();
          const updatedPhone = document.getElementById("edit-user-phone").value.trim();
          const updatedCountry = document.getElementById("edit-user-country").value.trim();
          const updatedCity = document.getElementById("edit-user-city").value.trim();

          await fetch(`${API_BASE_URL}/api/users/profile-update`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              full_name: updatedName,
              phone: updatedPhone,
              country: updatedCountry,
              city: updatedCity
            })
          });

          const userStored = JSON.parse(localStorage.getItem("oqool_user") || "{}");
          userStored.full_name = updatedName;
          userStored.phone = updatedPhone;
          userStored.country = updatedCountry;
          userStored.city = updatedCity;
          localStorage.setItem("oqool_user", JSON.stringify(userStored));

          showToast("تم تحديث بياناتك الشخصية بنجاح ✅");
          await this.render();

        } catch (error) {
          console.error("SAVE USER PROFILE ERROR:", error);
          await this.render();
        }
      };
    }

if (saveCompanyBtn) {
  saveCompanyBtn.onclick = async () => {
    if (!canManageCompanyProfile) {
      showToast(
        "لا تملك صلاحية تعديل بيانات الشركة",
        "error"
      );
      return;
    }

    try {
      saveCompanyBtn.disabled = true;
      saveCompanyBtn.innerText =
        "جاري الحفظ...";

      const nameInput =
        document.getElementById(
          "edit-company-name"
        );

      const emailInput =
        document.getElementById(
          "edit-company-email"
        );

      const phoneInput =
        document.getElementById(
          "edit-company-phone"
        );

      const industryInput =
        document.getElementById(
          "edit-company-industry"
        );

      if (
        !nameInput ||
        !emailInput ||
        !phoneInput ||
        !industryInput
      ) {
        throw new Error(
          "حقول تعديل الشركة غير موجودة"
        );
      }

      const payload = {
        company_id: companyId,
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        phone: phoneInput.value.trim(),
        industry: industryInput.value.trim()
      };

      const res = await fetch(
        `${API_BASE_URL}/api/company/profile`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${token}`,
            "x-company-id":
              String(companyId)
          },
          body: JSON.stringify(payload)
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error ||
          "فشل حفظ التعديلات"
        );
      }

      showToast(
        "تم تحديث بيانات الشركة بنجاح"
      );

      await this.render();

    } catch (error) {
      console.error(
        "SAVE COMPANY PROFILE ERROR:",
        error
      );

      showToast(
        error.message ||
        "حدث خطأ أثناء حفظ البيانات",
        "error"
      );

      saveCompanyBtn.disabled = false;
      saveCompanyBtn.innerText =
        "حفظ التعديلات";
    }
  };
}

    const changePasswordBtn = document.getElementById("change-password-btn");
    if (changePasswordBtn) {
      changePasswordBtn.onclick = () => {
        this.openPasswordModal(companyId, token);
      };
    }
  
    const languageTimezoneBtn = document.getElementById("language-timezone-btn");
    if (languageTimezoneBtn) {
      languageTimezoneBtn.onclick = () => {
        this.openLanguageTimezoneModal(companyId, token);
      };
    }

    const billingInfoBtn = document.getElementById("billing-info-btn");
    if (billingInfoBtn) {
billingInfoBtn.onclick = () => {
  if (!canManageCompanyProfile) {
    showToast("لا تملك صلاحية تعديل بيانات الفاتورة", "error");
    return;
  }

  this.openBillingInfoModal(companyId, token, company);
};
    }

    const companyLogoBtn = document.getElementById("company-logo-btn");
    if (companyLogoBtn) {
      companyLogoBtn.onclick = () => {
        this.openCompanyLogoModal(companyId, token, company);
      };
    }

    const changeAvatarBtn = document.getElementById("change-avatar-btn");
    if (changeAvatarBtn) {
      changeAvatarBtn.onclick = () => {
        this.openUserAvatarModal(token, user);
      };
    }
    const changeAvatarSaBtn = document.getElementById("change-avatar-sa-btn");
    if (changeAvatarSaBtn) {
      changeAvatarSaBtn.onclick = () => {
        this.openUserAvatarModal(token, user);
      };
    }
  },

  openUserAvatarModal(token, user) {
    document.body.insertAdjacentHTML("beforeend", `
      <div class="modal-overlay" id="user-avatar-modal">
        <div class="modal-card">
          <h3 style="margin-bottom:20px;">الصورة الشخصية</h3>
          <div style="text-align:center;margin-bottom:20px;">
            ${
              user.avatar
                ? `<img src="${API_BASE_URL}${user.avatar}" alt="User Avatar" style="width:120px;height:120px;border-radius:50%;object-fit:cover;display:block;margin:auto;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.08)); border: 3px solid #4e73df;">`
                : `<div style="width:120px;height:120px;margin:auto;border-radius:50%;background:#f8fafc;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:40px;border:1px dashed #cbd5e1;"><i class="fas fa-user"></i></div>`
            }
          </div>
          <div class="form-group"><input class="form-control" type="file" id="user-avatar-file" accept="image/*"></div>
          <div style="display:flex;gap:10px;margin-top:20px;">
            <button class="primary-btn" id="save-user-avatar-btn">رفع الصورة</button>
            <button class="secondary-btn" id="close-user-avatar-modal">إلغاء</button>
          </div>
        </div>
      </div>
    `);

    document.getElementById("close-user-avatar-modal").onclick = () => {
      document.getElementById("user-avatar-modal").remove();
    };

    document.getElementById("save-user-avatar-btn").onclick = async () => {
      const saveBtn = document.getElementById("save-user-avatar-btn");
      const fileInput = document.getElementById("user-avatar-file");

      if (!fileInput.files.length) {
        showToast("اختر صورة أولاً", "warning");
        return;
      }

      try {
        saveBtn.disabled = true;
        saveBtn.innerText = "جاري الرفع...";

        const formData = new FormData();
        formData.append("avatar", fileInput.files[0]);

        const res = await fetch(`${API_BASE_URL}/api/users/profile/avatar`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "فشل رفع الصورة الشخصية");

        showToast("تم رفع الصورة الشخصية بنجاح ✅");
        
        const userStored = JSON.parse(localStorage.getItem("oqool_user") || "{}");
        userStored.avatar = data.avatar;
        localStorage.setItem("oqool_user", JSON.stringify(userStored));

        document.getElementById("user-avatar-modal").remove();
        await this.render();

      } catch (error) {
        showToast(error.message || "حدث خطأ أثناء رفع الصورة", "error");
        saveBtn.disabled = false;
        saveBtn.innerText = "رفع الصورة";
      }
    };
  },

  openPasswordModal(companyId, token) {
    document.body.insertAdjacentHTML("beforeend", `
      <div class="modal-overlay" id="password-modal">
        <div class="modal-card">
          <h3 style="margin-bottom:20px;">تغيير كلمة المرور</h3>
          <div class="form-group"><input class="form-control" type="password" id="current-password" placeholder="كلمة المرور الحالية"></div>
          <div class="form-group"><input class="form-control" type="password" id="new-password" placeholder="كلمة المرور الجديدة"></div>
          <div class="form-group"><input class="form-control" type="password" id="confirm-password" placeholder="تأكيد كلمة المرور"></div>
          <div style="display:flex;gap:10px;margin-top:20px;">

            <button class="primary-btn" id="save-password-btn">حفظ</button>
            <button class="secondary-btn" id="close-password-modal">إلغاء</button>
          </div>

        </div>
      </div>
    `);

    document.getElementById("close-password-modal").onclick = () => {
      document.getElementById("password-modal").remove();
    };

    document.getElementById("save-password-btn").onclick = async () => {
      const saveBtn = document.getElementById("save-password-btn");
      const currentPassword = document.getElementById("current-password").value.trim();
      const newPassword = document.getElementById("new-password").value.trim();
      const confirmPassword = document.getElementById("confirm-password").value.trim();

      if (!currentPassword || !newPassword || !confirmPassword) {
        alert("أدخل جميع الحقول");
        return;
      }
      if (newPassword.length < 6) {
        alert("كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل");
        return;
      }
      if (newPassword !== confirmPassword) {
        alert("تأكيد كلمة المرور غير مطابق");
        return;
      }

      try {
        saveBtn.disabled = true;
        saveBtn.innerText = "جاري الحفظ...";

        const res = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "x-company-id": companyId || "0"
          },
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "فشل تغيير كلمة المرور");

        alert("تم تغيير كلمة المرور بنجاح");
        document.getElementById("password-modal").remove();

      } catch (error) {
        console.error("CHANGE PASSWORD ERROR:", error);
        alert(error.message || "حدث خطأ أثناء تغيير كلمة المرور");
        saveBtn.disabled = false;
        saveBtn.innerText = "حفظ";
      }
    };
  },

  openLanguageTimezoneModal(companyId, token) {
    const currentLanguage = document.body.dataset.language || "ar";
    const currentTimezone = document.body.dataset.timezone || "Asia/Riyadh";

    document.body.insertAdjacentHTML("beforeend", `
      <div class="modal-overlay" id="language-timezone-modal">
        <div class="modal-card">
          <h3 style="margin-bottom:20px;">اللغة والمنطقة الزمنية</h3>
          <div class="form-group">
            <label>اللغة</label>
            <select class="form-control" id="profile-language">
              <option value="ar" ${currentLanguage === "ar" ? "selected" : ""}>العربية</option>
              <option value="en" ${currentLanguage === "en" ? "selected" : ""}>English</option>
            </select>
          </div>
          <div class="form-group">
            <label>المنطقة الزمنية</label>
            <select class="form-control" id="profile-timezone">
              <option value="Asia/Riyadh" ${currentTimezone === "Asia/Riyadh" ? "selected" : ""}>Asia/Riyadh</option>
              <option value="Asia/Dubai" ${currentTimezone === "Asia/Dubai" ? "selected" : ""}>Asia/Dubai</option>
              <option value="Asia/Kuwait" ${currentTimezone === "Asia/Kuwait" ? "selected" : ""}>Asia/Kuwait</option>
            </select>
          </div>
          <div style="display:flex;gap:10px;margin-top:20px;">
            <button class="primary-btn" id="save-language-timezone-btn">حفظ</button>
            <button class="secondary-btn" id="close-language-timezone-modal">إلغاء</button>
          </div>
        </div>
      </div>
    `);

    document.getElementById("close-language-timezone-modal").onclick = () => {
      document.getElementById("language-timezone-modal").remove();
    };

    document.getElementById("save-language-timezone-btn").onclick = async () => {
      const saveBtn = document.getElementById("save-language-timezone-btn");
      const language = document.getElementById("profile-language").value;
      const timezone = document.getElementById("profile-timezone").value;

      try {
        saveBtn.disabled = true;
        saveBtn.innerText = "جاري الحفظ...";

        const res = await fetch(`${API_BASE_URL}/api/company/profile/settings`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "x-company-id": companyId
          },
          body: JSON.stringify({ company_id: companyId, language, timezone })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "فشل حفظ الإعدادات");

        alert("تم تحديث اللغة والمنطقة الزمنية بنجاح");
        document.getElementById("language-timezone-modal").remove();
        await this.render();

      } catch (error) {
        alert(error.message || "حدث خطأ أثناء الحفظ");
        saveBtn.disabled = false;
        saveBtn.innerText = "حفظ";
      }
    };
  },

async openBillingInfoModal(companyId, token, company) {
  let profile = {};

  try {
    const res = await fetch(`${API_BASE_URL}/api/billing-profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-company-id": companyId
      }
    });

    profile = await res.json();
    if (!profile) profile = {};

  } catch (err) {
    console.error("Billing profile load failed:", err);
    profile = {};
  }

  document.body.insertAdjacentHTML("beforeend", `
    <div class="modal-overlay" id="billing-info-modal">
      <div class="modal-card">
        <h3 style="margin-bottom:20px;">بيانات الفاتورة</h3>

        <div class="form-group">
          <label>اسم الجهة على الفاتورة</label>
          <input class="form-control" type="text" id="billing-name" value="${profile.invoice_display_name || company.billing_name || company.name || ""}">
        </div>

        <div class="form-group">
          <label>الرقم الضريبي</label>
          <input class="form-control" type="text" id="tax-number" value="${profile.vat_number || company.tax_number || ""}">
        </div>

        <div class="form-group">
          <label>السجل التجاري</label>
          <input class="form-control" type="text" id="commercial-register" value="${profile.cr_number || company.commercial_register || ""}">
        </div>

        <div class="form-group">
          <label>عنوان الفاتورة</label>
          <textarea class="form-control" id="billing-address">${profile.address || company.billing_address || ""}</textarea>
        </div>

        <div class="form-group">
          <label>هاتف الفاتورة</label>
          <input class="form-control" type="text" id="billing-phone" value="${profile.phone || company.phone || ""}">
        </div>

        <div class="form-group">
          <label>بريد الفواتير</label>
          <input class="form-control" type="email" id="billing-email" value="${profile.email || company.billing_email || company.email || ""}">
        </div>

        <div class="form-group">
          <label>ملاحظات الفاتورة</label>
          <textarea class="form-control" id="invoice-notes">${profile.invoice_notes || ""}</textarea>
        </div>

<div class="form-group">
  <label>سياسة الإلغاء</label>
  <textarea class="form-control" id="cancellation-policy">${profile.cancellation_policy || ""}</textarea>
</div>

<!-- هنا أضف الضريبة -->

<div style="margin:14px 0 18px; padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;">
  <label style="display:flex; align-items:center; justify-content:space-between; gap:12px; cursor:pointer; margin:0;">
    <div>
      <div style="font-weight:800; color:#334155; font-size:14px;">تفعيل الضريبة على الفاتورة</div>
      <div style="color:#64748b; font-size:12px; margin-top:4px;">عند التفعيل يتم احتساب الضريبة حسب النسبة المحددة</div>
    </div>

    <input
      type="checkbox"
      id="tax-enabled"
      ${profile.tax_enabled == 1 ? "checked" : ""}
      style="width:18px; height:18px; accent-color:#2563eb; cursor:pointer;"
    >
  </label>

  <div style="margin-top:12px;">
    <label style="display:block; font-size:13px; font-weight:700; color:#475569; margin-bottom:6px;">
      نسبة الضريبة (%)
    </label>
    <input
      class="form-control"
      type="number"
      id="tax-rate"
      min="0"
      step="0.01"
      value="${profile.tax_rate ?? 15}"
      style="text-align:left; direction:ltr;"
    >
  </div>
</div>
<!-- بعدها مباشرة يبقى قسم Powered By OQOOL -->

<div style="margin:14px 0 18px; padding:12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;">
  <label style="display:flex; align-items:center; justify-content:space-between; gap:12px; cursor:pointer; margin:0;">
    <div>
      <div style="font-weight:800; color:#334155; font-size:14px;">علامة عقول أسفل الفاتورة</div>
      <div style="color:#64748b; font-size:12px; margin-top:4px;">تظهر عبارة صغيرة: Powered by OQOOL</div>
    </div>

    <input
      type="checkbox"
      id="powered-by-oqool"
      ${profile.powered_by_oqool ? "checked" : ""}
      style="width:18px; height:18px; accent-color:#2563eb; cursor:pointer;"
    >
  </label>
</div>

<div style="display:flex;gap:10px;margin-top:20px;">
  <button class="primary-btn" id="save-billing-info-btn">حفظ</button>
  <button class="secondary-btn" id="preview-invoice-btn" type="button">معاينة الفاتورة</button>
  <button class="secondary-btn" id="close-billing-info-modal">إلغاء</button>
</div>

      </div>
    </div>
  `);

  document.getElementById("close-billing-info-modal").onclick = () => {
    document.getElementById("billing-info-modal").remove();
  };

const previewInvoiceBtn = document.getElementById("preview-invoice-btn");
if (previewInvoiceBtn) {
  previewInvoiceBtn.onclick = async () => {
    this.openInvoicePreviewModal(companyId, token);
  };
}

  document.getElementById("save-billing-info-btn").onclick = async () => {
    const saveBtn = document.getElementById("save-billing-info-btn");

const payload = {
  invoice_display_name: document.getElementById("billing-name").value.trim(),
  vat_number: document.getElementById("tax-number").value.trim(),
  cr_number: document.getElementById("commercial-register").value.trim(),
  address: document.getElementById("billing-address").value.trim(),
  phone: document.getElementById("billing-phone").value.trim(),
  email: document.getElementById("billing-email").value.trim(),
  invoice_notes: document.getElementById("invoice-notes").value.trim(),
  cancellation_policy: document.getElementById("cancellation-policy").value.trim(),

  tax_enabled: document.getElementById("tax-enabled").checked,
  tax_rate: Number(document.getElementById("tax-rate").value || 0),

  powered_by_oqool: document.getElementById("powered-by-oqool").checked,
  logo_url: profile.logo_url || company.logo || null
};

    try {
      saveBtn.disabled = true;
      saveBtn.innerText = "جاري الحفظ...";

      const res = await fetch(`${API_BASE_URL}/api/billing-profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل حفظ بيانات الفاتورة");

      showToast("تم حفظ بيانات الفاتورة بنجاح ✅");
      document.getElementById("billing-info-modal").remove();
      await this.render();

    } catch (error) {
      showToast(error.message || "حدث خطأ أثناء حفظ بيانات الفاتورة", "error");
      saveBtn.disabled = false;
      saveBtn.innerText = "حفظ";
    }
  };
},


async openInvoicePreviewModal(companyId, token) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/invoices/preview`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "x-company-id": companyId
      }
    });

    const invoice = await res.json();
    if (!res.ok) throw new Error(invoice.error || "فشل تحميل معاينة الفاتورة");

    document.body.insertAdjacentHTML("beforeend", `
      <div class="modal-overlay" id="invoice-preview-modal">
        <div class="modal-card" style="max-width:520px;">
          <h3 style="margin-bottom:15px;">معاينة الفاتورة</h3>

          <div style="border:1px solid #e2e8f0;border-radius:16px;padding:20px;background:#fff;direction:rtl;">

${invoice.company.logo_url ? `
  <div style="text-align:center;margin-bottom:12px;">
    <img src="${API_BASE_URL}${invoice.company.logo_url}" style="max-width:120px;max-height:70px;object-fit:contain;">
  </div>
` : ""}

<h2 style="margin:0 0 8px;color:#24397c;">${invoice.company.name}</h2>

<div style="font-size:13px;color:#64748b;line-height:1.9;margin-top:8px;">
  ${invoice.company.vat_number ? `<div>الرقم الضريبي: ${invoice.company.vat_number}</div>` : ""}
  ${invoice.company.cr_number ? `<div>السجل التجاري: ${invoice.company.cr_number}</div>` : ""}
  ${invoice.company.address ? `<div>العنوان: ${invoice.company.address}</div>` : ""}
  ${invoice.company.phone ? `<div>الهاتف: ${invoice.company.phone}</div>` : ""}
  ${invoice.company.email ? `<div>البريد: ${invoice.company.email}</div>` : ""}
</div>

<hr style="margin:18px 0;border:none;border-top:1px dashed #e2e8f0;">

            ${invoice.items.map(item => `
              <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f1f5f9;">
                <div>
                  <strong>${item.name}</strong>
                  <div style="font-size:12px;color:#64748b;">${item.description || ""}</div>
                </div>
                <strong>${item.total} ريال</strong>
              </div>
            `).join("")}

            <div style="margin-top:15px;line-height:2;">
              <div style="display:flex;justify-content:space-between;"><span>المجموع</span><strong>${invoice.subtotal} ريال</strong></div>
              <div style="display:flex;justify-content:space-between;"><span>الضريبة</span><strong>${invoice.vat} ريال</strong></div>
              <div style="display:flex;justify-content:space-between;font-size:18px;color:#24397c;"><span>الإجمالي</span><strong>${invoice.total} ريال</strong></div>
            </div>

${invoice.company.invoice_notes ? `
  <div style="margin-top:15px;background:#f8fafc;padding:12px;border-radius:10px;font-size:13px;color:#475569;">
    <strong>ملاحظات الفاتورة:</strong><br>
    ${invoice.company.invoice_notes}
  </div>
` : ""}

${invoice.company.cancellation_policy ? `
  <div style="margin-top:10px;background:#f8fafc;padding:12px;border-radius:10px;font-size:13px;color:#475569;">
    <strong>سياسة الإلغاء:</strong><br>
    ${invoice.company.cancellation_policy}
  </div>
` : ""}




            ${invoice.company.powered_by_oqool ? `
              <div style="text-align:center;margin-top:18px;font-size:12px;color:#94a3b8;">
                Powered by OQOOL
              </div>
            ` : ""}
          </div>

          <button class="secondary-btn" id="close-invoice-preview-modal" style="width:100%;margin-top:18px;">إغلاق</button>
        </div>
      </div>
    `);

    document.getElementById("close-invoice-preview-modal").onclick = () => {
      document.getElementById("invoice-preview-modal").remove();
    };

  } catch (error) {
    showToast(error.message || "فشل عرض معاينة الفاتورة", "error");
  }
},


  openCompanyLogoModal(companyId, token, company) {
    document.body.insertAdjacentHTML("beforeend", `
      <div class="modal-overlay" id="company-logo-modal">
        <div class="modal-card">
          <h3 style="margin-bottom:20px;">شعار الشركة</h3>
          <div style="text-align:center;margin-bottom:20px;">
            ${
              company.logo
                ? `<img src="${API_BASE_URL}${company.logo}" alt="Company Logo" style="max-width:220px;max-height:120px;object-fit:contain;display:block;margin:auto;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.08));">`
                : `<div style="width:120px;height:120px;margin:auto;border-radius:16px;background:#f8fafc;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:40px;border:1px dashed #cbd5e1;"><i class="fas fa-image"></i></div>`
            }
          </div>
          <div class="form-group"><input class="form-control" type="file" id="company-logo-file" accept="image/*"></div>
          <div style="display:flex;gap:10px;margin-top:20px;">
            <button class="primary-btn" id="save-company-logo-btn">رفع الشعار</button>
            <button class="secondary-btn" id="close-company-logo-modal">إلغاء</button>
          </div>
        </div>
      </div>
    `);

    document.getElementById("close-company-logo-modal").onclick = () => {
      document.getElementById("company-logo-modal").remove();
    };

    document.getElementById("save-company-logo-btn").onclick = async () => {
      const saveBtn = document.getElementById("save-company-logo-btn");
      const fileInput = document.getElementById("company-logo-file");

      if (!fileInput.files.length) {
        showToast("اختر صورة أولاً", "warning");
        return;
      }

      try {
        saveBtn.disabled = true;
        saveBtn.innerText = "جاري الرفع...";

        const formData = new FormData();
        formData.append("logo", fileInput.files[0]);
        formData.append("company_id", companyId);

        const res = await fetch(`${API_BASE_URL}/api/company/profile/logo`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "x-company-id": companyId
          },
          body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "فشل رفع الشعار");

        showToast("تم رفع الشعار بنجاح");
        document.getElementById("company-logo-modal").remove();
        await this.render();

      } catch (error) {
        showToast(error.message || "حدث خطأ أثناء رفع الشعار");
        saveBtn.disabled = false;
        saveBtn.innerText = "رفع الشعار";
      }
    };
  }
};

function translateStatus(status) {
  const map = {
    active: "نشط",
    pending: "بانتظار الدفع",
    expired: "منتهي",
    cancelled: "ملغي",
    failed: "فاشل",
    trial: "تجريبي"
  };
  return map[status] || status || "-";
}

function translateRole(role) {
  const map = {
    super_admin: "مدير النظام العام",
    admin: "مدير شركة",
    account_manager: "مدير حساب",
    client_owner: "مالك المؤسسة",
    client: "موظف",
    agent: "موظف مبيعات",
    provider: "مقدم خدمة",
    staff: "طاقم العمل"
  };
  return map[role] || role || "-";
}
