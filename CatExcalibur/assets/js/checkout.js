// checkout.js - FIXED VERSION
const API_BASE_URL = 'https://wpvr9cxmmj.execute-api.us-east-1.amazonaws.com/Cat_Excalibur'; 

// Endpoints
const SEARCH_CUSTOMER_URL = `${API_BASE_URL}/search-customer`;
const ORDER_DETAILS_URL = `${API_BASE_URL}/order-details`;
const CALCULATE_PROMO_URL = `${API_BASE_URL}/checkout/calculate`;
const CHECKOUT_URL = `${API_BASE_URL}/checkout`;

// Global State Variables
let currentCustomerID = null;
let currentCustomerUsername = null;
let currentCustomerPoints = 0;
let currentReservationID = null;
let selectedPaymentMethod = 'Cash';
let selectedPromoCodes = [];
let initialGrandTotal = 0; 
let finalPayableAmount = 0;
let currentOrderDetails = [];

// ------------------------------------------------------------------
// A. Initialization and Access Control
// ------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', initCheckoutPage);

async function initCheckoutPage() {
    console.log('🚀 Initializing Checkout Page...');
    
    // 1. Access Control (Admin/Employee Only)
    const userRole = localStorage.getItem('UserRole');
    if (userRole !== 'Admins') {
        alert('❌ ACCESS DENIED: หน้านี้สำหรับพนักงานเท่านั้น');
        window.location.href = 'index.html';
        return;
    }

    // 2. 🔥 Check URL Parameters First (Higher Priority)
    const urlParams = new URLSearchParams(window.location.search);
    const urlCustomerID = urlParams.get('customerID');
    const urlPromos = urlParams.get('promos');
    
    console.log('📋 URL Parameters:', {
        promos: urlPromos
    });

    // 3. Process Promo Codes from URL (Fix: Handle comma-separated values properly)
    if (urlPromos) {
        // Split by comma and remove empty strings
        selectedPromoCodes = urlPromos
            .split(',')
            .map(code => code.trim())
            .filter(code => code.length > 0);
        
        console.log('🎁 Promo codes from URL:', selectedPromoCodes);
        console.log('🎟️ Number of promo codes:', selectedPromoCodes.length);
    }

    // 4. Use URL CustomerID if available, otherwise check localStorage
    currentCustomerID = localStorage.getItem('CurrentCheckoutCustomerID');
    currentCustomerUsername = localStorage.getItem('CurrentCheckoutUsername');
    currentCustomerPoints = parseInt(localStorage.getItem('CurrentCheckoutPoints') || '0');

    
    // 5. Load checkout if customer is identified
    if (currentCustomerID) {
        console.log('✅ Customer identified:', currentCustomerID);
        safeHideElement('customer-input-section');
        safeShowElement('checkout-content');
        await loadOrderData();
    } else {
        console.log('⏳ Waiting for customer identification...');
        const searchBtn = document.getElementById('search-customer-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', handleCustomerIdentification);
        }
    }
}

// ------------------------------------------------------------------
// B. Step 1: Customer Search
// ------------------------------------------------------------------

async function handleCustomerIdentification() {
    const phoneInput = document.getElementById('phone-number-input');
    const button = document.getElementById('search-customer-btn');

    if (!phoneInput || !phoneInput.value.trim()) {
        alert('กรุณากรอกเบอร์โทรศัพท์');
        return;
    }

    const phoneNumber = phoneInput.value.trim();
    
    if (button) {
        button.disabled = true;
        button.textContent = 'กำลังค้นหา...';
    }

    try {
        console.log('🔍 Searching customer with phone:', phoneNumber);
        
        const response = await fetch(SEARCH_CUSTOMER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ PhoneNumber: phoneNumber }) 
        });

        const result = await response.json();
        console.log('📥 Search Response:', result);
        
        if (response.status === 200) {
            // Store customer data
            currentCustomerID = result.CustomerID;
            currentCustomerUsername = result.Username || 'Unknown';
            currentCustomerPoints = result.Points || 0;
            
            // Save to localStorage
            localStorage.setItem('CurrentCheckoutCustomerID', currentCustomerID); 
            localStorage.setItem('CurrentCheckoutUsername', currentCustomerUsername); 
            localStorage.setItem('CurrentCheckoutPoints', currentCustomerPoints); 

            console.log('✅ Customer found:', currentCustomerUsername);
            
            // Switch UI
            safeHideElement('customer-input-section');
            safeShowElement('checkout-content');
            
            await loadOrderData();
            
        } else if (response.status === 404) {
            alert('❌ ไม่พบสมาชิกในระบบ');
        } else {
            alert(`❌ ข้อผิดพลาด: ${result.error || 'API Error'}`);
        }
        
    } catch (error) {
        console.error('❌ Customer Search Error:', error);
        alert('❌ การเชื่อมต่อล้มเหลว กรุณาลองใหม่อีกครั้ง');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = 'ค้นหาลูกค้า';
        }
    }
}

// ------------------------------------------------------------------
// C. Step 2 & 3: Load Order and Calculate Promotions
// ------------------------------------------------------------------

async function loadOrderData() {
    fetchCustomerPoints()
    
    console.log('📦 Loading order data for CustomerID:', currentCustomerID);
    
    const itemContainer = document.getElementById('itemDetailsContainer');
    
    if (itemContainer) {
        itemContainer.innerHTML = `
            <div class="text-gray-500 text-center py-4">
                <i class="fas fa-spinner fa-spin mr-2"></i> กำลังดึงรายการ Order...
            </div>
        `;
    }

    try {
        // 1. Fetch Order Details
        const endpoint = `${ORDER_DETAILS_URL}?CustomerID=${currentCustomerID}`;
        console.log('📡 Fetching from:', endpoint);
        
        const response = await fetch(endpoint, { method: 'GET' });
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const orderItems = await response.json();
        console.log('📥 Order Items:', orderItems);

        let htmlContent = '';
        let grandTotal = 0.0;
        
        if (orderItems && Array.isArray(orderItems) && orderItems.length > 0) {
            orderItems.forEach(item => {
                const qty = item.QTY_Product || 0;
                const price = item.ProductPrice || 0;
                const name = item.ProductName || 'Unknown Product';
                const subTotal = price * qty;
                
                grandTotal += subTotal;
                
                htmlContent += `
                    <div class="item-row flex justify-between py-2 border-b">
                        <span class="truncate">${qty}x ${name}</span>
                        <span class="font-medium">฿${subTotal.toFixed(2)}</span>
                    </div>
                `;
            });
            
            if (itemContainer) {
                itemContainer.innerHTML = htmlContent;
            }
        } else {
            if (itemContainer) {
                itemContainer.innerHTML = `
                    <div class="text-gray-500 text-center py-4">
                        ลูกค้ายังไม่มีรายการสั่งซื้อที่ต้องชำระเงิน
                    </div>
                `;
            }
        }

        // 2. Update Totals
        initialGrandTotal = grandTotal;
        finalPayableAmount = grandTotal;
        
        safeUpdateText('originalTotalAmount', initialGrandTotal.toFixed(2));
        safeUpdateText('finalTotalAmount', finalPayableAmount.toFixed(2));
        
        console.log('💰 Grand Total:', initialGrandTotal);
        
        // 3. Apply Promotions (if any)
        if (selectedPromoCodes.length > 0) {
            console.log('🎟️ Applying promo codes:', selectedPromoCodes);
            await applyPromotionsAndRender(initialGrandTotal, selectedPromoCodes);
        } else {
            // Hide discount rows if no promos
            safeHideElement('promoDiscountRow');
            safeHideElement('pointsDeductedRow');
        }

    } catch (error) {
        console.error('❌ Order Data Load Error:', error);
        if (itemContainer) {
            itemContainer.innerHTML = `
                <div class="text-red-500 text-center py-4">
                    ❌ ข้อผิดพลาดในการโหลดรายการ: ${error.message}
                </div>
            `;
        }
        alert('❌ ไม่สามารถโหลดข้อมูล Order ได้');
    }
}

async function applyPromotionsAndRender(initialTotal, codes) {
    console.log('🎁 Applying promotions:', codes);
    console.log('💰 Initial Total:', initialTotal);
    
    // If no promo codes, use original total
    if (!codes || codes.length === 0) {
        finalPayableAmount = initialTotal;
        safeUpdateText('finalTotalAmount', finalPayableAmount.toFixed(2));
        safeHideElement('promoDiscountRow');
        safeHideElement('pointsDeductedRow');
        return;
    }

    // ⚠️ Skip promo calculation if initial total is 0
    if (initialTotal === 0) {
        console.warn('⚠️ Cannot apply promotions: Order total is 0');
        finalPayableAmount = 0;
        safeUpdateText('finalTotalAmount', '0.00');
        safeHideElement('promoDiscountRow');
        safeHideElement('pointsDeductedRow');
        return;
    }

    try {
        const requestBody = {
            CustomerID: currentCustomerID,
            TotalAmount: initialTotal,
            PromoCodes: codes
        };
        
        console.log('📤 Sending promo calculation request:', requestBody);
        
        const response = await fetch(CALCULATE_PROMO_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        const result = await response.json();
        console.log('📥 Promo Calculation Result:', result);
        console.log('📊 Response Status:', response.status);
        
        if (response.status === 200) {
            const { TotalDiscount, FinalPayable, PointsDeducted, FreeItems } = result;
            
            // Update global state
            finalPayableAmount = FinalPayable || initialTotal;

            // Update UI - Discount
            safeShowElement('promoDiscountRow');
            safeUpdateText('promoDiscountValue', `- ฿${(TotalDiscount || 0).toFixed(2)}`);
            safeUpdateText('finalTotalAmount', finalPayableAmount.toFixed(2));
            
            // Update UI - Points
            if (PointsDeducted && PointsDeducted > 0) {
                safeUpdateText('pointsDeductedValue', PointsDeducted.toString());
                safeShowElement('pointsDeductedRow');
            } else {
                safeHideElement('pointsDeductedRow');
            }
            
            console.log('✅ Promotions applied successfully');
            console.log('💵 Total Discount:', TotalDiscount);
            console.log('💰 Final Payable:', finalPayableAmount);

        } else {
            console.error('❌ Promo calculation failed:', result);
            console.error('❌ Error details:', result.error);
            
            // Show error message to user
            alert(`⚠️ ไม่สามารถคำนวณโปรโมชั่นได้\n\nError: ${result.error || 'Unknown Error'}\n\nกรุณาลองใหม่อีกครั้งหรือติดต่อฝ่ายไอที`);
            
            finalPayableAmount = initialTotal;
            safeUpdateText('finalTotalAmount', initialTotal.toFixed(2));
        }

    } catch (error) {
        console.error('❌ Promotion Calculation Error:', error);
        alert('❌ เกิดข้อผิดพลาดในการคำนวณส่วนลด\nกรุณาลองใหม่อีกครั้ง');
        finalPayableAmount = initialTotal;
        safeUpdateText('finalTotalAmount', initialTotal.toFixed(2));
    }
}

// ------------------------------------------------------------------
// D. Step 4 & 5: Payment Selection and Confirmation
// ------------------------------------------------------------------

function selectPayment(buttonElement, method) {
    selectedPaymentMethod = method;
    console.log("Payment Selected:", method);

    // ลบ class 'active' ออกจากทุกปุ่ม
    document.querySelectorAll('.payment-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // เพิ่ม class 'active' ให้ปุ่มที่ถูกกด (เพื่อให้ CSS ทำงาน)
    buttonElement.classList.add('active');
}

async function confirmPayment() {
    console.log('🔒 Confirming payment...');
    
    // 1. Validation
    if (!currentCustomerID) {
        alert('❌ กรุณาค้นหาลูกค้าก่อน');
        return;
    }
    
    if (finalPayableAmount === 0 || isNaN(finalPayableAmount)) {
        alert('❌ ยอดชำระไม่ถูกต้อง (0.00 บาท)');
        return;
    }
    
    // 2. Prepare Request
    const button = document.getElementById('confirmPaymentButton');
    if (button) {
        button.disabled = true;
        button.textContent = 'กำลังดำเนินการ...';
    }
    
    const paymentData = {
        CustomerID: currentCustomerID,
        PaymentType: selectedPaymentMethod,
        TotalAmount: finalPayableAmount,
        PromoCodes: selectedPromoCodes
    };
    
    console.log('📤 Sending checkout request:', paymentData);

    // 3. Call Checkout API
    try {
        const response = await fetch(CHECKOUT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paymentData)
        });

        const result = await response.json();
        console.log('📥 Checkout Response:', result);

        if (response.status === 200) {
            alert(`✅ ชำระเงินสำเร็จ! Sale ID: ${result.SaleID || 'N/A'}`);
            
            // Clear localStorage and reload
            localStorage.removeItem('CurrentCheckoutCustomerID');
            localStorage.removeItem('CurrentCheckoutUsername');
            localStorage.removeItem('CurrentCheckoutPoints');
            
            window.location.reload();

        } else {
            alert(`❌ ชำระเงินไม่สำเร็จ: ${result.error || 'Unknown Error'}`);
        }

    } catch (error) {
        console.error('❌ Checkout API Error:', error);
        alert('❌ ไม่สามารถติดต่อ API Checkout ได้');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = 'ยืนยันการชำระเงิน';
        }
    }
}

// ------------------------------------------------------------------
// E. Utility Functions (Safe DOM Operations)
// ------------------------------------------------------------------

function safeUpdateText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    } else {
        console.warn(`⚠️ Element not found: ${elementId}`);
    }
}

function safeShowElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'block';
    }
}

function safeHideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'none';
    }
}

function goToRewards() {
    window.location.href = 'reward.html';
}

function updatePromoButtonUI() {
    const btn = document.getElementById('btn-select-promo');
    
    if (selectedPromos.length === 0) {
        // กรณีไม่เลือก: กลับไปเป็นข้อความเดิม
        btn.textContent = 'เลือกโปรโมชั่น (0 รายการ)';
        btn.classList.remove('has-promo');
    } else {
        // กรณีเลือก: โชว์ชื่อโค้ดที่เลือก
        const codeList = selectedPromos.join(', '); // เอาชื่อมาต่อกันด้วยลูกน้ำ
        btn.innerHTML = `✅ ใช้โปรโมชั่น: <b>${codeList}</b>`;
        btn.classList.add('has-promo');
    }
}

function fetchCustomerPoints() {
    // 1. อ้างอิง Element ที่จะแสดงผล
    const customerDisplayElement = document.getElementById('customer-data-text');

    // 2. ดึงข้อมูลจาก LocalStorage (ตาม Key ที่คุณบอกมา)
    const username = localStorage.getItem('CurrentCheckoutUsername');
    const points = localStorage.getItem('CurrentCheckoutPoints');

    // 3. ตรวจสอบว่ามีข้อมูลไหม
    if (username) {
        if (customerDisplayElement) {
            // แสดงผล: ลูกค้า: ชื่อ (💎 XX แต้ม)
            // ใช้ HTML innerHTML เพื่อใส่สีหรือไอคอนได้
            customerDisplayElement.innerHTML = `ลูกค้า: ${username} <span style="color: #00A8A8; margin-left: 10px; font-size: 0.9em;">(💎 ${points || 0} แต้ม)</span>`;
        }
    } else {
        // กรณีไม่พบข้อมูล (เผื่อไว้)
        console.warn("ไม่พบข้อมูลลูกค้าใน LocalStorage");
        if (customerDisplayElement) {
            customerDisplayElement.innerHTML = `ลูกค้า: <span style="color: #aaa;">(ไม่ระบุตัวตน)</span>`;
        }
    }
}

window.confirmPayment = confirmPayment;