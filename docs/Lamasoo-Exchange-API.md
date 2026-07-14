# API های لاماسو

# API های لاماسو در خصوص بروزرسانی ظرفیت و قیمت اتاق ها

# لیست هتل ها:

برای گرفتن تمام اتاق های تعریف شده برای هتل مورد نظر  
Method: GET  
Url: {{baseUrl}}[/api/exchange/hotels](https://whale.lamasoo.com/api/exchange/rate-plans)  
Header: exchange-authorization: {{token}}

خروجی api

| \[ { "id": 1, "createdAt": "2024-07-13T07:49:55.759Z", "updatedAt": "2025-01-22T12:03:18.485Z", "name": "هتل تستی ۱", "description": "", "star": 2, "latitude": "", "longitude": "", "phone": "09366419951", "address": "mirdamad", "postalCode": "", "fax": "", "email": "", "isActive": true }, { "id": 2, "createdAt": "2025-08-30T10:56:56.696Z", "updatedAt": "2025-08-30T10:56:56.696Z", "name": "هتل تست ۲", "description": "", "star": 2, "latitude": "30.546546", "longitude": "48.13213213", "phone": "09359142096", "address": "tehran-valiasr", "postalCode": "12456", "fax": "123456478", "email": "111@gmail.com", "isActive": true } \] |
| :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

#

# لیست اتاق های یک هتل:

برای گرفتن تمام اتاق های تعریف شده برای هتل مورد نظر  
Method: GET  
Url: {{baseUrl}}[/api/exchange/room-type-providers](https://whale.lamasoo.com/api/exchange/rate-plans)  
Header: exchange-authorization: {{token}}  
Header: hotel-id: {{hotelId}}

خروجی api

```json
[
  {
    "id": 1,
    "hotelProviderId": 1,
    "name": "یک تخته",
    "defaultCount": 10,
    "roomTypeId": 1,
    "priority": 1,
    "isActive": true
  },
  {
    "id": 2,
    "hotelProviderId": 1,
    "name": "دو تخته",
    "defaultCount": 10,
    "roomTypeId": 2,
    "priority": 1,
    "isActive": true
  }
]
```

# لیست نرخ نامه های یک هتل:

برای گرفتن تمام نرخ نامه های تعریف شده برای هتل مورد نظر

Method: GET  
Url: {{baseUrl}}[/api/exchange/rate-plans](https://whale.lamasoo.com/api/exchange/rate-plans)  
Header: exchange-authorization: {{token}}  
Header: hotel-id: {{hotelId}}

خروجی api

```json
[
  {
    "id": 1,
    "mealType": "BB",
    "name": "صبحانه",
    "currency": "IRR",
    "hotelProviderId": 1,
    "isActive": true
  },
  {
    "id": 2,
    "mealType": "FB",
    "name": "فول برد",
    "currency": "AED",
    "hotelProviderId": 1,
    "isActive": true
  }
]
```

# لیست دسته بندی های کودک:

برای گرفتن تمام دسته بندی های تعریف شده برای هتل مورد نظر  
Method: GET  
Url: {{baseUrl}}[/api/exchange/children-categories](https://whale.lamasoo.com/api/exchange/rate-plans)  
Header: exchange-authorization: {{token}}  
Header: hotel-id: {{hotelId}}

خروجی api

```json
[
  {
    "id": 18,
    "hotelProviderId": 24,
    "name": "نوزاد",
    "from": 0,
    "to": 1.99,
    "requiresBed": false
  },
  {
    "id": 19,
    "hotelProviderId": 24,
    "name": "نو پا ",
    "from": 2,
    "to": 3.99,
    "requiresBed": false
  },
  {
    "id": 20,
    "hotelProviderId": 24,
    "name": "کودک",
    "from": 4,
    "to": 5.99,
    "requiresBed": false
  }
]
```

# بروزرسانی قیمت و ظرفیت اتاق ها یک هتل:

برای بروزرسانی قیمت اتاق یا قیمت کودک و یا ظرفیت برای تاریخ خاصی میتوانید از این api استفاده کنید.

Method: POST  
Url: {{baseUrl}}[/api/exchange/price-capacity/upsert](https://whale.lamasoo.com/api/exchange/rate-plans)  
Header: exchange-authorization: {{token}}  
Header: hotel-id: {{hotelId}}  
Body :

```json
{ "items": \[ { "date": "2025-02-03", "roomTypeProviderId": 1, "count": 2, "constraint": { "cta": false, "ctd": false, "minLos": 1, "maxLos": 10, "stopSell": false, }, "price": { "ratePlanId": 1, "boardPrice": 6000000, "displayPrice": 7000000, "extraGuestPrice": 4000000, "childrenPrices": \[{ "childrenCategoryId": 1, "amount": 2000000, "priceType": "FIXED" }\] } }, { "date": "2025-02-04", "roomTypeProviderId": 1, "count": 2, "constraint": { "cta": false, "ctd": false, "minLos": 1, "maxLos": 10, "stopSell": false, }, "price": { "ratePlanId": 1, "boardPrice": 6000000, "displayPrice": 7000000, "extraGuestPrice": 4000000, "childrenPrices": \[{ "childrenCategoryId": 2, "amount": 20, "priceType": "PERCENT" }\] } }, { "date": "2025-02-04", "roomTypeProviderId": 2, "count": 2, "constraint": { "cta": false, "ctd": false, "minLos": 1, "maxLos": 10, "stopSell": false, }, "price": { "ratePlanId": 1, "boardPrice": 6000000, "displayPrice": 7000000, "extraGuestPrice": 4000000, "childrenPrices": \[{ "childrenCategoryId": 2, "amount": 20, "priceType": "PERCENT" }\] } } \] }
```

###

### **`(`**اجباری**`) date`**

تاریخ مورد نظر برای ثبت ظرفیت یا قیمت

### **`(`**اجباری**`) roomTypeProviderId`**

شناسه اتاق مورد نظر برای بروزرسانی / ثبت ظرفیت یا قیمت

### **`count`**

تعداد ظرفیت پایه‌ی اتاق برای بزرگسالان.  
مثال: `2` یعنی اتاق به طور پیش‌فرض دو نفر ظرفیت دارد.

این فیلد اختیاری می باشد در صورت نیاز به بروزرسانی ظرفیت اتاق از این فیلد استفاده کنید.

### **`constraint`**

cta : برای مشخص کردن اینکه اتاق برای ورود مهمانان بسته است، یعنی مهمانان نمی‌توانند در تاریخ مشخص شده به اتاق وارد شوند. (closed to arrival)

ctd: برای مشخص کردن اینکه اتاق برای خروج مهمانان بسته است، یعنی مهمانان نمی‌توانند در تاریخ مشخص شده از اتاق خارج شوند. (closed to departure)

minLos: حداقل طول اقامت (Minimum Length of Stay) که می‌تواند تعداد شب‌هایی که مهمان باید در اتاق بماند را مشخص کند.

maxLos: حداکثر طول اقامت (Maximum Length of Stay) که می‌تواند تعداد شب‌هایی که مهمان می‌تواند در اتاق بماند را مشخص کند.

stopSell: این فیلد برای مشخص کردن اینکه اتاق به طور موقت قابل فروش نیست  
این فیلد اختیاری می باشد در صورت نیاز به بروزرسانی محدودیت های یک اتاق از این فیلدها استفاده کنید.

### **`price`**

ratePlanId: شناسه نرخ نامه

boardPrice: قیمت برد

displayPrice: قیمت نمایش

extraGuestPrice: قیمت نفر اضافه  
این فیلد اختیاری می باشد در صورت نیاز به بروزرسانی قیمت اتاق از این فیلدها استفاده کنید.

**`childrenPrice`**

این فیلد اختیاری می باشد در صورت نیاز به بروزرسانی قیمت کودک از این فیلدها استفاده کنید.

- childrenCategoryId : این فیلد شناسه ای است که به دسته بندی مربوط به کودکان اشاره دارد.
- amount : این فیلد نشان‌دهنده مقدار قیمت است که می‌خواهید برای آن دسته‌بندی مشخص کنید. این مقدار ممکن است مبلغی ثابت باشد یا درصدی از قیمت کل.
- priceType : این فیلد نوع قیمت‌گذاری را توصیف می‌کند و شامل مقادیر زیر می باشد:
  - FREE: به این معناست که قیمت برای این دسته‌بندی رایگان است.
  - FIXED: به این معناست که قیمت به صورت ثابت مشخص می‌شود.
  - PERCENT: به این معناست که قیمت به صورت درصدی از یک مبلغ کل محاسبه می‌شود.

# API های تامین کننده

# API های لازم جهت ثبت رزرو باید سمت تامین‌کننده پیاده سازی شوند

در لیست زیر API هایی اشاره شده است که برای ثبت رزرو نیاز هست در سمت تامین کننده پیاده سازی شود.

# ثبت رزرو (lock)

در هنگام ثبت رزرو از طریق آژانس‌های لاماسو، اطلاعات رزرو برای تامین کننده ارسال میشود. این رزرو موقت است و فقط برای lock کردن اتاق است، زمان lock پانزده دقیقه می‌باشد و اگر تا پایان این زمان confirm انجام نشد ظرفیت اتاق باید به حالت قبلی برگردد.  
Method: POST  
Url: {{baseUrl}}[/reservation/lock](https://whale.lamasoo.com/api/exchange/rate-plans)  
Header: authorization: {{token}}  
Body :

````json
{ "hotelProviderId": 1, "hotelId": 1, “agencyId”: “stringvalue”, “agencyName”: “سفر‌های علی بابا”, "orderReferenceId": "58a57909-e3cf-40d5-9107-f0193279b929", "checkinDate": "2025-08-01", "checkoutDate": "2025-08-05", "customer": { "firstName": "احمد ", "lastName": "زمانی سرخرودی", "nationalCode": "2141988993", "phoneNumber": "09119150153" }, "rooms": [ { "roomTypeProviderId": 1, "name": "اتاق دوتخته دبل اکونومی", "price": 127920000, "extraPrice": 0, "customer": { "firstName": "احمد ", "lastName": "زمانی سرخرودی" }, "party": { "adults": 2, "children": [5] }, "earlyCheckin": false, "lateCheckout": false } ], "ratePlanId": 1, "price": 127920000 }
```

###

- hotelProviderId : شناسه ارائه دهنده هتل
- hotelId : شناسه هتل
- orderReferenceId : شناسه مرجع سفارش که می تواند برای پیگیری و ثبت نهایی یا کنسل کردن رزرو استفاده شود.
- checkinDate : تاریخ ورود
- checkoutData: تاریخ خروج
- Customer : اطلاعات مسافر
  - firstName: نام مسافر.
  - lastName: نام خانوادگی مسافر.
  - nationalCode: کد ملی مسافر.
  - phoneNumber: شماره تلفن مسافر.
- Rooms: آرایه ای از اتاق ها که شامل رزرو می شوند:
  - roomTypeProviderId: شناسه نوع اتاق.
  - name: نام اتاق.
  - price: قیمت اتاق.
  - extraPrice: هزینه‌های اضافی (در صورت وجود).
  - customer: (مشابه اطلاعات مسافر) اطلاعات مربوط به مسافر برای اتاق.
  - party: تعداد افراد در اتاق شامل:
    - adults: تعداد بزرگ‌ترها.
    - children: لیست سن کودکان.
  - earlyCheckin: آیا check-in زودهنگام است؟
  - lateCheckout: آیا check-out دیرهنگام است؟
- ratePlanId : شناسه نرخ نامه مربوط به رزرو
- Price : قیمت کلی رزرو

# تایید نهایی رزرو (book)

در صورتی که آژانس ثبت کننده رزرو را نهایی کند، این API فراخوانی میشود.
Method: POST
Url: {{baseUrl}}[/reservation/book](https://whale.lamasoo.com/api/exchange/rate-plans)
Header: authorization: {{token}}
Body :

| { "orderReferenceId": "58a57909-e3cf-40d5-9107-f0193279b929" } |
| :------------------------------------------------------------- |

# کنسل کردن رزرو

برای رزرو‌های confirm شده اگر آژانس قصد کنسلی داشته باشد،‌ این API فراخوانی میشود. هدف این API مارک کردن رزرو به وضعیت Canceled و آزاد شدن ظرفیت‌ اتاق‌های آن رزرو است.
Method: POST
Url: {{baseUrl}}[/reservation/cancel](https://whale.lamasoo.com/api/exchange/rate-plans)
Header: authorization:BEARER {{token}}
Body :

| { "orderReferenceId": "58a57909-e3cf-40d5-9107-f0193279b929" } |
| :------------------------------------------------------------- |

###
````
