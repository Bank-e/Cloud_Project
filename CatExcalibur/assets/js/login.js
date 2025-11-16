// login.js

const API_BASE_URL = 'https://ok4fdavpg8.execute-api.us-east-1.amazonaws.com';
const LOGIN_URL = `${API_BASE_URL}/login`; 

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    
    // -------------------------------------------------------------------
    // ** 1. ฟังก์ชันสำหรับ Show/Hide Password (ใช้ Font Awesome) **
    // -------------------------------------------------------------------
    const passwordInput = document.getElementById('Password');
    const toggleButton = document.getElementById('togglePassword');
    const toggleIcon = document.getElementById('toggleIcon'); // อ้างอิงถึงแท็ก <i>

    localStorage.clear();

    if (toggleButton && passwordInput && toggleIcon) {
        // เพิ่ม Event Listener สำหรับการคลิกสลับที่ปุ่ม (span)
        toggleButton.addEventListener('click', function (e) {
            
            const currentType = passwordInput.getAttribute('type');
            
            if (currentType === 'password') {
                // เปลี่ยนเป็น Text (แสดงรหัสผ่าน)
                passwordInput.setAttribute('type', 'text');
                // เปลี่ยนไอคอน: จากตาปกติ (ซ่อน) ไปเป็นตามีขีดฆ่า (แสดง)
                toggleIcon.classList.remove('fa-regular', 'fa-eye');
                toggleIcon.classList.add('fa-solid', 'fa-eye-slash');
            } else {
                // เปลี่ยนกลับเป็น Password (ซ่อนรหัสผ่าน)
                passwordInput.setAttribute('type', 'password');
                // เปลี่ยนไอคอน: จากตามีขีดฆ่า (แสดง) ไปเป็นตาปกติ (ซ่อน)
                toggleIcon.classList.remove('fa-solid', 'fa-eye-slash');
                toggleIcon.classList.add('fa-regular', 'fa-eye');
            }
        });
    }
    // -------------------------------------------------------------------

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            // ... (โค้ดดึง Username, Password และปุ่ม submit) ...
            const usernameInput = document.getElementById('Username');
            const passwordInput = document.getElementById('Password');
            const submitButton = document.getElementById('btn-submit');

            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();
            
            // Validation
            if (!username || !password) {
                alert('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
                return;
            }

            // Disable button and show loading
            const originalButtonText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.textContent = 'กำลังเข้าสู่ระบบ...';

            const loginData = {
                username: username,
                password: password
            };

            try {
                const response = await fetch(LOGIN_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(loginData)
                });

                const result = await response.json();

                if (response.ok && response.status === 200) {
                    const { CustomerID, Username, Points, Tokens, UserRole } = result;

                    // ⭐️ ข้อมูลลูกค้า (จาก DynamoDB)
                    localStorage.setItem('CustomerID', CustomerID);
                    localStorage.setItem('Username', Username);
                    localStorage.setItem('Points', Points);

                    // 🛡️ ข้อมูลสิทธิ์ (จาก Cognito)
                    localStorage.setItem('AccessToken', Tokens.AccessToken); 
                    localStorage.setItem('IdToken', Tokens.IdToken); // เก็บ IdToken เผื่อใช้
                    localStorage.setItem('UserRole', UserRole); // <<--- เก็บ Role ที่ดึงมา

                    console.log(Tokens.AccessToken)
                    console.log(Tokens.IdToken)
                    console.log(UserRole)

                    alert('เข้าสู่ระบบสำเร็จ!');
                    window.location.href = 'member_profile.html';

                } else if (response.status === 401) {
                    alert(result.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
                    
                } else {
                    alert(result.error || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
                }

            } catch (error) {
                console.error('Error during login:', error);
                alert('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
                
            } finally {
                // Re-enable button
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        });
    }
});