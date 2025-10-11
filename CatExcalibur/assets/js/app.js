// ตะกร้าสินค้า
let cart = [];

// เพิ่มสินค้าลงตะกร้า
function addToCart(name, price) {
    const existingItem = cart.find(item => item.name === name);
    
    if (existingItem) {
        existingItem.qty++;
    } else {
        cart.push({ name, price, qty: 1 });
    }
    
    updateCart();
}

// อัพเดทจำนวนสินค้า
function updateQty(index, change) {
    cart[index].qty += change;
    if (cart[index].qty <= 0) {
        cart.splice(index, 1);
    }
    updateCart();
}

// ลบสินค้าออกจากตะกร้า
function removeItem(index) {
    cart.splice(index, 1);
    updateCart();
}

// อัพเดทการแสดงผลตะกร้า
function updateCart() {
    const cartItemsDiv = document.getElementById('cartItems');
    const totalPriceSpan = document.getElementById('totalPrice');
    const cartCountSpan = document.getElementById('cartCount');
    
    // ถ้าตะกร้าว่าง
    if (cart.length === 0) {
        cartItemsDiv.innerHTML = '<div class="empty-cart">ไม่มีสินค้าในตะกร้า</div>';
        totalPriceSpan.textContent = '0฿';
        cartCountSpan.textContent = '0';
        return;
    }
    
    // สร้าง HTML สำหรับสินค้าในตะกร้า
    let html = '';
    let total = 0;
    let itemCount = 0;
    
    cart.forEach((item, index) => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;
        itemCount += item.qty;
        
        html += `
            <div class="cart-item">
                <div class="item-info">
                    <div class="item-name">${item.name}</div>
                    <div class="item-price">${item.price}฿ x ${item.qty} = ${itemTotal}฿</div>
                </div>
                <div class="item-controls">
                    <button class="qty-btn" onclick="updateQty(${index}, -1)">-</button>
                    <span class="qty-number">${item.qty}</span>
                    <button class="qty-btn" onclick="updateQty(${index}, 1)">+</button>
                    <button class="remove-btn" onclick="removeItem(${index})">×</button>
                </div>
            </div>
        `;
    });
    
    cartItemsDiv.innerHTML = html;
    totalPriceSpan.textContent = total + '฿';
    cartCountSpan.textContent = itemCount;
}

// ไปหน้าชำระเงิน
function checkout() {
    if (cart.length === 0) {
        alert('กรุณาเลือกสินค้าก่อนชำระเงิน');
        return;
    }
    
    // บันทึกข้อมูลตะกร้าใน sessionStorage (optional)
    // sessionStorage.setItem('cart', JSON.stringify(cart));
    
    window.location.href = 'checkout.html';
}

// เรียกใช้เมื่อโหลดหน้าเว็บเสร็จ
document.addEventListener('DOMContentLoaded', function() {
    updateCart();
});