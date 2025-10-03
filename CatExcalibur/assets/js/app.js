// assets/js/app.js - shared cart logic for POS pages
const Cart = {
  items: [],
  add(name, price, img){
    const found = this.items.find(i=>i.name===name);
    if(found) found.qty++;
    else this.items.push({name,price,qty:1,img});
    this._onChange();
    this._popup('Added: '+name);
  },
  changeQty(name,delta){
    const it = this.items.find(i=>i.name===name);
    if(!it) return;
    it.qty += delta;
    if(it.qty<1) this.remove(name);
    this._onChange();
  },
  remove(name){
    this.items = this.items.filter(i=>i.name!==name);
    this._onChange();
  },
  total(){
    return this.items.reduce((s,i)=>s+i.qty*i.price,0);
  },
  count(){
    return this.items.reduce((s,i)=>s+i.qty,0);
  },
  clear(){ this.items=[]; this._onChange();},
  _onChange(){ renderCart(); },
  _popup(msg){
    const el = document.getElementById('popup');
    if(!el) return;
    el.textContent = '✅ ' + msg;
    el.style.display='block';
    setTimeout(()=>el.style.display='none',1200);
  }
};

function renderCart(){
  const cartEl = document.getElementById('cart-list');
  const countEl = document.getElementById('cart-count');
  const totalEl = document.getElementById('cart-total');
  if(!cartEl) return;
  cartEl.innerHTML='';
  Cart.items.forEach(it=>{
    const div = document.createElement('div');
    div.className='cart-item';
    div.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px">
        <img src="${it.img}" style="width:40px;height:40px;object-fit:cover;border-radius:6px"/>
        <div>
          <div>${it.name}</div>
          <div class="small">${it.price}฿ each</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="qty-controls">
          <button class="btn" onclick="Cart.changeQty('${it.name}',-1)">-</button>
          <div>${it.qty}</div>
          <button class="btn alt" onclick="Cart.changeQty('${it.name}',1)">+</button>
          <button class="btn" style="background:#e74c3c;margin-left:8px" onclick="Cart.remove('${it.name}')">🗑</button>
        </div>
        <div style="min-width:50px;text-align:right">${it.qty*it.price}฿</div>
      </div>
    `;
    cartEl.appendChild(div);
  });
  countEl && (countEl.textContent = Cart.count());
  totalEl && (totalEl.textContent = 'Total: ' + Cart.total() + '฿');
}

// simple helper to navigate within prototype page
function showSection(id){
  document.querySelectorAll('[data-section]').forEach(s=>s.style.display='none');
  const el = document.getElementById(id);
  if(el) el.style.display='block';
}

window.addEventListener('load', ()=>{ renderCart(); });
