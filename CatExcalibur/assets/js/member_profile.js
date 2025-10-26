// member_profile.js

document.addEventListener('DOMContentLoaded', function() {
    loadProfileData();
});

function loadProfileData() {
    // 1. ดึงข้อมูลจาก localStorage
    const customerID = localStorage.getItem('CustomerID');
    const username = localStorage.getItem('Username');
    const points = localStorage.getItem('Points');

    // 2. Element สำหรับแสดงผล
    const customerIDEl = document.getElementById('profileCustomerID');
    const usernameEl = document.getElementById('profileUsername');
    const pointsEl = document.getElementById('profilePoints');
    
    // 3. ตรวจสอบว่าผู้ใช้ล็อกอินหรือไม่
    if (!customerID || !username) {
        if (usernameEl) usernameEl.textContent = 'Guest User';
        if (customerIDEl) customerIDEl.textContent = 'Not Logged In';
        if (pointsEl) pointsEl.textContent = '0';
        return;
    }

    // 4. แสดงผลข้อมูล
    if (usernameEl) {
        usernameEl.textContent = username;
    }
    
    if (customerIDEl) {
        customerIDEl.textContent = customerID;
    }
    
    if (pointsEl) {
        // แสดง Points เป็นตัวเลขที่อ่านง่าย
        const formattedPoints = points ? parseInt(points).toLocaleString() : '0';
        pointsEl.textContent = formattedPoints;
    }
}

// 5. ฟังก์ชันสำหรับ Log Out (เรียกเมื่อคลิกปุ่ม)
function logoutUser() {
    // ลบข้อมูลที่เกี่ยวข้องกับการล็อกอินทั้งหมด
    localStorage.removeItem('CustomerID');
    localStorage.removeItem('Username');
    localStorage.removeItem('Points');
    
    // ลบข้อมูลอื่นๆ ที่อาจเกี่ยวข้องกับการทำงานชั่วคราว
    localStorage.removeItem('CurrentReservationID');
    
    alert('คุณได้ออกจากระบบแล้ว');
    window.location.href = 'login.html'; // เปลี่ยนเส้นทางกลับไปหน้า Login
}

// ทำให้ฟังก์ชัน logoutUser ใช้งานได้จาก HTML
window.logoutUser = logoutUser;