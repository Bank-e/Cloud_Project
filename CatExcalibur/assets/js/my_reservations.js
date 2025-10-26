const API_BASE_URL = 'https://ok4fdavpg8.execute-api.us-east-1.amazonaws.com';
const RESERVATIONS_URL = `${API_BASE_URL}/my-reservations`;

let allReservationsData = [];
let currentPage = 1;
const itemsPerPage = 10;

// ฟังก์ชันสำหรับจัดรูปแบบวันที่จาก YYYY-MM-DD เป็น DD/MM/YYYY
function formatDate(isoDate) {
    if (!isoDate) return 'N/A';
    const parts = isoDate.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDate.substring(0, 10);
}

// ฟังก์ชันสำหรับกำหนด Class CSS ตามสถานะ
function getStatusClass(status) {
    if (!status) return 'status-waiting';
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'confirmed' || lowerStatus === 'confirm') return 'status-confirm';
    if (lowerStatus === 'cancelled' || lowerStatus === 'cancel') return 'status-cancel';
    if (lowerStatus === 'pending') return 'status-waiting';
    return 'status-waiting';
}

// ฟังก์ชันสำหรับการดูรายละเอียดการจอง
function viewReservationDetail(reservationId) {
    localStorage.setItem('CurrentReservationID', reservationId);
    window.location.href = 'booking_confirm.html';
}

// ----------------------------------------------------------------------
// # ส่วน Pagination
// ----------------------------------------------------------------------

function renderPageButtons() {
    const container = document.getElementById('pageNumbersContainer');
    if (!container) return;

    const totalPages = Math.ceil(allReservationsData.length / itemsPerPage);
    container.innerHTML = '';
    
    if (totalPages <= 1) return;

    const maxButtonsToShow = 5; 
    let startPage = 1;
    let endPage = totalPages;

    if (totalPages > maxButtonsToShow) {
        if (currentPage <= 3) {
            endPage = maxButtonsToShow - 2;
        } else if (currentPage > totalPages - 3) {
            startPage = totalPages - 3;
            endPage = totalPages;
        } else {
            startPage = currentPage - 1;
            endPage = currentPage + 1;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = `page-number-btn ${i === currentPage ? 'active' : ''}`;
        btn.onclick = () => displayReservationsPage(i);
        container.appendChild(btn);
    }
    
    if (totalPages > maxButtonsToShow) {
        if (currentPage <= totalPages - 3 && endPage < totalPages) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.margin = '0 5px';
            container.appendChild(dots);
        }
        
        if (endPage < totalPages) {
            const lastPageBtn = document.createElement('button');
            lastPageBtn.textContent = totalPages;
            lastPageBtn.className = `page-number-btn ${totalPages === currentPage ? 'active' : ''}`;
            lastPageBtn.onclick = () => displayReservationsPage(totalPages);
            container.appendChild(lastPageBtn);
        }
    }
}

function displayReservationsPage(page) {
    const tableBody = document.getElementById('reservationsTableBody');
    const prevButton = document.getElementById('prevPageBtn');
    const nextButton = document.getElementById('nextPageBtn');
    
    if (!tableBody) return;

    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const itemsOnPage = allReservationsData.slice(startIndex, endIndex);

    let html = '';
    const totalPages = Math.ceil(allReservationsData.length / itemsPerPage);
    
    if (itemsOnPage.length === 0) {
        html = '<tr><td colspan="4" style="text-align: center; padding: 20px;">ไม่พบประวัติการจองในหน้านี้</td></tr>';
    } else {
        itemsOnPage.forEach(res => {
            const formattedDate = formatDate(res.Date);
            const statusClass = getStatusClass(res.Status);
            
            const reservationId = res.ReservationID || 'N/A'; 
            
            html += `
                <tr onclick="viewReservationDetail('${reservationId}')" style="cursor: pointer;">
                    <td>${formattedDate}</td>
                    <td>${res.Time}</td>
                    <td>${res.NumberOfGuests}</td>
                    <td><span class="status-badge ${statusClass}">${res.Status}</span></td>
                </tr>
            `;
        });
    }

    tableBody.innerHTML = html;
    currentPage = page;

    if (prevButton) prevButton.disabled = currentPage === 1;
    if (nextButton) nextButton.disabled = currentPage === totalPages || totalPages === 0;
    
    renderPageButtons(); 
}

function changePage(direction) {
    const totalPages = Math.ceil(allReservationsData.length / itemsPerPage);
    let newPage = currentPage + direction;

    if (newPage >= 1 && newPage <= totalPages) {
        displayReservationsPage(newPage);
    }
}
window.changePage = changePage;

// ----------------------------------------------------------------------
// # ส่วนหลักในการโหลดข้อมูล
// ----------------------------------------------------------------------

async function loadReservations() {
    const tableBody = document.getElementById('reservationsTableBody');
    if (!tableBody) return;

    const customerId = localStorage.getItem('CustomerID');

    if (!customerId) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red; padding: 20px;">กรุณาเข้าสู่ระบบเพื่อดูประวัติการจอง</td></tr>';
        return;
    }
    
    tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">กำลังโหลดประวัติการจอง...</td></tr>';

    try {
        const apiUrl = `${RESERVATIONS_URL}?CustomerID=${customerId}`;
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const reservations = await response.json();
        
        if (response.ok && Array.isArray(reservations)) {
            // 💡 แก้ไขการเรียงลำดับ: วันที่เร็วที่สุดก่อน (น้อยไปมาก) + เวลาเร็วสุด
            reservations.sort((a, b) => {
                // รวมวันที่และเวลาเป็น DateTime Object เพื่อเปรียบเทียบ
                const dateTimeA = new Date(`${a.Date}T${a.Time}`);
                const dateTimeB = new Date(`${b.Date}T${b.Time}`);
                
                // 1. เปรียบเทียบวันที่: ให้วันที่เร็วกว่าอยู่ก่อน (น้อยไปมาก)
                // (ถ้า A < B ผลลัพธ์เป็นลบ)
                if (dateTimeA < dateTimeB) return -1; // A ก่อน B (เร็วที่สุดก่อน)
                if (dateTimeA > dateTimeB) return 1;  // B ก่อน A

                // 2. ถ้าวันที่เท่ากัน: เรียงตามเวลาจากน้อยไปมาก (เร็วที่สุดก่อน)
                return a.Time.localeCompare(b.Time);
            });
            
            allReservationsData = reservations;
            
            if (allReservationsData.length === 0) {
                 tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">ไม่พบประวัติการจอง</td></tr>';
                return;
            }
            
            displayReservationsPage(1);
        } else {
            const errorMsg = reservations.error || 'ไม่สามารถดึงข้อมูลประวัติการจองได้';
            throw new Error(errorMsg);
        }

    } catch (error) {
        console.error('Error loading reservations:', error);
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: red; padding: 20px;">ข้อผิดพลาด: ${error.message}</td></tr>`;
    }
}

window.viewReservationDetail = viewReservationDetail;
document.addEventListener('DOMContentLoaded', loadReservations);