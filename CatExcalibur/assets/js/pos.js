// **การตั้งค่า API**
const API_BASE_URL = 'https://wpvr9cxmmj.execute-api.us-east-1.amazonaws.com/Cat_Excalibur'; // ต้องมี /prod/
const PRODUCTS_URL = `${API_BASE_URL}/products`;
const ORDERS_URL = `${API_BASE_URL}/orders`; // กำหนด Endpoint สำหรับ Orders

const IMAGE_BASE_URL = 'https://web-host-cat-excalibur.s3.us-east-1.amazonaws.com/CatExcalibur/assets/img';

// ตารางแมปชื่อ Category ที่มาจาก API (ภาษาไทย) ไปยัง ID ของ Products Grid ใน HTML
const CATEGORY_MAPPING = {
    'อาหาร': 'products-Food',
    'เครื่องดื่ม': 'products-Drink',
    'ของแมว': 'products-Cat Snack'
};

// ตะกร้าสินค้า
let cart = [];
// แคชข้อมูลสินค้าทั้งหมด
let allProducts = {};

// ----------------------------------------------------------------------
// # ส่วนที่ 1: การจัดการสินค้า (ดึง API และแสดงผล)
// ----------------------------------------------------------------------

// ฟังก์ชันสำหรับดึงและจัดเรียงสินค้าตามหมวดหมู่
async function fetchAndRenderProducts() {
    const loadingMessage = document.getElementById('loadingProducts');
    const errorMessage = document.getElementById('errorProducts');
    loadingMessage.style.display = 'block';
    errorMessage.style.display = 'none';

    // ล้างสินค้า Hardcoded/เก่าทั้งหมด (ยกเว้น coming-soon)
    document.querySelectorAll('.products-grid').forEach(grid => {
        const comingSoonHtml = grid.querySelector('.coming-soon') ? grid.querySelector('.coming-soon').outerHTML : '';
        grid.innerHTML = comingSoonHtml;
    });

    try {
        const response = await fetch(PRODUCTS_URL);

        if (!response.ok) {
            console.log("HTTP Status:", response.status);
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const products = await response.json();

        if (products.length === 0) {
            errorMessage.textContent = 'ไม่พบรายการสินค้าจากระบบ';
            errorMessage.style.display = 'block';
            return;
        }

        // 1. จัดกลุ่มและแคชสินค้า
        products.forEach(product => {
            allProducts[product.ProductID] = product;

            const containerId = CATEGORY_MAPPING[product.Category];
            const container = document.getElementById(containerId);

            if (container) {
                const card = createProductCard(product);

                // แทรก Card ก่อน 'coming-soon' card ถ้ามี
                const comingSoon = container.querySelector('.coming-soon');
                if (comingSoon) {
                    container.insertBefore(card, comingSoon);
                } else {
                    container.appendChild(card);
                }
            } else {
                console.warn(`ไม่พบ Container สำหรับ Category: ${product.Category} (ตรวจสอบ Category Name ใน DB และ HTML ID ว่าตรงกับ CATEGORY_MAPPING หรือไม่)`);
            }
        });

    } catch (error) {
        console.error('Error fetching and rendering products:', error);
        errorMessage.textContent = `เกิดข้อผิดพลาดในการดึงข้อมูล: ${error.message}`;
        errorMessage.style.display = 'block';
    } finally {
        loadingMessage.style.display = 'none';
    }
}

// ฟังก์ชันสร้าง Product Card HTML Element
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';

    card.setAttribute('onclick', `addToCart('${product.ProductID}', '${product.ProductName.replace(/'/g, "\\'")}', ${product.ProductPrice})`);

    const imageUrl = `${IMAGE_BASE_URL}/${product.Picture_Name}`;

    card.innerHTML = `
        <img src="${imageUrl}" class="product-image" alt="${product.ProductName}" onerror="this.onerror=null;this.src='https://via.placeholder.com/80/D3D3D3/000000?text=No+Image';">
        <div class="product-name">${product.ProductName}</div>
        <div class="product-price">${product.ProductPrice.toFixed(2)}฿</div>
        <button class="add-btn">+ add to cart</button>
    `;
    return card;
}

// ----------------------------------------------------------------------
// # ส่วนที่ 2: การจัดการตะกร้าสินค้า
// ----------------------------------------------------------------------

// เพิ่มสินค้าลงตะกร้า (อ้างอิงด้วย ProductID)
function addToCart(productID, productName, price) {
    const existingItem = cart.find(item => item.productID === productID);

    if (existingItem) {
        existingItem.qty++;
    } else {
        cart.push({ productID, name: productName, price, qty: 1 });
    }

    updateCart();
}

// อัพเดทจำนวนสินค้า
function updateQty(productID, change) {
    const itemIndex = cart.findIndex(item => item.productID === productID);

    if (itemIndex > -1) {
        cart[itemIndex].qty += change;
        if (cart[itemIndex].qty <= 0) {
            cart.splice(itemIndex, 1);
        }
        updateCart();
    }
}

// ลบสินค้าออกจากตะกร้า
function removeItem(productID) {
    const itemIndex = cart.findIndex(item => item.productID === productID);
    if (itemIndex > -1) {
        cart.splice(itemIndex, 1);
        updateCart();
    }
}

// อัพเดทการแสดงผลตะกร้า
function updateCart() {
    const cartItemsDiv = document.getElementById('cartItems');
    const totalPriceSpan = document.getElementById('totalPrice');

    // ถ้าตะกร้าว่าง
    if (cart.length === 0) {
        cartItemsDiv.innerHTML = '<div class="empty-cart">ไม่มีสินค้าในตะกร้า</div>';
        totalPriceSpan.textContent = '0.00฿';
        return;
    }

    let html = '';
    let total = 0;
    let itemCount = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;
        itemCount += item.qty;

        html += `
            <div class="cart-item">
                <div class="item-info">
                    <div class="item-name">${item.name}</div>
                    <div class="item-price">${item.price.toFixed(2)}฿ x ${item.qty} = ${itemTotal.toFixed(2)}฿</div>
                </div>
                <div class="item-controls">
                    <button class="qty-btn" onclick="updateQty('${item.productID}', -1)">-</button>
                    <span class="qty-number">${item.qty}</span>
                    <button class="qty-btn" onclick="updateQty('${item.productID}', 1)">+</button>
                    <button class="remove-btn" onclick="removeItem('${item.productID}')">×</button>
                </div>
            </div>
        `;
    });

    cartItemsDiv.innerHTML = html;
    totalPriceSpan.textContent = total.toFixed(2) + '฿';
}

// ----------------------------------------------------------------------
// # ส่วนที่ 3: การส่งคำสั่งซื้อ
// ----------------------------------------------------------------------
/**
 * ส่งคำสั่งซื้อไปยัง POST /orders API
 * โค้ด Lambda จะบันทึก OrderID, CustomerID, และ Products (List) ลงใน Orders Table
 */
async function submitOrder() {
    // 1. ตรวจสอบสถานะการเป็นสมาชิก
    const customerID = localStorage.getItem('CustomerID');
    // เพิ่ม: ดึง ReservationID จาก Local Storage
    const reservationID = localStorage.getItem('CurrentReservationID');

    if (!customerID) {
        alert('❌ ต้องเป็นสมาชิกและเข้าสู่ระบบก่อนจึงจะส่งคำสั่งซื้อได้');
        return; 
    }
    if (!reservationID) {
        alert('❌ ต้องผ่านการจองมาก่อน');
        return; 
    }

    if (cart.length === 0) {
        alert('กรุณาเลือกสินค้าก่อนส่งคำสั่งซื้อ');
        return;
    }

    // 1. สร้าง Payload สำหรับ /orders API
    const orderPayload = {
        CustomerID: customerID, 
        ReservationID: reservationID, // ส่งค่า null หากไม่มีการจอง
        
        // แปลงรูปแบบตะกร้าสินค้า [ProductID, QTY_Product]
        Products: cart.map(item => ({
            ProductID: item.productID,
            // ใน DynamoDB QTY_Product ถูกบันทึกเป็น String 'N' type, แต่เราส่งเป็น Number ได้
            QTY_Product: item.qty 
        }))
    };

    console.log("Sending Order Payload:", orderPayload);

    try {
        const response = await fetch(ORDERS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderPayload)
        });

        const data = await response.json();

        if (response.status === 404) {
            alert(`❌ ข้อผิดพลาด (404): ข้อมูลไม่พบ: ${data.error}`);
            window.location.href = 'index.html'; // ส่งกลับหน้าหลัก
            return;
        }

        if (response.status === 403) {
            alert(`❌ ข้อผิดพลาด (403): สิทธิ์ไม่เพียงพอ หรือการจองนี้ถูกใช้แล้ว: ${data.error}`);
            window.location.href = 'index.html'; // ส่งกลับหน้าหลัก
            return;
        }

        if (response.ok) {
            // Success: API ตอบกลับด้วย 200 OK
            if (data.OrderID) {
                alert(`✅ คำสั่งซื้อสำเร็จ! OrderID: ${data.OrderID}`);
                console.log(`Order created: ${data.OrderID}`);

                // **บันทึก OrderID ที่ได้มาไว้ใน Local Storage หรือตัวแปรสำหรับใช้ใน Checkout ต่อไป**
                localStorage.setItem('CurrentOrderID', data.OrderID);

                // อัปเดต UI เพื่อให้แสดงตะกร้าว่าง
                clearCart();

            } else {
                alert('คำสั่งซื้อไม่สำเร็จ (API ตอบกลับ 200 แต่ไม่มี OrderID)');
            }
        } else {
            // Error: API ตอบกลับด้วย 4xx/5xx (เช่น CustomerID ไม่พบ หรือ DynamoDB Error)
            const errorMessage = data.error || 'คำสั่งซื้อไม่สำเร็จ โปรดตรวจสอบ Server Log';
            alert(`❌ ข้อผิดพลาด: ${errorMessage}`);
            console.error('Order API Error:', data);
        }

    } catch (error) {
        console.error('Error during POST /orders API call:', error);
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + error.message);
    }
}

// ตัวอย่างในฟังก์ชัน submitOrder() หรือ cancelOrder()
function clearCart() {
    // ล้าง Array cart
    cart = [];
    
    // อัปเดต UI เพื่อให้แสดงตะกร้าว่าง
    updateCart(); 
}

// ----------------------------------------------------------------------
// # ส่วนที่ 4: การเริ่มต้น
// ----------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', function() {
    fetchAndRenderProducts();
    updateCart();
});