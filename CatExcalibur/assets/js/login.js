// login.js

const API_BASE_URL = 'https://ok4fdavpg8.execute-api.us-east-1.amazonaws.com';
const LOGIN_URL = `${API_BASE_URL}/login`;

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

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
                    const { CustomerID, Username, Points } = result;

                    // Clear old data and store new data
                    localStorage.clear();
                    localStorage.setItem('CustomerID', CustomerID);
                    localStorage.setItem('Username', Username);
                    localStorage.setItem('Points', Points);

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