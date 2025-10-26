// create_reservation.js

const API_BASE_URL = 'https://ok4fdavpg8.execute-api.us-east-1.amazonaws.com'; 
const RESERVATION_URL = `${API_BASE_URL}/reservation`;

document.addEventListener('DOMContentLoaded', () => {
    // ใช้ document.getElementById ในการเข้าถึงฟอร์ม
    const reservationForm = document.getElementById('reservationForm');
    
    // ใช้ querySelector ภายใน Form เพื่อหาปุ่ม
    const submitButton = reservationForm ? reservationForm.querySelector('button[type="submit"]') : null;

    if (!reservationForm) {
        console.error('Reservation form not found. (Must have id="reservationForm")');
        return;
    }

    // 💡 NEW: ตั้งค่า min attribute ให้กับ input type="date"
    // เพื่อป้องกันการเลือกวันในอดีตตั้งแต่เริ่มต้นในระดับ UI/Browser
    const dateInput = document.getElementById('reservationDate');
    if (dateInput) {
        // ใช้ Date Object เพื่อกำหนดวันที่ปัจจุบันในรูปแบบ YYYY-MM-DD
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0'); // เดือนเริ่มต้นที่ 0
        const dd = String(today.getDate()).padStart(2, '0');
        dateInput.min = `${yyyy}-${mm}-${dd}`;
    }


    reservationForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        // 1. ตรวจสอบ CustomerID จาก Local Storage
        const customerId = localStorage.getItem('CustomerID');
        if (!customerId) {
            alert('ไม่พบข้อมูลสมาชิก กรุณาเข้าสู่ระบบก่อนทำการจอง');
            window.location.href = 'login.html'; 
            return;
        }

        // 2. ดึงข้อมูลฟอร์มทั้งหมดด้วย document.getElementById()
        const timeInput = document.getElementById('reservationTime');
        const guestsInput = document.getElementById('numberOfGuests');
        
        if (!dateInput || !timeInput || !guestsInput) {
            alert('❌ ข้อผิดพลาด: ไม่พบ Element ข้อมูลการจองที่จำเป็น (ตรวจสอบ ID ในไฟล์ HTML)');
            return;
        }

        const dateValue = dateInput.value;
        const timeValue = timeInput.value;
        
        // 💡 NEW: การตรวจสอบวันและเวลาห้ามย้อนหลัง
        const now = new Date();
        // สร้าง Date Object สำหรับเวลาที่ผู้ใช้เลือก (ในรูปแบบ YYYY-MM-DDT10:00:00)
        // เพื่อให้สามารถเปรียบเทียบกับเวลาปัจจุบันได้
        const [hour, minute] = timeValue.split(':').map(Number);
        
        // เราใช้ Date Value (YYYY-MM-DD) ที่ได้จาก input type="date"
        const selectedDateTime = new Date(dateValue);
        selectedDateTime.setHours(hour, minute, 0, 0);
        
        // กำหนดวันที่ปัจจุบันให้มีแต่ วันที่ ชั่วโมง และนาที เพื่อเปรียบเทียบ
        const currentDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0, 0);

        if (selectedDateTime < currentDateTime) {
            alert('❌ การจองล้มเหลว: กรุณาเลือกวันและเวลาที่มากกว่าหรือเท่ากับเวลาปัจจุบัน');
            return; // หยุดการทำงานถ้าเวลาที่เลือกเป็นอดีต
        }


        const reservationData = {
            CustomerID: customerId,
            Date: dateValue, 
            Time: timeValue,
            NumberOfGuests: parseInt(guestsInput.value, 10) 
        };
        
        // 3. ปิดปุ่มและแสดงสถานะโหลด
        const originalButtonText = submitButton ? submitButton.textContent : 'Reservation';
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'กำลังดำเนินการจอง...';
        }

        try {
            // 4. เรียก API POST /reservation
            const response = await fetch(RESERVATION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(reservationData)
            });

            const result = await response.json();

            if (response.ok && response.status === 200) {
                // 5. การจองสำเร็จ
                const reservationId = result.ReservationID;
                alert(`✅ การจองสำเร็จ! หมายเลขการจอง: ${reservationId}`);
                
                // เก็บข้อมูลการจองไว้ใน Local Storage เพื่อใช้ในหน้ายืนยัน
                localStorage.setItem('CurrentReservationID', reservationId);
                localStorage.setItem('CurrentReservationDate', reservationData.Date);
                localStorage.setItem('CurrentReservationTime', reservationData.Time);
                localStorage.setItem('CurrentReservationGuests', reservationData.NumberOfGuests);

                //window.location.href = 'booking_confirm.html'; 
                window.location.href = 'booking_confirm.html'; 

            } else {
                // 6. ข้อผิดพลาดจาก API 
                const errorMessage = result.error || 'การจองล้มเหลว โปรดตรวจสอบ Server Log';
                alert(`❌ ข้อผิดพลาด: ${errorMessage}`);
            }

        } catch (error) {
            console.error('Error during POST /reservation API call:', error);
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์: ' + error.message);
            
        } finally {
            // 7. คืนสถานะปุ่ม
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        }
    });
});