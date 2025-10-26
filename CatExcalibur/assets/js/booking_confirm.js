const API_BASE_URL = 'https://ok4fdavpg8.execute-api.us-east-1.amazonaws.com'; 
const RESERVATION_DETAILS_URL = `${API_BASE_URL}/reservation`; // GET /reservation/{reservationId}

document.addEventListener('DOMContentLoaded', () => {
    // 1. ดึง ReservationID จาก Local Storage
    const reservationId = localStorage.getItem('CurrentReservationID');

    // 2. Element สำหรับแสดงผล
    const idEl = document.getElementById('displayReservationId');
    const dateEl = document.getElementById('displayDate');
    const timeEl = document.getElementById('displayTime');
    const guestsEl = document.getElementById('displayGuests');
    const statusEl = document.getElementById('displayStatus');
    const loadingMessage = document.getElementById('loadingMessage'); 
    const detailsContainer = document.getElementById('reservationDetails');

    const displayError = (message) => {
        if (loadingMessage) {
            loadingMessage.textContent = message;
            loadingMessage.style.color = 'red';
        }
        if (detailsContainer) detailsContainer.style.display = 'none';
        console.error(message);
    };

    if (!reservationId) {
        displayError('❌ ไม่พบหมายเลขการจอง กรุณากลับไปที่หน้าจองหรือหน้าประวัติการจอง');
        return;
    }

    // ตั้งค่าเริ่มต้นและแสดง ID ที่ได้จาก LocalStorage
    if (idEl) idEl.textContent = reservationId;
    if (loadingMessage) loadingMessage.style.display = 'block';
    if (detailsContainer) detailsContainer.style.display = 'block';


    // 3. เรียก API เพื่อดึงรายละเอียดการจอง
    async function fetchReservationDetails() {
        try {
            // API เป็น GET /reservation/{reservationId}
            const apiUrl = `${RESERVATION_DETAILS_URL}/${reservationId}`; 

            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();

            if (response.ok && response.status === 200) {
                // 4. แสดงผลข้อมูลที่ได้รับ
                
                // ข้อมูลจาก get_reservation_details.py: Date, Time, NumberOfGuests
                const { Date: resDate, Time: resTime, NumberOfGuests: resGuests } = result;
                
                // สำหรับ Status: เนื่องจาก get_reservation_details.py ไม่ได้คืนค่า Status
                // เราจะตั้งเป็น 'Confirm' ตาม logic ใน create_reservation.py
                const statusFromLambdaLogic = 'Confirm'; 
                
                // แปลง YYYY-MM-DD เป็น DD / MM / YYYY
                const formattedDate = resDate ? resDate.split('-').reverse().join(' / ') : 'N/A'; 

                if (dateEl) dateEl.textContent = formattedDate;
                if (timeEl) timeEl.textContent = resTime;
                if (guestsEl) guestsEl.textContent = `${resGuests} ที่นั่ง`;
                
                if (statusEl) {
                    statusEl.textContent = statusFromLambdaLogic;
                    // ใช้คลาส CSS สำหรับสถานะ 'Confirm'
                    statusEl.className = `status-badge status-${statusFromLambdaLogic.toLowerCase()}`;
                }

                if (loadingMessage) loadingMessage.style.display = 'none'; // ซ่อนสถานะโหลด

            } else {
                // 5. ข้อผิดพลาดจาก API 
                const errorMessage = result.error || `ไม่สามารถดึงรายละเอียดการจอง (ID: ${reservationId}) ได้`;
                displayError(`❌ ข้อผิดพลาดในการดึงข้อมูล: ${errorMessage}`);
                localStorage.removeItem('CurrentReservationID'); // เคลียร์ ID ที่ไม่ถูกต้อง
            }

        } catch (error) {
            console.error('Error fetching reservation details:', error);
            displayError('⚠️ เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
        }
    }

    fetchReservationDetails();
});