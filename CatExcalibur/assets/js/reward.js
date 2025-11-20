// URL และ API Endpoint
const API_URL = 'https://wpvr9cxmmj.execute-api.us-east-1.amazonaws.com/Cat_Excalibur';
const PROMOTIONS_URL = `${API_URL}/promotions`;

// Local Storage Keys
const CUSTOMER_ID = localStorage.getItem('CustomerID');
const USER_ROLE = localStorage.getItem('UserRole');

let CURRENT_POINTS;
let allPromotions = []; // ใช้เก็บรายละเอียดโปรโมชั่นทั้งหมดที่ดึงมาจาก API
let selectedPromos = []// เก็บเฉพาะ Code ของโปรโมชั่นที่ถูกเลือก

if(USER_ROLE === 'Admins'){
    CURRENT_POINTS = parseInt(localStorage.getItem('CurrentCheckoutPoints'))
}else{
    CURRENT_POINTS = parseInt(localStorage.getItem('Points')) || 0;
}

// ประเภทโปรโมชั่นสำหรับการจำกัดสิทธิ์
const PROMO_TYPES = {
    DISCOUNT: 'DISCOUNT',   // ส่วนลดเงินบาทหรือเปอร์เซ็นต์
    BONUS_ITEM: 'BONUS_ITEM', // ของแถม
    POINT_REDEEM: 'POINT_REDEEM', // แลกแต้มเพื่อส่วนลด
    POINT_EARN: 'POINT_EARN' // ได้รับแต้มพิเศษ
};
document.addEventListener('DOMContentLoaded', initRewardPage);

// ------------------------------------------------------------------
// 1. Initialization and Data Loading
// ------------------------------------------------------------------

async function initRewardPage() {
    // อัปเดตข้อมูลแต้มสะสม
    document.getElementById('current-points').textContent = CURRENT_POINTS.toLocaleString() + ' แต้ม';
    document.getElementById('user-role-display').textContent = USER_ROLE;

    // ตรวจสอบสิทธิ์: เฉพาะ Admin ที่มีสิทธิ์ 'ยืนยันการใช้'
    if (USER_ROLE === 'Admins') {
        document.getElementById('apply-promo-btn').style.display = 'block';
    }
    await loadPromotions();
    
    const applyBtn = document.getElementById('apply-promo-btn');
    if (applyBtn) {
        applyBtn.addEventListener('click', applySelectedPromos);
    }
}

async function loadPromotions() {
    try {
        const response = await fetch(PROMOTIONS_URL);
        const promos = await response.json();
        allPromotions = promos; // เก็บรายละเอียดทั้งหมดไว้ใน Global State
        const listContainer = document.getElementById('rewards-list');
        listContainer.innerHTML = ''; // Clear loading state
        promos.forEach(promo => {
            const promoType = determinePromoType(promo);
            const item = createRewardItem(promo, promoType);
            listContainer.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading promotions:', error);
        document.getElementById('rewards-list').innerHTML = '<p style="color: red;">ไม่สามารถโหลดรายการโปรโมชั่นได้ กรุณาตรวจสอบ API.</p>';
    }
}

// ------------------------------------------------------------------
// 2. Logic การจำกัดสิทธิ์และการเลือก (Frontend Constraints)
// ------------------------------------------------------------------

function determinePromoType(promo) {
    if (promo.DiscountValue > 0 || promo.DiscountPercent > 0) return PROMO_TYPES.DISCOUNT;
    if (promo.BonusProductID) return PROMO_TYPES.BONUS_ITEM;
    if (promo.MinPoint > 0) return PROMO_TYPES.POINT_REDEEM;
    if (promo.RewardPoints > 0) return PROMO_TYPES.POINT_EARN;
    return 'OTHER';
}


function createRewardItem(promo, promoType) {
    const isPointRedeem = promoType === PROMO_TYPES.POINT_REDEEM;
    const canRedeem = isPointRedeem ? (CURRENT_POINTS >= promo.MinPoint) : true;
    
    const div = document.createElement('div');
    div.className = `reward-item ${canRedeem ? '' : 'disabled-item'}`;
    div.style.background = isPointRedeem ? '#f44336' : '#4CAF50';
    div.setAttribute('data-code', promo.Code);

    div.onclick = () => selectReward(promo, promoType, div);

    let costText = '';
    if (isPointRedeem) {
        costText = `ใช้ ${promo.MinPoint.toLocaleString()} แต้ม`;
    } else if (promoType === PROMO_TYPES.POINT_EARN) {
        costText = `รับเพิ่ม ${promo.RewardPoints.toLocaleString()} แต้ม`;
    } else {
         costText = `ซื้อขั้นต่ำ ${promo.MinSpend.toLocaleString()} บาท`;
    }

    div.innerHTML = `
        <div class="reward-icon">${promoType === PROMO_TYPES.BONUS_ITEM ? '🎁' : '💰'}</div>
        <div class="reward-name">${promo.Description}</div>
        <div class="reward-type">${isPointRedeem ? 'แลกแต้ม' : 'โปรโมชั่น'}</div>
        <div class="reward-cost">${costText}</div>
    `;
    return div;
}

function selectReward(promo, promoType, element) {
    const promoCode = promo.Code;
    const pointsCost = promo.MinPoint || 0;
    const index = selectedPromos.indexOf(promoCode);
    
    if (index > -1) {
        // Deselect: ลบออก
        selectedPromos.splice(index, 1);
        element.classList.remove('selected');
    } else {
        // Select: ตรวจสอบเงื่อนไขก่อนเพิ่ม
        
        // 1. ตรวจสอบการใช้แต้มสะสม
        if (pointsCost > 0 && pointsCost > CURRENT_POINTS) {
            alert('❌ แต้มสะสมไม่เพียงพอต่อการแลกสิทธิ์นี้');
            return;
        }

        // 2. ตรวจสอบประเภท Conflict: ห้ามใช้เกิน 1 สิทธิ์ต่อประเภท (Discount, Point Redeem, Bonus Item)
        const currentSelectedTypes = getSelectedPromoTypes(selectedPromos);
        const isConflict = currentSelectedTypes.has(promoType);
        
        // 🚨 Logic การจำกัดสิทธิ์หลัก: ห้ามใช้มากกว่า 1 สิทธิ์ในประเภทสำคัญ
        if ((promoType === PROMO_TYPES.DISCOUNT || promoType === PROMO_TYPES.POINT_REDEEM || promoType === PROMO_TYPES.BONUS_ITEM) && isConflict) {
             alert(`❌ ไม่สามารถใช้โปรโมชั่นประเภท ${promoType} ได้เกิน 1 สิทธิ์`);
             return;
        }
        
        // หากผ่าน: เพิ่มโค้ดและอัปเดต UI
        selectedPromos.push(promoCode);
        element.classList.add('selected');
    }
    
    // 💡 บันทึกโค้ดโปรโมชั่นที่เลือกไว้ใน Local Storage ชั่วคราว
    localStorage.setItem('SelectedPromoCodes', JSON.stringify(selectedPromos));
    // document.getElementById('selection-status').textContent = `เลือกแล้ว: ${selectedPromos.length} รายการ`;
    updateSelectionStatus();
}

// ------------------------------------------------------------------
// 3. ฟังก์ชันอัปเดตสถานะการเลือก (แสดง Code และ Description)
// ------------------------------------------------------------------
function getSelectedPromoTypes(codesArray) {
    const types = new Set();
    codesArray.forEach(code => {
        const promo = allPromotions.find(p => p.Code === code);
        if (promo) {
            types.add(determinePromoType(promo));
        }
    });
    return types;
}

function updateSelectionStatus() {
    const statusDiv = document.getElementById('selection-status');
    
    if (selectedPromos.length === 0) {
        statusDiv.innerHTML = 'ยังไม่มีโปรโมชั่นถูกเลือก';
        statusDiv.style.color = '#dc2626'; // สีแดง
        return;
    }
    
    let html = '<strong>✓ โปรโมชั่นที่เลือกแล้ว:</strong><ul style="list-style-type: none; padding-left: 0;">';
    
    selectedPromos.forEach(code => {
        // ค้นหารายละเอียดโปรโมชั่นจาก Code ที่เลือก
        const promoDetail = allPromotions.find(p => p.Code === code);
        
        if (promoDetail) {
            const costText = promoDetail.MinPoint > 0 ? `(ใช้ ${promoDetail.MinPoint} แต้ม)` : '';
            html += `
                <li style="margin-top: 5px; background: #E0F7FA; padding: 5px; border-radius: 4px; border-left: 3px solid #00BCD4;">
                    <span style="font-weight: bold;">${promoDetail.Code}</span>: ${promoDetail.Description} ${costText}
                </li>
            `;
        }
    });

    html += '</ul>';
    statusDiv.innerHTML = html;
    statusDiv.style.color = '#333';
}

// ------------------------------------------------------------------
// 4. Final Submission Logic
// ------------------------------------------------------------------

function applySelectedPromos() {
    const codes = localStorage.getItem('SelectedPromoCodes');
    const selectedCodesArray = JSON.parse(codes || '[]');
    
    if (selectedCodesArray.length === 0) {
        // ถ้าไม่เลือกอะไรเลย ก็กลับไปหน้า Checkout โดยไม่มี PromoCodes
        window.location.href = `checkout.html?customerID=${CUSTOMER_ID}`;
        return;
    }
    
    // 💡 ส่งโค้ดที่เลือกไปหน้า Checkout ผ่าน Query Params
    const promoCodesString = selectedCodesArray.join(',');
    
    // 🎯 สิ่งที่ต้องส่ง: CustomerID และ PromoCodes
    window.location.href = `checkout.html?customerID=${CUSTOMER_ID}&promos=${promoCodesString}`;
}