const API_BASE_URL = 'https://ok4fdavpg8.execute-api.us-east-1.amazonaws.com'; 
const SALES_HISTORY_URL = `${API_BASE_URL}/sales`;

let allSalesData = [];
let currentPage = 1;
const itemsPerPage = 10;

function formatDate(isoString) {
    if (!isoString) return '';
    try {
        const dateObj = new Date(isoString);
        const day = String(dateObj.getDate()).padStart(2, '0');
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const year = dateObj.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) {
        return isoString.substring(0, 10);
    }
}

function showSaleDetail(saleId, totalAmount, paymentType) {
    alert(`รายละเอียดการขาย:\nSale ID: ${saleId}\nยอดรวม: ฿${totalAmount}\nวิธีชำระเงิน: ${paymentType}`);
}

// 💡 NEW: ฟังก์ชันสร้างปุ่มตัวเลขหน้า
function renderPageButtons() {
    const container = document.getElementById('pageNumbersContainer');
    if (!container) return;

    const totalPages = Math.ceil(allSalesData.length / itemsPerPage);
    container.innerHTML = ''; // Clear existing buttons
    
    if (totalPages <= 1) return;

    // Logic สำหรับแสดงปุ่มตามรูปแบบ: 1, 2, 3, ..., N
    const maxButtonsToShow = 5; // รวม ...
    let startPage = 1;
    let endPage = totalPages;

    if (totalPages > maxButtonsToShow) {
        // หากหน้าปัจจุบันอยู่ใกล้จุดเริ่มต้น
        if (currentPage <= 3) {
            endPage = maxButtonsToShow - 2; // 1, 2, 3, ...
        } 
        // หากหน้าปัจจุบันอยู่ใกล้จุดสิ้นสุด
        else if (currentPage > totalPages - 3) {
            startPage = totalPages - 3; // ..., N-2, N-1, N
            endPage = totalPages;
        } 
        // หากหน้าปัจจุบันอยู่ตรงกลาง
        else {
            startPage = currentPage - 1;
            endPage = currentPage + 1; // ..., N-1, N, N+1, ...
        }
    }
    
    // 1. ปุ่มหมายเลขหน้า
    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = `page-number-btn ${i === currentPage ? 'active' : ''}`;
        btn.onclick = () => displaySalesPage(i);
        container.appendChild(btn);
    }
    
    // 2. ปุ่ม "..." (ถ้ามี)
    if (totalPages > maxButtonsToShow) {
        // ... หลังปุ่มที่ 3
        if (currentPage <= totalPages - 3 && endPage < totalPages) {
            const dots = document.createElement('span');
            dots.textContent = '...';
            dots.style.margin = '0 5px';
            container.appendChild(dots);
        }
        
        // ปุ่มหน้าสุดท้าย (ถ้ายังไม่แสดง)
        if (endPage < totalPages) {
            const lastPageBtn = document.createElement('button');
            lastPageBtn.textContent = totalPages;
            lastPageBtn.className = `page-number-btn ${totalPages === currentPage ? 'active' : ''}`;
            lastPageBtn.onclick = () => displaySalesPage(totalPages);
            container.appendChild(lastPageBtn);
        }
    }
}

// ฟังก์ชันแสดงข้อมูลในหน้าปัจจุบัน
function displaySalesPage(page) {
    const tableBody = document.getElementById('salesTableBody');
    const prevButton = document.getElementById('prevPageBtn');
    const nextButton = document.getElementById('nextPageBtn');
    
    if (!tableBody) return;

    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const itemsOnPage = allSalesData.slice(startIndex, endIndex);

    let historyHTML = '';
    const totalPages = Math.ceil(allSalesData.length / itemsPerPage);
    
    if (itemsOnPage.length === 0) {
        historyHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">ไม่พบประวัติการขายในหน้านี้</td></tr>';
    } else {
        itemsOnPage.forEach(sale => {
            const formattedDate = formatDate(sale.Date);
            
            historyHTML += `
                <tr onclick="showSaleDetail('${sale.SaleID}', '${sale.TotalAmount}', '${sale.PaymentType}')">
                    <td>${formattedDate}</td>
                    <td>${sale.ItemCount} items</td>
                    <td>${sale.CustomerCount}</td>
                    <td>${sale.PaymentType}</td>
                    <td>฿${sale.TotalAmount.toFixed(2)}</td>
                </tr>
            `;
        });
    }

    tableBody.innerHTML = historyHTML;
    currentPage = page;

    // จัดการสถานะปุ่ม Navigation
    if (prevButton) prevButton.disabled = currentPage === 1;
    if (nextButton) nextButton.disabled = currentPage === totalPages || totalPages === 0;
    
    // 💡 NEW: อัปเดตปุ่มตัวเลขหน้าทุกครั้งที่เปลี่ยนหน้า
    renderPageButtons(); 
}

// ฟังก์ชันสำหรับเปลี่ยนหน้า
function changePage(direction) {
    const totalPages = Math.ceil(allSalesData.length / itemsPerPage);
    let newPage = currentPage + direction;

    if (newPage >= 1 && newPage <= totalPages) {
        displaySalesPage(newPage);
    }
}

// ฟังก์ชันหลักในการโหลดประวัติการขาย (ดึงข้อมูลทั้งหมด)
async function loadSalesHistory() {
    const tableBody = document.getElementById('salesTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">กำลังโหลดประวัติการขาย...</td></tr>';

    try {
        const response = await fetch(SALES_HISTORY_URL, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const salesData = await response.json();
        
        if (response.ok && Array.isArray(salesData)) {
            salesData.sort((a, b) => new Date(b.Date) - new Date(a.Date));
            
            allSalesData = salesData;
            
            if (allSalesData.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">ไม่พบประวัติการขาย</td></tr>';
                return;
            }
            
            displaySalesPage(1); 

        } else {
            throw new Error(salesData.error || 'ไม่สามารถดึงข้อมูลประวัติการขายได้');
        }

    } catch (error) {
        console.error('Error loading sales history:', error);
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red; padding: 20px;">ข้อผิดพลาด: ${error.message}</td></tr>`;
    }
}

window.changePage = changePage;
window.showSaleDetail = showSaleDetail;
document.addEventListener('DOMContentLoaded', loadSalesHistory);