const API_BASE_URL = 'https://wpvr9cxmmj.execute-api.us-east-1.amazonaws.com/Cat_Excalibur'; 
const RESERVATION_DETAILS_URL = `${API_BASE_URL}/reservation`; // GET /reservation/{reservationId}
const UPDATE_STATUS_URL = `${API_BASE_URL}/reservation-status`; // PUT /reservation-status

document.addEventListener('DOMContentLoaded', function() {
    const customerID = localStorage.getItem('CustomerID');
    const reservationID = localStorage.getItem('CurrentReservationID');
    
    // 2. Element สำหรับแสดงผล
    const loadingMessage = document.getElementById('loadingMessage');
    const detailsContainer = document.getElementById('reservationDetails');

    // 1. ตรวจสอบ CustomerID ตั้งแต่เริ่มต้น (ป้องกัน ValidationException)
    if (!customerID) {
        if(loadingMessage) loadingMessage.textContent = 'ข้อมูลลูกค้าไม่สมบูรณ์ กรุณาล็อกอินอีกครั้ง';
        alert('กรุณาล็อกอินใหม่เพื่อดำเนินการต่อ');
        window.location.href = 'login.html'; // ส่งกลับไปหน้า Login
        return;
    }
    
    if (!reservationID) {
        if(loadingMessage) loadingMessage.textContent = 'ไม่พบหมายเลขการจอง กรุณาทำการจองใหม่';
        return;
    }
    
    // ตั้งค่าเริ่มต้นและแสดง ID ที่ได้จาก LocalStorage
    if (document.getElementById('displayReservationId')) {
        document.getElementById('displayReservationId').textContent = reservationID;
    }
    if (loadingMessage) loadingMessage.style.display = 'block';
    if (detailsContainer) detailsContainer.style.display = 'block';


    // โหลดรายละเอียดการจอง
    fetchReservationDetails(reservationID, customerID);
});

// ฟังก์ชันสำหรับแสดงข้อมูลลงใน Element (รวมถึงการอัปเดตสถานะ UI)
function displayReservationData(reservation) {
    document.getElementById('displayDate').textContent = reservation.Date ? reservation.Date.split('-').reverse().join(' / ') : 'N/A';
    document.getElementById('displayTime').textContent = reservation.Time || 'N/A';
    document.getElementById('displayGuests').textContent = (reservation.NumberOfGuests || '0') + ' ที่นั่ง';
    
    const statusEl = document.getElementById('displayStatus');
    const statusText = reservation.Status || 'Confirm'; 
    statusEl.textContent = statusText;
    
    statusEl.className = 'status-badge';
    if (statusText === 'Confirm') {
        statusEl.classList.add('status-confirm');
    } else if (statusText === 'Pending') {
        statusEl.classList.add('status-waiting');
    } else if (statusText === 'Cancel') {
        statusEl.classList.add('status-cancel');
    } else {
        statusEl.classList.add('status-waiting');
    }
    
    // อัปเดต UI ตามสถานะ (ปุ่ม)
    updateUIBasedOnStatus(statusText);
}

function updateUIBasedOnStatus(status) {
    const proceedButton = document.getElementById('proceedButton');
    const cancelButton = document.getElementById('cancelButton');
    const cancellationMessage = document.getElementById('cancellationMessage');
    
    if (status === 'Cancel') {
        if(proceedButton) proceedButton.disabled = true;
        if(cancelButton) cancelButton.style.display = 'none';
        if(cancellationMessage) cancellationMessage.style.display = 'block';
    } else {
        if(proceedButton) proceedButton.disabled = false;
        if(cancelButton) cancelButton.style.display = 'block';
        if(cancellationMessage) cancellationMessage.style.display = 'none';
    }
}


// ฟังก์ชันสำหรับดึงรายละเอียดการจอง
async function fetchReservationDetails(reservationID, customerID) {
    const loadingMessage = document.getElementById('loadingMessage');
    const detailsDiv = document.getElementById('reservationDetails');
    
    try {
        // **FIX**: ส่ง CustomerID เป็น Query Parameter สำหรับ GetItem ใน Lambda
        const apiUrl = `${RESERVATION_DETAILS_URL}/${reservationID}?customerId=${customerID}`; 

        const response = await fetch(apiUrl, {
            method: 'GET',
        });

        const data = await response.json();

        if (!response.ok || !data.NumberOfGuests) {
            throw new Error(data.error || 'ไม่พบรายละเอียดการจองสำหรับผู้ใช้นี้');
        }

        if (loadingMessage) loadingMessage.style.display = 'none';
        if (detailsDiv) detailsDiv.style.display = 'block';

        displayReservationData(data);

    } catch (error) {
        console.error('Error fetching reservation details:', error);
        if (loadingMessage) loadingMessage.textContent = 'เกิดข้อผิดพลาดในการโหลดรายละเอียดการจอง: ' + error.message;
        if (detailsDiv) detailsDiv.style.display = 'none';
    }
}


// ------------------------------------------
// ฟังก์ชันยกเลิกการจอง (เรียก API PUT /reservation-status)
// ------------------------------------------
async function cancelReservation() {
    const reservationID = localStorage.getItem('CurrentReservationID');
    const customerID = localStorage.getItem('CustomerID'); 

    console.log(reservationID)
    console.log(customerID)

    if (!confirm('คุณแน่ใจหรือไม่ที่จะยกเลิกการจองนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้')) {
        return;
    }

    // การตรวจสอบ: หากถึงขั้นตอนนี้แต่ข้อมูลหายไปอีก ให้แจ้งเตือนและหยุด
    if (!customerID || !reservationID) {
        alert('ข้อผิดพลาด: ข้อมูลลูกค้าหรือการจองขาดหายไป');
        return;
    }

    const cancelButton = document.getElementById('cancelButton');
    const originalText = cancelButton ? cancelButton.textContent : 'ยกเลิกการจอง';
    if(cancelButton) {
        cancelButton.textContent = 'กำลังยกเลิก...';
        cancelButton.disabled = true;
    }

    try {
        const response = await fetch(UPDATE_STATUS_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ReservationID: reservationID,
                CustomerID: customerID, // ส่ง CustomerID เพื่อเป็น Sort Key
                Status: 'Cancel' 
            })
        });

        const result = await response.json();
        
        if (response.ok) {
            alert(`ยกเลิกการจองหมายเลข ${reservationID} สำเร็จ!`);
            updateUIBasedOnStatus('Cancel');
            fetchReservationDetails(reservationID, customerID)

        } else {
            console.error('API Error:', result.error);
            alert('เกิดข้อผิดพลาดในการยกเลิกการจอง: ' + (result.error || 'Server error'));
        }

    } catch (error) {
        console.error('Fetch Error:', error);
        alert('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์เพื่อยกเลิกการจองได้');
    } finally {
        if(cancelButton) {
            // คืนค่าปุ่มหากยังไม่ถูกตั้งค่าเป็น Cancel
            if (document.getElementById('displayStatus').textContent !== 'Cancel') {
                cancelButton.textContent = originalText;
                cancelButton.disabled = false;
            }
        }
    }
}


// ------------------------------------------
// ฟังก์ชันยืนยันและไปหน้าสั่งซื้อ
// ------------------------------------------
function proceedToOrdering() {
    alert('เข้าสู่หน้ารายการสั่งซื้อ');
    window.location.href = 'pos.html';
}

// กำหนดให้ฟังก์ชันถูกเรียกใช้จาก HTML
window.cancelReservation = cancelReservation;
window.proceedToOrdering = proceedToOrdering;