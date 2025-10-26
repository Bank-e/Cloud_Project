// checkout.js
const API_BASE_URL = 'https://ok4fdavpg8.execute-api.us-east-1.amazonaws.com'; 

// ฟังก์ชันหลักในการดึงและแสดงข้อมูล
async function loadCheckoutData() {
    const customerId = localStorage.getItem('CustomerID');
    
    // อ้างอิงถึง element ด้วย ID
    const totalAmountSpan = document.getElementById('totalAmount');
    const itemDetailsContainer = document.getElementById('itemDetailsContainer');

    // ตั้งค่าแสดงผลเบื้องต้นขณะโหลด
    if (totalAmountSpan) totalAmountSpan.textContent = '...';
    if (itemDetailsContainer) itemDetailsContainer.innerHTML = '<div style="text-align: center; padding: 20px;">กำลังโหลดรายการสินค้า...</div>';

    if (!customerId) {
        if (itemDetailsContainer) itemDetailsContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: red;">ไม่พบข้อมูลลูกค้า กรุณาเข้าสู่ระบบ</div>';
        if (totalAmountSpan) totalAmountSpan.textContent = '0.00';
        return;
    }

    try {
        // ใช้ชื่อ API/Resource ที่คุณตั้งไว้ เช่น /get-grouped-orders
        const endpoint = `${API_BASE_URL}/order-details?CustomerID=${customerId}`;
        
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (response.ok && response.status === 200) {
            let grandTotal = 0;
            let htmlContent = '';
            
            // วนลูปสร้าง HTML สำหรับแสดงรายละเอียดสินค้า
            result.forEach(item => {
                const subTotalFormatted = item.SubTotal.toFixed(2);
                
                htmlContent += `
                    <div class="item-row">
                        <span>${item.QTY_Product} ${item.ProductName}</span>
                        <span>฿${subTotalFormatted}</span>
                    </div>
                `;

                grandTotal += item.SubTotal;
            });
            
            // อัปเดต Total และรายการสินค้า
            if (totalAmountSpan) totalAmountSpan.textContent = grandTotal.toFixed(2);
            if (itemDetailsContainer) itemDetailsContainer.innerHTML = htmlContent;

            if (result.length === 0 && itemDetailsContainer) {
                 itemDetailsContainer.innerHTML = '<div style="text-align: center; padding: 20px;">ไม่พบรายการสินค้าที่ถูกสั่งซื้อ</div>';
            }
            
        } else {
            throw new Error(result.error || 'ไม่สามารถดึงข้อมูลรายการสินค้าได้');
        }

    } catch (error) {
        console.error('Error loading checkout data:', error);
        if (totalAmountSpan) totalAmountSpan.textContent = 'Error';
        if (itemDetailsContainer) itemDetailsContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: red;">ข้อผิดพลาด: ${error.message}</div>`;
    }
}

// รอให้ DOM โหลดเสร็จแล้วจึงเรียกฟังก์ชันหลัก
document.addEventListener('DOMContentLoaded', loadCheckoutData);

// ฟังก์ชันสำหรับเลือกวิธีการชำระเงินและยืนยันการชำระเงิน
let selectedPayment = '';

function selectPayment(method) {
    selectedPayment = method;
    // Highlight selected payment
    const buttons = document.querySelectorAll('.payment-btn');
    buttons.forEach(btn => {
        if (btn.textContent === method) {
            btn.style.background = '#26c6da';
            btn.style.color = 'white';
        } else {
            btn.style.background = 'white';
            btn.style.color = '#26c6da';
        }
    });
}


// ** ฟังก์ชันหลักในการยืนยันการชำระเงินและเรียก API **
async function confirmPayment() {
    const confirmButton = document.getElementById('confirmPaymentButton');
    if (!confirmButton) return;
    
    // 1. ตรวจสอบการเลือกวิธีการชำระเงิน
    if (!selectedPayment) {
        alert('กรุณาเลือกวิธีการชำระเงิน');
        return;
    }

    // 2. ดึงข้อมูลที่จำเป็นจาก DOM และ LocalStorage
    const customerId = localStorage.getItem('CustomerID');
    const totalAmountSpan = document.getElementById('totalAmount');
    
    if (!customerId || !totalAmountSpan) {
        alert('ข้อมูลลูกค้าหรือยอดรวมไม่สมบูรณ์ กรุณาเข้าสู่ระบบอีกครั้ง');
        return;
    }
    
    // TotalAmount ต้องถูกแปลงเป็นตัวเลขเพื่อส่งให้ Lambda
    const totalAmount = parseFloat(totalAmountSpan.textContent);
    
    if (isNaN(totalAmount) || totalAmount <= 0) {
        alert('ยอดรวมไม่ถูกต้อง ไม่สามารถดำเนินการต่อได้');
        return;
    }

    // 3. เตรียมข้อมูลสำหรับ API
    const paymentData = {
        CustomerID: customerId,
        PaymentType: selectedPayment,
        TotalAmount: totalAmount // ส่งเป็นตัวเลข (JavaScript จะแปลงเป็น JSON)
    };

    // 4. แสดงสถานะกำลังโหลด
    const originalButtonText = confirmButton.textContent;
    confirmButton.disabled = true;
    confirmButton.textContent = 'กำลังยืนยันการชำระเงิน...';

    try {
        // *** IMPORTANT: ต้องระบุ Endpoint ที่ถูกต้องสำหรับ Lambda Function นี้ เช่น /checkout ***
        const response = await fetch(`${API_BASE_URL}/checkout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(paymentData)
        });

        const result = await response.json();

        if (response.ok && response.status === 200) {
            // 5. ชำระเงินสำเร็จ
            alert('ชำระเงินสำเร็จแล้ว! (SaleID: ' + result.SaleID + ')');
            
            // ลบ CustomerID ออกจากการจองใน LocalStorage เพื่อเริ่มการสั่งซื้อใหม่
            localStorage.removeItem('CustomerID'); 
            
            // เปลี่ยนเส้นทางไปยังหน้า Sales History
            window.location.href = 'sales_history.html';

        } else {
            // 6. ข้อผิดพลาดจาก API
            throw new Error(result.error || 'การชำระเงินล้มเหลว');
        }

    } catch (error) {
        console.error('Error confirming payment:', error);
        alert('เกิดข้อผิดพลาดในการยืนยัน: ' + error.message);
        
    } finally {
        // 7. คืนสถานะปุ่ม
        confirmButton.disabled = false;
        confirmButton.textContent = originalButtonText;
    }
}