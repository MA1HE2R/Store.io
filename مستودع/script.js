// ==================== إعدادات التطبيق ====================
const STORAGE_KEY = 'warehouse_products';
const SALES_KEY = 'warehouse_sales';
const ACTIVITIES_KEY = 'warehouse_activities';
const DEBTS_KEY = 'warehouse_debts';

// متغيرات البيع
let selectedProduct = null;
let bundlesToSell = 1;
let currentSalePrice = 0;

// ==================== تهيئة التطبيق ====================
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    updateDashboard();
    updateCalculations();
    loadRecentActivity();
    autoSetFooterYear();

    // ربط أحداث الإدخال في صفحة إضافة صنف
    const inputs = ['bundles', 'bagsPerBundle', 'purchasePrice'];
    inputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', updateCalculations);
        }
    });
    
    // نموذج إضافة المنتج
    const addForm = document.getElementById('addProductForm');
    if (addForm) {
        addForm.addEventListener('submit', addNewProduct);
    }
    
    // تحميل المنتجات للبيع
    if (document.getElementById('productsGrid')) {
        loadAvailableProducts();
    }
    
    // تحميل المنتجات للعرض
    if (document.getElementById('productsTableBody')) {
        loadProductsTable();
    }
    
    // ربط أحداث البيع
    if (document.getElementById('sellForm')) {
        document.getElementById('sellForm').addEventListener('submit', confirmSale);
        setupSaleEvents();
    }

    // تحميل الديون في صفحة الديون
    if (document.getElementById('debtsTableBody')) {
        loadDebtsTable();
    }
}

// ==================== التخزين ====================
function getProducts() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}
function saveProducts(products) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

function getSales() {
    return JSON.parse(localStorage.getItem(SALES_KEY) || '[]');
}
function saveSales(sales) {
    localStorage.setItem(SALES_KEY, JSON.stringify(sales));
}

function getActivities() {
    return JSON.parse(localStorage.getItem(ACTIVITIES_KEY) || '[]');
}
function saveActivities(activities) {
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities));
}

function getDebts() {
    return JSON.parse(localStorage.getItem(DEBTS_KEY) || '[]');
}
function saveDebts(debts) {
    localStorage.setItem(DEBTS_KEY, JSON.stringify(debts));
}

// ==================== إضافة منتج جديد + Validation ====================
function addNewProduct(e) {
    e.preventDefault();
    
    const name = document.getElementById('productName').value.trim();
    const bundles = parseInt(document.getElementById('bundles').value);
    const bagsPerBundle = parseInt(document.getElementById('bagsPerBundle').value);
    const purchasePrice = parseFloat(document.getElementById('purchasePrice').value);

    if (!name) {
        showMessage('يرجى إدخال اسم الصنف', 'error');
        return;
    }
    if (bundles <= 0 || isNaN(bundles)) {
        showMessage('عدد الربطات يجب أن يكون رقمًا أكبر من 0', 'error');
        return;
    }
    if (bagsPerBundle <= 0 || isNaN(bagsPerBundle)) {
        showMessage('عدد الأكياس في الربطة يجب أن يكون رقمًا أكبر من 0', 'error');
        return;
    }
    if (purchasePrice <= 0 || isNaN(purchasePrice)) {
        showMessage('سعر الشراء يجب أن يكون رقمًا أكبر من 0', 'error');
        return;
    }

    const products = getProducts();
    if (products.some(p => p.name === name)) {
        showMessage('هذا الصنف موجود مسبقاً', 'error');
        return;
    }

    const product = {
        id: Date.now(),
        name,
        bundles,
        bagsPerBundle,
        purchasePrice,
        salePrice: 0,
        stock: bundles,
        createdAt: new Date().toISOString(),
        lastSalePrice: 0,
        lastSaleDate: null
    };

    products.push(product);
    saveProducts(products);
    logActivity(`تمت إضافة صنف جديد: ${product.name}`, 'add');
    showMessage('تم إضافة الصنف بنجاح!', 'success');

    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1500);
}

// تحديث الحسابات التلقائية في صفحة إضافة صنف
function updateCalculations() {
    const bundles = parseInt(document.getElementById('bundles')?.value) || 0;
    const bagsPerBundle = parseInt(document.getElementById('bagsPerBundle')?.value) || 0;
    const purchasePrice = parseFloat(document.getElementById('purchasePrice')?.value) || 0;
    
    const totalBags = bundles * bagsPerBundle;
    const totalPurchase = totalBags * purchasePrice;
    
    const totalBagsEl = document.getElementById('totalBags');
    const totalPurchaseEl = document.getElementById('totalPurchase');
    
    if (totalBagsEl) totalBagsEl.textContent = totalBags.toLocaleString();
    if (totalPurchaseEl) totalPurchaseEl.textContent = formatCurrency(totalPurchase);
}

// ==================== عرض المنتجات + بحث + فرز ====================
function loadProductsTable(customProducts = null) {
    const products = customProducts || getProducts();
    const sales = getSales();
    const tbody = document.getElementById('productsTableBody');
    const emptyState = document.getElementById('emptyState');
    
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (products.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    
    let totalStock = 0;
    let totalValue = 0;

    products.forEach((product, index) => {
        const productSales = sales.filter(s => s.productId === product.id);
        const soldBundles = productSales.reduce((sum, sale) => sum + sale.bundlesSold, 0);
        const availableBundles = product.bundles - soldBundles;
        const totalBags = product.bundles * product.bagsPerBundle;
        const totalPurchase = totalBags * product.purchasePrice;
        const lastSale = productSales[productSales.length - 1];
        const lastSalePrice = lastSale ? lastSale.salePrice : 0;

        totalStock += availableBundles;
        totalValue += availableBundles * product.bagsPerBundle * product.purchasePrice;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${product.name}</strong></td>
            <td>${product.bundles.toLocaleString()}</td>
            <td>${product.bagsPerBundle.toLocaleString()}</td>
            <td>${formatCurrency(product.purchasePrice)}</td>
            <td>
                ${lastSalePrice > 0 ? 
                    formatCurrency(lastSalePrice) : 
                    '<span class="not-set">لم يبَع بعد</span>'}
            </td>
            <td class="${availableBundles < 10 ? 'low-stock' : availableBundles === 0 ? 'out-of-stock' : ''}">
                ${availableBundles.toLocaleString()} ربطة
                ${availableBundles === 0 ? '<br><small class="stock-warning">نفذ من المخزون</small>' : ''}
                ${availableBundles < 10 && availableBundles > 0 ? '<br><small class="stock-warning">منخفض</small>' : ''}
            </td>
            <td>${formatCurrency(totalPurchase)}</td>
            <td>
                <button class="btn-small" onclick="editProduct(${product.id})" title="تعديل">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-small delete" onclick="deleteProduct(${product.id})" title="حذف">
                    <i class="fas fa-trash"></i>
                </button>
                <button class="btn-small" onclick="quickSell(${product.id})" title="بيع سريع">
                    <i class="fas fa-shopping-cart"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    const totalProductsCount = document.getElementById('totalProductsCount');
    const totalStockCount = document.getElementById('totalStockCount');
    const totalStockValue = document.getElementById('totalStockValue');

    if (totalProductsCount) totalProductsCount.textContent = products.length;
    if (totalStockCount) totalStockCount.textContent = totalStock.toLocaleString() + ' ربطة';
    if (totalStockValue) totalStockValue.textContent = formatCurrency(totalValue);
}

function filterProducts() {
    const search = document.getElementById('productSearchInput')?.value.trim() || '';
    const sortBy = document.getElementById('productSortSelect')?.value || 'name';

    let products = getProducts();
    const sales = getSales();

    if (search) {
        products = products.filter(p => p.name.includes(search));
    }

    products.sort((a, b) => {
        if (sortBy === 'name') {
            return a.name.localeCompare(b.name, 'ar');
        } else if (sortBy === 'stock') {
            const aSales = sales.filter(s => s.productId === a.id);
            const bSales = sales.filter(s => s.productId === b.id);
            const aSold = aSales.reduce((sum, s) => sum + s.bundlesSold, 0);
            const bSold = bSales.reduce((sum, s) => sum + s.bundlesSold, 0);
            const aAvailable = a.bundles - aSold;
            const bAvailable = b.bundles - bSold;
            return bAvailable - aAvailable;
        } else if (sortBy === 'purchasePrice') {
            return b.purchasePrice - a.purchasePrice;
        }
        return 0;
    });

    loadProductsTable(products);
}

// بيع سريع من صفحة المنتجات
function quickSell(productId) {
    localStorage.setItem('quickSellProductId', productId);
    window.location.href = 'sell.html';
}

// ==================== نظام البيع ====================
function setupSaleEvents() {
    const customPriceInput = document.getElementById('customSalePrice');
    if (customPriceInput) {
        customPriceInput.addEventListener('input', updateProfitPreview);
    }
    
    const quantityInput = document.getElementById('bundlesToSell');
    if (quantityInput) {
        quantityInput.addEventListener('input', function() {
            bundlesToSell = parseInt(this.value) || 1;
            updateProfitPreview();
        });
    }

    // لو جاي من بيع سريع
    const quickId = localStorage.getItem('quickSellProductId');
    if (quickId) {
        loadAvailableProducts(parseInt(quickId));
        localStorage.removeItem('quickSellProductId');
    }
}

function loadAvailableProducts(preselectId = null) {
    const products = getProducts();
    const sales = getSales();
    const grid = document.getElementById('productsGrid');
    
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (products.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <h3>لا توجد أصناف في المستودع</h3>
                <p>أضف أصنافاً أولاً من صفحة "إضافة صنف جديد"</p>
                <a href="add_product.html" class="btn-submit">إضافة صنف جديد</a>
            </div>
        `;
        return;
    }
    
    products.forEach(product => {
        const productSales = sales.filter(s => s.productId === product.id);
        const soldBundles = productSales.reduce((sum, sale) => sum + sale.bundlesSold, 0);
        const availableBundles = product.bundles - soldBundles;
        const lastSale = productSales[productSales.length - 1];
        const lastSalePrice = lastSale ? lastSale.salePrice : 0;
        
        if (availableBundles > 0) {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.innerHTML = `
                <div class="product-card-header">
                    <h4>${product.name}</h4>
                    <span class="stock-badge">${availableBundles} ربطة</span>
                </div>
                <div class="product-card-details">
                    <div class="detail">
                        <span>سعر الشراء:</span>
                        <strong>${formatCurrency(product.purchasePrice)}/كيس</strong>
                    </div>
                    <div class="detail">
                        <span>آخر بيع:</span>
                        <strong style="color: #3498db;">
                            ${lastSalePrice > 0 ? formatCurrency(lastSalePrice) : 'لم يبَع بعد'}
                        </strong>
                    </div>
                    <div class="detail">
                        <span>الأكياس/ربطة:</span>
                        <strong>${product.bagsPerBundle}</strong>
                    </div>
                </div>
                <div class="product-card-actions">
                    <button type="button" class="btn-select" onclick="selectProduct(${product.id})">
                        <i class="fas fa-shopping-cart"></i> اختر للبيع
                    </button>
                </div>
            `;
            grid.appendChild(productCard);

            if (preselectId && product.id === preselectId) {
                selectProduct(product.id);
            }
        }
    });
}

function selectProduct(productId) {
    const products = getProducts();
    const sales = getSales();
    
    selectedProduct = products.find(p => p.id === productId);
    
    if (selectedProduct) {
        const productSales = sales.filter(s => s.productId === productId);
        const soldBundles = productSales.reduce((sum, sale) => sum + sale.bundlesSold, 0);
        const availableBundles = selectedProduct.bundles - soldBundles;
        
        document.getElementById('selectedProductCard').innerHTML = `
            <div class="selected-product-info">
                <h4>${selectedProduct.name}</h4>
                <div class="selected-product-details">
                    <div class="detail">
                        <span>سعر الشراء:</span>
                        <strong>${formatCurrency(selectedProduct.purchasePrice)}/كيس</strong>
                    </div>
                    <div class="detail">
                        <span>الأكياس/ربطة:</span>
                        <strong>${selectedProduct.bagsPerBundle}</strong>
                    </div>
                    <div class="detail">
                        <span>المتاح للبيع:</span>
                        <strong>${availableBundles} ربطة</strong>
                    </div>
                    <div class="detail">
                        <span>إجمالي الأكياس:</span>
                        <strong>${(availableBundles * selectedProduct.bagsPerBundle).toLocaleString()} كيس</strong>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('availableBundles').textContent = availableBundles;
        bundlesToSell = 1;
        document.getElementById('bundlesToSell').value = bundlesToSell;
        
        updatePriceSuggestions();
        goToStep(2);

        const step1NextBtn = document.getElementById('step1NextBtn');
        if (step1NextBtn) step1NextBtn.disabled = false;
    }
}

function updatePriceSuggestions() {
    if (!selectedProduct) return;
    
    const purchasePrice = selectedProduct.purchasePrice;
    const purchaseDisplay = document.getElementById('purchasePriceDisplay');
    if (purchaseDisplay) {
        purchaseDisplay.textContent = formatCurrency(purchasePrice);
    }
    
    const price20 = purchasePrice * 1.20;
    const price25 = purchasePrice * 1.25;
    const price30 = purchasePrice * 1.30;
    
    const price20El = document.getElementById('suggestedPrice20');
    const price25El = document.getElementById('suggestedPrice25');
    const price30El = document.getElementById('suggestedPrice30');
    
    if (price20El) price20El.textContent = formatCurrency(price20);
    if (price25El) price25El.textContent = formatCurrency(price25);
    if (price30El) price30El.textContent = formatCurrency(price30);
}

function useSuggestedPrice(percentage) {
    if (!selectedProduct) return;
    
    const purchasePrice = selectedProduct.purchasePrice;
    const suggestedPrice = purchasePrice * (1 + percentage / 100);
    
    document.getElementById('customSalePrice').value = suggestedPrice.toFixed(2);
    currentSalePrice = suggestedPrice;
    updateProfitPreview();
}

function changeQuantity(change) {
    if (!selectedProduct) return;
    
    const sales = getSales();
    const productSales = sales.filter(s => s.productId === selectedProduct.id);
    const soldBundles = productSales.reduce((sum, sale) => sum + sale.bundlesSold, 0);
    const availableBundles = selectedProduct.bundles - soldBundles;
    
    let newQuantity = bundlesToSell + change;
    
    if (newQuantity < 1) newQuantity = 1;
    if (newQuantity > availableBundles) newQuantity = availableBundles;
    
    bundlesToSell = newQuantity;
    document.getElementById('bundlesToSell').value = bundlesToSell;
    updateProfitPreview();
}

function setQuantity(quantity) {
    if (!selectedProduct) return;
    
    const sales = getSales();
    const productSales = sales.filter(s => s.productId === selectedProduct.id);
    const soldBundles = productSales.reduce((sum, sale) => sum + sale.bundlesSold, 0);
    const availableBundles = selectedProduct.bundles - soldBundles;
    
    if (quantity <= availableBundles) {
        bundlesToSell = quantity;
        document.getElementById('bundlesToSell').value = bundlesToSell;
        updateProfitPreview();
    } else {
        showMessage(`الكمية غير متوفرة! المتاح: ${availableBundles} ربطة`, 'error');
    }
}

function updateProfitPreview() {
    if (!selectedProduct) return;
    
    const customPriceInput = document.getElementById('customSalePrice');
    const salePrice = parseFloat(customPriceInput?.value) || 0;
    const purchasePrice = selectedProduct.purchasePrice;
    
    currentSalePrice = salePrice;
    
    if (salePrice > 0 && purchasePrice > 0) {
        const profitPerBag = salePrice - purchasePrice;
        const profitPercentage = ((salePrice - purchasePrice) / purchasePrice * 100).toFixed(2);
        
        const totalBags = bundlesToSell * selectedProduct.bagsPerBundle;
        const totalCost = purchasePrice * totalBags;
        const totalSale = salePrice * totalBags;
        const totalProfit = totalSale - totalCost;
        
        const profitPreview = document.getElementById('profitPreview');
        if (profitPreview) {
            profitPreview.innerHTML = `
                الربح المتوقع: 
                <span style="color: ${profitPerBag > 0 ? '#2ecc71' : '#e74c3c'}">
                    ${formatCurrency(totalProfit)}
                </span> 
                (<span style="color: ${profitPercentage > 0 ? '#2ecc71' : '#e74c3c'}">
                    ${profitPercentage}%</span>)
                <br>
                <small>الإيراد: ${formatCurrency(totalSale)} | التكلفة: ${formatCurrency(totalCost)}</small>
            `;
        }
        
        if (document.getElementById('saleConfirmation')) {
            document.getElementById('saleConfirmation').innerHTML = `
                <div class="sale-summary-details">
                    <div class="summary-item">
                        <span>الصنف:</span>
                        <strong>${selectedProduct.name}</strong>
                    </div>
                    <div class="summary-item">
                        <span>الكمية المباعة:</span>
                        <strong>${bundlesToSell} ربطة (${totalBags.toLocaleString()} كيس)</strong>
                    </div>
                    <div class="summary-item">
                        <span>سعر البيع/كيس:</span>
                        <strong>${formatCurrency(salePrice)}</strong>
                    </div>
                    <div class="summary-item">
                        <span>سعر الشراء/كيس:</span>
                        <strong>${formatCurrency(purchasePrice)}</strong>
                    </div>
                    <div class="summary-item">
                        <span>الإيراد الإجمالي:</span>
                        <strong style="color: #3498db;">${formatCurrency(totalSale)}</strong>
                    </div>
                    <div class="summary-item">
                        <span>التكلفة الإجمالية:</span>
                        <strong>${formatCurrency(totalCost)}</strong>
                    </div>
                    <div class="summary-item profit">
                        <span>الربح الصافي:</span>
                        <strong style="color: #2ecc71;">${formatCurrency(totalProfit)}</strong>
                    </div>
                    <div class="summary-item">
                        <span>نسبة الربح:</span>
                        <strong>${profitPercentage}%</strong>
                    </div>
                </div>
            `;
        }
    }
}

function goToStep(stepNumber) {
    document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
    
    const stepContent = document.getElementById(`step${stepNumber}`);
    const stepIndicator = document.querySelectorAll('.step')[stepNumber - 1];
    
    if (stepContent) stepContent.classList.add('active');
    if (stepIndicator) stepIndicator.classList.add('active');
    
    if (stepNumber === 3) {
        updateProfitPreview();
    }
}

// تأكيد البيع + Validation + ديون + فاتورتين
function confirmSale(e) {
    e.preventDefault();
    
    if (!selectedProduct) {
        showMessage('يرجى اختيار صنف أولاً', 'error');
        return;
    }

    const salePriceInput = document.getElementById('customSalePrice');
    const salePrice = parseFloat(salePriceInput.value) || 0;
    
    if (salePrice <= 0) {
        showMessage('يرجى إدخال سعر بيع صحيح', 'error');
        return;
    }
    
    const sales = getSales();
    const productSales = sales.filter(s => s.productId === selectedProduct.id);
    const soldBundles = productSales.reduce((sum, sale) => sum + sale.bundlesSold, 0);
    const availableBundles = selectedProduct.bundles - soldBundles;
    
    if (bundlesToSell > availableBundles) {
        showMessage(`الكمية غير متوفرة! المتاح: ${availableBundles} ربطة`, 'error');
        return;
    }
    
    if (salePrice < selectedProduct.purchasePrice) {
        const confirmSell = confirm(`⚠️ سعر البيع (${formatCurrency(salePrice)}) أقل من سعر الشراء (${formatCurrency(selectedProduct.purchasePrice)}). هل تريد المتابعة؟`);
        if (!confirmSell) return;
    }
    
    const totalBags = bundlesToSell * selectedProduct.bagsPerBundle;
    const totalCost = totalBags * selectedProduct.purchasePrice;
    const totalSale = totalBags * salePrice;
    const profit = totalSale - totalCost;
    
    const customerName = document.getElementById('customerName')?.value.trim() || 'عميل نقدي';
    const customerPhone = document.getElementById('customerPhone')?.value.trim() || '';
    
    const saleRecord = {
        id: Date.now(),
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        bundlesSold: bundlesToSell,
        totalBags: totalBags,
        purchasePrice: selectedProduct.purchasePrice,
        salePrice: salePrice,
        totalCost: totalCost,
        totalSale: totalSale,
        profit: profit,
        customerName: customerName,
        customerPhone: customerPhone,
        date: new Date().toISOString()
    };
    
    sales.push(saleRecord);
    saveSales(sales);
    
    const products = getProducts();
    const productIndex = products.findIndex(p => p.id === selectedProduct.id);
    if (productIndex !== -1) {
        products[productIndex].lastSalePrice = salePrice;
        products[productIndex].lastSaleDate = new Date().toISOString();
        saveProducts(products);
    }

    // تسجيل دين إذا العميل ليس نقدي
    if (customerName !== 'عميل نقدي') {
        const debts = getDebts();
        debts.push({
            id: Date.now(),
            customerName,
            customerPhone,
            amount: totalSale,
            productName: selectedProduct.name,
            date: new Date().toISOString(),
            paid: false
        });
        saveDebts(debts);
    }
    
    logActivity(`تم بيع ${bundlesToSell} ربطة من ${selectedProduct.name} للعميل ${customerName} - الربح: ${formatCurrency(profit)}`, 'sale');
    
    // طباعة فاتورتين
    printInvoice(saleRecord, 'customer');
    printInvoice(saleRecord, 'archive');
    
    showMessage(`✅ تمت عملية البيع بنجاح!<br>الربح: ${formatCurrency(profit)}`, 'success');
    
    resetSaleForm();
    
    setTimeout(() => {
        loadAvailableProducts();
        updateDashboard();
        loadProductsTable();
        loadRecentActivity();
    }, 1000);
}

function resetSaleForm() {
    selectedProduct = null;
    bundlesToSell = 1;
    currentSalePrice = 0;
    
    const sellForm = document.getElementById('sellForm');
    if (sellForm) {
        sellForm.reset();
    }
    
    goToStep(1);
}

// ==================== طباعة الفاتورة (نسخة عميل + أرشيف) ====================
function printInvoice(sale, type = 'archive') {
    const isCustomerCopy = type === 'customer';
    const invoiceWindow = window.open('', '_blank');

    const detailsHTML = isCustomerCopy
        ? `
            <div class="detail-row">
                <span>الصنف:</span>
                <span>${sale.productName}</span>
            </div>
            <div class="detail-row">
                <span>الكمية:</span>
                <span>${sale.bundlesSold} ربطة (${sale.totalBags.toLocaleString()} كيس)</span>
            </div>
            <div class="detail-row">
                <span>سعر البيع/كيس:</span>
                <span>${formatCurrency(sale.salePrice)}</span>
            </div>
            <div class="detail-row">
                <span>الإجمالي:</span>
                <span>${formatCurrency(sale.totalSale)}</span>
            </div>
        `
        : `
            <div class="detail-row">
                <span>الصنف:</span>
                <span>${sale.productName}</span>
            </div>
            <div class="detail-row">
                <span>الكمية:</span>
                <span>${sale.bundlesSold} ربطة (${sale.totalBags.toLocaleString()} كيس)</span>
            </div>
            <div class="detail-row">
                <span>سعر الشراء/كيس:</span>
                <span>${formatCurrency(sale.purchasePrice)}</span>
            </div>
            <div class="detail-row">
                <span>سعر البيع/كيس:</span>
                <span>${formatCurrency(sale.salePrice)}</span>
            </div>
            <div class="detail-row">
                <span>التكلفة الإجمالية:</span>
                <span>${formatCurrency(sale.totalCost)}</span>
            </div>
            <div class="detail-row">
                <span>الإيراد الإجمالي:</span>
                <span>${formatCurrency(sale.totalSale)}</span>
            </div>
        `;

    const profitHTML = isCustomerCopy ? '' : `
        <div class="total">
            <div class="detail-row">
                <span>الربح:</span>
                <span class="${sale.profit >= 0 ? 'profit' : 'loss'}">
                    ${formatCurrency(sale.profit)}
                </span>
            </div>
            ${sale.customerName && sale.customerName !== 'عميل نقدي' ? `
            <div class="detail-row">
                <span>العميل:</span>
                <span>${sale.customerName}</span>
            </div>
            ` : ''}
        </div>
    `;

    const title = isCustomerCopy ? 'فاتورة بيع - نسخة العميل' : 'فاتورة بيع - نسخة الأرشيف';

    const invoiceHTML = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <title>${title}</title>
            <style>
                body { 
                    font-family: 'Arial', 'Segoe UI', sans-serif; 
                    padding: 20px; 
                    background: #f5f5f5;
                }
                .invoice { 
                    max-width: 400px; 
                    margin: 0 auto; 
                    background: white;
                    border-radius: 10px;
                    padding: 25px;
                    box-shadow: 0 0 20px rgba(0,0,0,0.1);
                }
                .header { 
                    text-align: center; 
                    margin-bottom: 25px;
                    border-bottom: 2px solid #667eea;
                    padding-bottom: 15px;
                }
                .header h1 { 
                    margin: 0; 
                    color: #2c3e50;
                    font-size: 24px;
                }
                .header p { 
                    margin: 5px 0;
                    color: #666;
                }
                .details { 
                    margin-bottom: 20px; 
                }
                .detail-row { 
                    display: flex; 
                    justify-content: space-between; 
                    margin-bottom: 12px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid #eee;
                }
                .detail-row:last-child {
                    border-bottom: none;
                }
                .total { 
                    border-top: 3px solid #2c3e50; 
                    padding-top: 15px; 
                    margin-top: 20px; 
                    font-weight: bold;
                    font-size: 18px;
                }
                .footer { 
                    text-align: center; 
                    margin-top: 30px; 
                    color: #666;
                    font-size: 14px;
                    border-top: 1px solid #eee;
                    padding-top: 15px;
                }
                .profit { color: #2ecc71; font-weight: bold; }
                .loss { color: #e74c3c; font-weight: bold; }
                .timestamp { font-size: 12px; color: #888; }
            </style>
        </head>
        <body>
            <div class="invoice">
                <div class="header">
                    <h1>${title}</h1>
                    <p>نظام محاسبة المستودع</p>
                    <p class="timestamp">${new Date(sale.date).toLocaleString('ar-EG')}</p>
                </div>
                
                <div class="details">
                    <div class="detail-row">
                        <span>رقم الفاتورة:</span>
                        <span>#${sale.id.toString().slice(-6)}</span>
                    </div>
                    ${detailsHTML}
                </div>
                
                ${profitHTML}
                
                <div class="footer">
                    <p>شكراً لتعاملكم معنا</p>
                    <p>📞 للاستفسار: ${sale.customerPhone || ' - '}</p>
                </div>
            </div>
            <script>
                window.onload = function() {
                    window.print();
                }
            </script>
        </body>
        </html>
    `;
    
    invoiceWindow.document.write(invoiceHTML);
    invoiceWindow.document.close();
    invoiceWindow.focus();
}

// ==================== لوحة التحكم + التقارير ====================
function updateDashboard() {
    const products = getProducts();
    const sales = getSales();
    
    let totalProfit = 0;
    let totalInventoryValue = 0;
    let totalSalesCount = sales.length;
    
    products.forEach(product => {
        const productSales = sales.filter(s => s.productId === product.id);
        const soldBundles = productSales.reduce((sum, sale) => sum + sale.bundlesSold, 0);
        const remainingBundles = product.bundles - soldBundles;
        
        productSales.forEach(sale => {
            totalProfit += sale.profit;
        });
        
        totalInventoryValue += remainingBundles * product.bagsPerBundle * product.purchasePrice;
    });
    
    const totalProductsEl = document.getElementById('totalProducts');
    const totalProfitEl = document.getElementById('totalProfit');
    const totalSalesEl = document.getElementById('totalSales');
    const inventoryValueEl = document.getElementById('inventoryValue');
    
    if (totalProductsEl) totalProductsEl.textContent = products.length;
    if (totalProfitEl) totalProfitEl.textContent = formatCurrency(totalProfit);
    if (totalSalesEl) totalSalesEl.textContent = totalSalesCount;
    if (inventoryValueEl) inventoryValueEl.textContent = formatCurrency(totalInventoryValue);
}

function showReports() {
    const products = getProducts();
    const sales = getSales();
    
    let report = '===== 📊 تقرير المستودع الشامل =====\n\n';
    
    report += `📦 عدد الأصناف: ${products.length}\n`;
    report += `💰 إجمالي المبيعات: ${sales.length} عملية\n`;
    report += `💵 إجمالي الأرباح: ${formatCurrency(sales.reduce((sum, sale) => sum + sale.profit, 0))}\n`;
    report += `📊 قيمة المخزون الحالي: ${formatCurrency(products.reduce((sum, product) => {
        const productSales = sales.filter(s => s.productId === product.id);
        const soldBundles = productSales.reduce((sum, sale) => sum + sale.bundlesSold, 0);
        const remainingBundles = product.bundles - soldBundles;
        return sum + (remainingBundles * product.bagsPerBundle * product.purchasePrice);
    }, 0))}\n\n`;
    
    report += '--- 📋 الأصناف والمخزون ---\n';
    products.forEach((product, index) => {
        const productSales = sales.filter(s => s.productId === product.id);
        const soldBundles = productSales.reduce((sum, sale) => sum + sale.bundlesSold, 0);
        const availableBundles = product.bundles - soldBundles;
        const totalSold = soldBundles * product.bagsPerBundle;
        const profitFromProduct = productSales.reduce((sum, sale) => sum + sale.profit, 0);
        
        report += `${index + 1}. ${product.name}:\n`;
        report += `   ├── الإجمالي: ${product.bundles} ربطة (${product.bundles * product.bagsPerBundle} كيس)\n`;
        report += `   ├── المباع: ${soldBundles} ربطة (${totalSold} كيس)\n`;
        report += `   ├── المتبقي: ${availableBundles} ربطة\n`;
        report += `   ├── سعر الشراء: ${formatCurrency(product.purchasePrice)}/كيس\n`;
        report += `   └── الأرباح: ${formatCurrency(profitFromProduct)}\n\n`;
    });
    
    const productsWithProfit = products.map(product => {
        const productSales = sales.filter(s => s.productId === product.id);
        const totalProfit = productSales.reduce((sum, sale) => sum + sale.profit, 0);
        const totalSoldBundles = productSales.reduce((sum, sale) => sum + sale.bundlesSold, 0);
        return {
            name: product.name,
            totalProfit,
            totalSoldBundles
        };
    });

    report += '--- 🏆 أكثر الأصناف ربحاً ---\n';
    productsWithProfit
        .sort((a, b) => b.totalProfit - a.totalProfit)
        .slice(0, 5)
        .forEach((p, i) => {
            report += `${i + 1}. ${p.name} - ربح: ${formatCurrency(p.totalProfit)} - ربطات مباعة: ${p.totalSoldBundles}\n`;
        });

    report += '\n--- 🐢 أقل الأصناف حركة ---\n';
    productsWithProfit
        .sort((a, b) => a.totalSoldBundles - b.totalSoldBundles)
        .slice(0, 5)
        .forEach((p, i) => {
            report += `${i + 1}. ${p.name} - ربطات مباعة: ${p.totalSoldBundles}\n`;
        });

    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <title>تقرير المستودع</title>
            <style>
                body { 
                    font-family: 'Courier New', monospace; 
                    padding: 20px; 
                    white-space: pre-line;
                    background: #f8f9fa;
                    color: #2c3e50;
                    line-height: 1.6;
                }
                .report-container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: white;
                    padding: 30px;
                    border-radius: 10px;
                    box-shadow: 0 0 20px rgba(0,0,0,0.1);
                }
                h1 { text-align: center; color: #2c3e50; }
            </style>
        </head>
        <body>
            <div class="report-container">
                <h1>📊 تقرير المستودع</h1>
                <hr>
                ${report.replace(/\n/g, '<br>')}
                <hr>
                <p style="text-align: center; color: #666;">
                    تم إنشاء التقرير في: ${new Date().toLocaleString('ar-EG')}
                </p>
            </div>
            <script>
                window.onload = function() {
                    window.print();
                }
            </script>
        </body>
        </html>
    `);
    reportWindow.document.close();
}

// ==================== النشاطات ====================
function logActivity(message, type = 'info') {
    const activities = getActivities();
    
    const activity = {
        id: Date.now(),
        message,
        type,
        timestamp: new Date().toISOString()
    };
    
    activities.unshift(activity);
    if (activities.length > 15) activities.pop();
    
    saveActivities(activities);
    loadRecentActivity();
}

function loadRecentActivity() {
    const activities = getActivities();
    const container = document.getElementById('activityLog');
    
    if (!container) return;
    
    container.innerHTML = '';
    
    if (activities.length === 0) {
        container.innerHTML = '<div class="activity-empty">لا توجد نشاطات سابقة</div>';
        return;
    }
    
    activities.forEach(activity => {
        const div = document.createElement('div');
        div.className = `activity-item ${activity.type}`;
        
        const time = new Date(activity.timestamp).toLocaleTimeString('ar-EG', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let icon = 'fas fa-info-circle';
        let color = '#3498db';
        
        switch(activity.type) {
            case 'sale': icon = 'fas fa-shopping-cart'; color = '#2ecc71'; break;
            case 'add': icon = 'fas fa-plus-circle'; color = '#9b59b6'; break;
            case 'edit': icon = 'fas fa-edit'; color = '#f39c12'; break;
            case 'delete': icon = 'fas fa-trash'; color = '#e74c3c'; break;
            case 'warning': icon = 'fas fa-exclamation-triangle'; color = '#f1c40f'; break;
        }
        
        div.innerHTML = `
            <div class="activity-icon" style="color: ${color}">
                <i class="${icon}"></i>
            </div>
            <div class="activity-content">
                <div class="activity-message">${activity.message}</div>
                <div class="activity-time">${time}</div>
            </div>
        `;
        
        container.appendChild(div);
    });
}

function clearActivities() {
    if (!confirm('هل أنت متأكد من حذف كل سجل النشاطات؟')) return;
    saveActivities([]);
    loadRecentActivity();
    showMessage('تم حذف سجل آخر العمليات بنجاح', 'success');
}

// ==================== تعديل وحذف المنتجات ====================
function editProduct(productId) {
    const products = getProducts();
    const product = products.find(p => p.id === productId);
    
    if (product) {
        const newName = prompt('أدخل الاسم الجديد للصنف:', product.name);
        if (newName && newName.trim() !== '') {
            const newBundles = prompt('أدخل عدد الربطات الجديد:', product.bundles);
            const newBagsPerBundle = prompt('أدخل عدد الأكياس في الربطة الجديد:', product.bagsPerBundle);
            const newPurchasePrice = prompt('أدخل سعر الشراء الجديد:', product.purchasePrice);
            
            if (newBundles && newBagsPerBundle && newPurchasePrice) {
                product.name = newName.trim();
                product.bundles = parseInt(newBundles);
                product.bagsPerBundle = parseInt(newBagsPerBundle);
                product.purchasePrice = parseFloat(newPurchasePrice);
                
                saveProducts(products);
                logActivity(`تم تعديل صنف: ${product.name}`, 'edit');
                loadProductsTable();
                updateDashboard();
                showMessage('تم تعديل الصنف بنجاح', 'success');
            }
        }
    }
}

function deleteProduct(productId) {
    const products = getProducts();
    const product = products.find(p => p.id === productId);
    
    if (product) {
        const confirmDelete = confirm(`هل أنت متأكد من حذف الصنف "${product.name}"؟\nهذا الإجراء لا يمكن التراجع عنه.`);
        
        if (confirmDelete) {
            const sales = getSales();
            const productSales = sales.filter(s => s.productId === productId);
            
            if (productSales.length > 0) {
                const confirmDeleteWithSales = confirm(`تحذير! هذا الصنف لديه ${productSales.length} عملية بيع.\nحذفه سيؤدي لحذف كل عمليات البيع المرتبطة به.`);
                if (!confirmDeleteWithSales) return;
                
                const filteredSales = sales.filter(s => s.productId !== productId);
                saveSales(filteredSales);
            }
            
            const filteredProducts = products.filter(p => p.id !== productId);
            saveProducts(filteredProducts);
            
            logActivity(`تم حذف صنف: ${product.name}`, 'delete');
            loadProductsTable();
            updateDashboard();
            showMessage('تم حذف الصنف بنجاح', 'success');
        }
    }
}

// ==================== التصدير والاستيراد ====================
function exportData() {
    const data = {
        products: getProducts(),
        sales: getSales(),
        activities: getActivities(),
        debts: getDebts(),
        exportedAt: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `backup_warehouse_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showMessage('تم تصدير البيانات بنجاح', 'success');
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(event) {
        const file = event.target.files[0];
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                if (confirm(`هل تريد استيراد البيانات؟\n- الأصناف: ${data.products?.length || 0}\n- المبيعات: ${data.sales?.length || 0}\n- الديون: ${data.debts?.length || 0}\n\nسيتم استبدال البيانات الحالية.`)) {
                    if (data.products) localStorage.setItem(STORAGE_KEY, JSON.stringify(data.products));
                    if (data.sales) localStorage.setItem(SALES_KEY, JSON.stringify(data.sales));
                    if (data.activities) localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(data.activities));
                    if (data.debts) localStorage.setItem(DEBTS_KEY, JSON.stringify(data.debts));
                    
                    showMessage('تم استيراد البيانات بنجاح', 'success');
                    setTimeout(() => {
                        location.reload();
                    }, 1000);
                }
            } catch (error) {
                showMessage('خطأ في ملف البيانات', 'error');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// ==================== الديون / الذمم ====================
function loadDebtsTable() {
    const debts = getDebts();
    const tbody = document.getElementById('debtsTableBody');
    const emptyState = document.getElementById('debtsEmptyState');

    if (!tbody) return;

    tbody.innerHTML = '';

    if (debts.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    debts.forEach((debt, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${debt.customerName}</td>
            <td>${debt.customerPhone || '-'}</td>
            <td>${debt.productName}</td>
            <td>${formatCurrency(debt.amount)}</td>
            <td>${new Date(debt.date).toLocaleDateString('ar-EG')}</td>
            <td>${debt.paid ? 'مسدد' : 'غير مسدد'}</td>
            <td>
                ${!debt.paid ? `
                <button class="btn-small" onclick="markDebtPaid(${debt.id})">
                    <i class="fas fa-check"></i> تم السداد
                </button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function markDebtPaid(id) {
    const debts = getDebts();
    const index = debts.findIndex(d => d.id === id);
    if (index !== -1) {
        debts[index].paid = true;
        saveDebts(debts);
        showMessage('تم تحديث حالة الدين إلى مسدد', 'success');
        loadDebtsTable();
    }
}

// ==================== أدوات مساعدة ====================
function formatCurrency(amount) {
    return new Intl.NumberFormat('ar-SY', {
        style: 'currency',
        currency: 'SYP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
}

function showMessage(message, type = 'info') {
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `
        <div class="message-content">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="message-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(messageDiv);
    
    if (type !== 'error') {
        setTimeout(() => {
            if (messageDiv.parentElement) {
                messageDiv.remove();
            }
        }, 5000);
    }
}

function resetForm() {
    const form = document.getElementById('addProductForm');
    if (form) {
        form.reset();
        updateCalculations();
    }
}

function autoSetFooterYear() {
    const footerYear = document.getElementById('footerYear');
    if (footerYear) {
        footerYear.innerHTML = `تم التطوير خصيصًا لمستودعك &copy; ${new Date().getFullYear()}`;
    }
}

// التحقق من المخزون المنخفض
function checkLowStock() {
    const products = getProducts();
    const sales = getSales();
    const lowStockProducts = [];
    
    products.forEach(product => {
        const productSales = sales.filter(s => s.productId === product.id);
        const soldBundles = productSales.reduce((sum, sale) => sum + sale.bundlesSold, 0);
        const availableBundles = product.bundles - soldBundles;
        
        if (availableBundles < (product.bundles * 0.1)) {
            lowStockProducts.push({
                name: product.name,
                available: availableBundles,
                total: product.bundles
            });
        }
    });
    
    if (lowStockProducts.length > 0) {
        let alertMessage = '⚠️ تحذير: المخزون منخفض للأصناف التالية:\n\n';
        lowStockProducts.forEach(product => {
            alertMessage += `• ${product.name}: ${product.available}/${product.total} ربطة\n`;
        });
        
        alert(alertMessage);
    }
}

// تشغيل التحقق التلقائي كل 30 دقيقة
setInterval(checkLowStock, 30 * 60 * 1000);
