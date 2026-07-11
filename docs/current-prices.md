Call this first then use the bundle id to get the children prices

# Children prices

```bash
curl 'https://whale.lamasoo.com/api/children-prices/?bundleId=45173' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: fa' \
  -H 'authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyT3JnYW5pemF0aW9uSWQiOjIwODMwLCJpYXQiOjE3ODM2OTUxMDMsImV4cCI6MTc4Mzc4MTUwM30.XIlPeXg08M983joZPIV_Vqbhw-OTm9qUGnBSVvziU2lUi7IrWumzlb4odxq9lZYMggdvBnY0hjLfg19vU21QiGruhtQvb99Yqb7g-XiTwdUxAxhR5jsZoH2SWyOOHz_RMMKIEPs9SHaqC_fd9-5AyDP_qXdJDJ2UT7tm8OzCKt1EaDmsPeeOJ86pyYsvfluG_MQUUPZC1l3FHyJKGA2LxhtjzsBw7hjd8rK0_tlD5Dt4lmk8nXoGjUDry6-jCjm3vJBOZ7VDGZCY3fTMSE_OzMK6s79ypx3qz5pByKh5rg69CEGWuycgLpqF26ITaa23ET_TX1tgsj2t1XfTwRaDcQ2FIpcQMk_F13nFsReb8NzYGjF4I9aR4QPXlPnciZ2qOMAmjeAkbW1QXOh75KyDy52i1RZB-c57FLN9q3Q0DdIZLRuXPb4JOh42PAdOsxMIB6HSZVALBKbVm1OCRajsyrq2RbL9M4k6A7YQd1JaHi1aYEZ7hjsFzAsZD8wv1OOMB6Yum-qUSOwE6Ki8-m60bMcnuZ6Yhb1kmrknJo2YrkGUT3GYvh07aNZH30T6AD3flH46WwwXyUUYCK9Dfe11HKm1q3ckVnkpJ7jsZNf3lQFuGp-YJX7QfAG2E5yJIJU62fUI5tNsDvhJD5j9liuz7D6CiZt5dbB4-414yqJW5v4' \
  -H 'if-none-match: W/"2-l9Fw4VUO7kr8CvBlt4zaMCqXZ0w"' \
  -H 'origin: https://hotelcrs.lamasoo.com' \
  -H 'priority: u=1, i' \
  -H 'referer: https://hotelcrs.lamasoo.com/' \
  -H 'sec-ch-ua: "Not;A=Brand";v="8", "Chromium";v="150", "Brave";v="150"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-site' \
  -H 'sec-gpc: 1' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'
```

## Bundle

```bash
curl 'https://whale.lamasoo.com/api/bundle' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: fa' \
  -H 'authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyT3JnYW5pemF0aW9uSWQiOjIwODMwLCJpYXQiOjE3ODM2OTUxMDMsImV4cCI6MTc4Mzc4MTUwM30.XIlPeXg08M983joZPIV_Vqbhw-OTm9qUGnBSVvziU2lUi7IrWumzlb4odxq9lZYMggdvBnY0hjLfg19vU21QiGruhtQvb99Yqb7g-XiTwdUxAxhR5jsZoH2SWyOOHz_RMMKIEPs9SHaqC_fd9-5AyDP_qXdJDJ2UT7tm8OzCKt1EaDmsPeeOJ86pyYsvfluG_MQUUPZC1l3FHyJKGA2LxhtjzsBw7hjd8rK0_tlD5Dt4lmk8nXoGjUDry6-jCjm3vJBOZ7VDGZCY3fTMSE_OzMK6s79ypx3qz5pByKh5rg69CEGWuycgLpqF26ITaa23ET_TX1tgsj2t1XfTwRaDcQ2FIpcQMk_F13nFsReb8NzYGjF4I9aR4QPXlPnciZ2qOMAmjeAkbW1QXOh75KyDy52i1RZB-c57FLN9q3Q0DdIZLRuXPb4JOh42PAdOsxMIB6HSZVALBKbVm1OCRajsyrq2RbL9M4k6A7YQd1JaHi1aYEZ7hjsFzAsZD8wv1OOMB6Yum-qUSOwE6Ki8-m60bMcnuZ6Yhb1kmrknJo2YrkGUT3GYvh07aNZH30T6AD3flH46WwwXyUUYCK9Dfe11HKm1q3ckVnkpJ7jsZNf3lQFuGp-YJX7QfAG2E5yJIJU62fUI5tNsDvhJD5j9liuz7D6CiZt5dbB4-414yqJW5v4' \
  -H 'if-none-match: W/"1b2-5npCjDE5QifkPhPGgU6Ai9kndRk"' \
  -H 'origin: https://hotelcrs.lamasoo.com' \
  -H 'priority: u=1, i' \
  -H 'referer: https://hotelcrs.lamasoo.com/' \
  -H 'sec-ch-ua: "Not;A=Brand";v="8", "Chromium";v="150", "Brave";v="150"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-site' \
  -H 'sec-gpc: 1' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'
```

```bash
curl 'https://whale.lamasoo.com/api/bundle/45173' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: fa' \
  -H 'authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyT3JnYW5pemF0aW9uSWQiOjIwODMwLCJpYXQiOjE3ODM2OTUxMDMsImV4cCI6MTc4Mzc4MTUwM30.XIlPeXg08M983joZPIV_Vqbhw-OTm9qUGnBSVvziU2lUi7IrWumzlb4odxq9lZYMggdvBnY0hjLfg19vU21QiGruhtQvb99Yqb7g-XiTwdUxAxhR5jsZoH2SWyOOHz_RMMKIEPs9SHaqC_fd9-5AyDP_qXdJDJ2UT7tm8OzCKt1EaDmsPeeOJ86pyYsvfluG_MQUUPZC1l3FHyJKGA2LxhtjzsBw7hjd8rK0_tlD5Dt4lmk8nXoGjUDry6-jCjm3vJBOZ7VDGZCY3fTMSE_OzMK6s79ypx3qz5pByKh5rg69CEGWuycgLpqF26ITaa23ET_TX1tgsj2t1XfTwRaDcQ2FIpcQMk_F13nFsReb8NzYGjF4I9aR4QPXlPnciZ2qOMAmjeAkbW1QXOh75KyDy52i1RZB-c57FLN9q3Q0DdIZLRuXPb4JOh42PAdOsxMIB6HSZVALBKbVm1OCRajsyrq2RbL9M4k6A7YQd1JaHi1aYEZ7hjsFzAsZD8wv1OOMB6Yum-qUSOwE6Ki8-m60bMcnuZ6Yhb1kmrknJo2YrkGUT3GYvh07aNZH30T6AD3flH46WwwXyUUYCK9Dfe11HKm1q3ckVnkpJ7jsZNf3lQFuGp-YJX7QfAG2E5yJIJU62fUI5tNsDvhJD5j9liuz7D6CiZt5dbB4-414yqJW5v4' \
  -H 'if-none-match: W/"326-3vgaLOs/paJOXM7WcN8h4qPB5FA"' \
  -H 'origin: https://hotelcrs.lamasoo.com' \
  -H 'priority: u=1, i' \
  -H 'referer: https://hotelcrs.lamasoo.com/' \
  -H 'sec-ch-ua: "Not;A=Brand";v="8", "Chromium";v="150", "Brave";v="150"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-site' \
  -H 'sec-gpc: 1' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'
```

## Response:

```json
{
  "id": 45173,
  "createdAt": "2026-07-10T15:40:45.514Z",
  "updatedAt": "2026-07-10T15:40:45.514Z",
  "name": "عادی",
  "color": "#1B87EB",
  "icon": "",
  "type": "NORMAL",
  "priority": 0,
  "hotelProviderId": 2898,
  "ratePlans": [
    {
      "ratePlanId": 4053,
      "extraGuestPrice": 0,
      "name": "اقامت بدون وعده غذایی",
      "currency": "IRR",
      "roomRateBundles": [
        {
          "id": 291015,
          "createdAt": "2026-07-10T17:56:51.771Z",
          "updatedAt": "2026-07-10T17:56:51.771Z",
          "bundleId": 45173,
          "ratePlanId": 4053,
          "roomTypeProviderId": 13858,
          "boardPrice": 2,
          "displayPrice": 3,
          "extraGuestPrice": 0,
          "roomTypeProvider": {
            "id": 13858,
            "createdAt": "2026-07-10T15:06:44.915Z",
            "updatedAt": "2026-07-10T15:06:45.110Z",
            "name": "اتاق یک‌تخته اقتصادی",
            "roomType": {
              "id": 13866,
              "createdAt": "2026-07-10T15:06:44.908Z",
              "updatedAt": "2026-07-10T15:06:44.908Z",
              "deletedAt": null,
              "idMongo": "6a510a843ea571f9ef08d3d8",
              "name": "اتاق یک‌تخته اقتصادی",
              "description": "مناسب اقامت کاری کوتاه‌مدت، بدون ظرفیت نفر اضافه",
              "capacity": 1,
              "extraCapacity": 0,
              "hotelId": 2900,
              "isActive": true,
              "count": 8,
              "maxChildrenWithoutBed": 1
            },
            "isActive": true,
            "defaultCount": 6
          },
          "priceRates": [],
          "childrenPrices": []
        }
      ]
    },
    {
      "ratePlanId": 4054,
      "extraGuestPrice": 0,
      "name": "اقامت با صبحانه",
      "currency": "IRR",
      "roomRateBundles": []
    },
    {
      "ratePlanId": 4055,
      "extraGuestPrice": 0,
      "name": "اقامت نیم‌برد",
      "currency": "IRR",
      "roomRateBundles": []
    },
    {
      "ratePlanId": 4056,
      "extraGuestPrice": 0,
      "name": "اقامت فول‌برد",
      "currency": "IRR",
      "roomRateBundles": []
    },
    {
      "ratePlanId": 4057,
      "extraGuestPrice": 0,
      "name": "اقامت آل‌اینکلوسیو ویژه",
      "currency": "IRR",
      "roomRateBundles": []
    }
  ]
}
```
