# Get Bundle and Prices

In the real production we must for now call below api to get all bundles to call the the Target bundles but for testing reason use the below ID 45173 and call the api to get the bundle and prices then update the bundle id in the code to the target bundle id.
Get bundles https://whale.lamasoo.com/api/bundle

```json
{
  "id": 45173,
  "createdAt": "2026-07-10T15:40:45.514Z",
  "updatedAt": "2026-07-10T15:40:45.514Z",
  "deletedAt": null,
  "color": "#1B87EB",
  "name": "عادی",
  "icon": "",
  "priority": 0,
  "type": "NORMAL",
  "hotelProviderId": 2898,
  "hotelProvider": {
    "id": 2898,
    "createdAt": "2026-07-08T10:43:26.645Z",
    "updatedAt": "2026-07-08T10:43:26.645Z",
    "deletedAt": null,
    "hotelId": 2900,
    "providerId": 1,
    "isActive": true,
    "isDeleted": false,
    "hasChildrenPolicy": false
  },
  "roomCount": 1
}
```

API  
https://whale.lamasoo.com/api/bundle/<bundleId>

# Response

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
          "updatedAt": "2026-07-11T12:40:41.361Z",
          "bundleId": 45173,
          "ratePlanId": 4053,
          "roomTypeProviderId": 13858,
          "boardPrice": 4,
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
        },
        {
          "id": 293641,
          "createdAt": "2026-07-13T17:20:13.544Z",
          "updatedAt": "2026-07-13T17:20:13.544Z",
          "bundleId": 45173,
          "ratePlanId": 4053,
          "roomTypeProviderId": 13859,
          "boardPrice": 5,
          "displayPrice": 5,
          "extraGuestPrice": 0,
          "roomTypeProvider": {
            "id": 13859,
            "createdAt": "2026-07-10T15:08:05.697Z",
            "updatedAt": "2026-07-10T15:08:05.795Z",
            "name": "اتاق دوتخته دبل استاندارد",
            "roomType": {
              "id": 13867,
              "createdAt": "2026-07-10T15:08:05.692Z",
              "updatedAt": "2026-07-10T15:08:05.692Z",
              "deletedAt": null,
              "idMongo": "6a510ad5dc5b28257dbb68c8",
              "name": "اتاق دوتخته دبل استاندارد",
              "description": "دارای تخت دبل، مناسب زوج‌ها",
              "capacity": 1,
              "extraCapacity": 1,
              "hotelId": 2900,
              "isActive": true,
              "count": 12,
              "maxChildrenWithoutBed": 1
            },
            "isActive": true,
            "defaultCount": 10
          },
          "priceRates": [],
          "childrenPrices": []
        },
        {
          "id": 293642,
          "createdAt": "2026-07-13T17:20:13.544Z",
          "updatedAt": "2026-07-13T17:20:13.544Z",
          "bundleId": 45173,
          "ratePlanId": 4053,
          "roomTypeProviderId": 13860,
          "boardPrice": 2,
          "displayPrice": 2,
          "extraGuestPrice": 0,
          "roomTypeProvider": {
            "id": 13860,
            "createdAt": "2026-07-10T15:33:54.850Z",
            "updatedAt": "2026-07-10T15:33:56.399Z",
            "name": "اتاق دوتخته توئین استاندارد",
            "roomType": {
              "id": 13868,
              "createdAt": "2026-07-10T15:33:54.844Z",
              "updatedAt": "2026-07-10T15:33:54.844Z",
              "deletedAt": null,
              "idMongo": "6a5110e2dc5b28257dbc11a3",
              "name": "اتاق دوتخته توئین استاندارد",
              "description": "دو تخت جدا، مناسب سفر کاری یا دوستانه",
              "capacity": 2,
              "extraCapacity": 1,
              "hotelId": 2900,
              "isActive": true,
              "count": 10,
              "maxChildrenWithoutBed": 1
            },
            "isActive": true,
            "defaultCount": 8
          },
          "priceRates": [],
          "childrenPrices": []
        },
        {
          "id": 293643,
          "createdAt": "2026-07-13T17:20:13.544Z",
          "updatedAt": "2026-07-13T17:20:13.544Z",
          "bundleId": 45173,
          "ratePlanId": 4053,
          "roomTypeProviderId": 13861,
          "boardPrice": 6,
          "displayPrice": 7,
          "extraGuestPrice": 0,
          "roomTypeProvider": {
            "id": 13861,
            "createdAt": "2026-07-10T15:35:53.123Z",
            "updatedAt": "2026-07-10T15:35:54.738Z",
            "name": "اتاق سه‌تخته خانوادگی",
            "roomType": {
              "id": 13869,
              "createdAt": "2026-07-10T15:35:53.116Z",
              "updatedAt": "2026-07-10T15:35:53.116Z",
              "deletedAt": null,
              "idMongo": "6a5111593ea571f9ef098dc1",
              "name": "اتاق سه‌تخته خانوادگی",
              "description": "مناسب خانواده‌های کوچک",
              "capacity": 3,
              "extraCapacity": 1,
              "hotelId": 2900,
              "isActive": true,
              "count": 7,
              "maxChildrenWithoutBed": 1
            },
            "isActive": true,
            "defaultCount": 6
          },
          "priceRates": [],
          "childrenPrices": []
        },
        {
          "id": 293644,
          "createdAt": "2026-07-13T17:20:13.544Z",
          "updatedAt": "2026-07-13T17:20:13.544Z",
          "bundleId": 45173,
          "ratePlanId": 4053,
          "roomTypeProviderId": 13862,
          "boardPrice": 3,
          "displayPrice": 3,
          "extraGuestPrice": 0,
          "roomTypeProvider": {
            "id": 13862,
            "createdAt": "2026-07-10T15:36:35.333Z",
            "updatedAt": "2026-07-10T15:36:36.931Z",
            "name": "اتاق چهارتخته خانوادگی",
            "roomType": {
              "id": 13870,
              "createdAt": "2026-07-10T15:36:35.326Z",
              "updatedAt": "2026-07-10T15:36:35.326Z",
              "deletedAt": null,
              "idMongo": "6a511183d80f8348c59807f8",
              "name": "اتاق چهارتخته خانوادگی",
              "description": "مناسب خانواده‌ها و گروه‌های کوچک",
              "capacity": 4,
              "extraCapacity": 1,
              "hotelId": 2900,
              "isActive": true,
              "count": 5,
              "maxChildrenWithoutBed": 2
            },
            "isActive": true,
            "defaultCount": 4
          },
          "priceRates": [],
          "childrenPrices": []
        },
        {
          "id": 293645,
          "createdAt": "2026-07-13T17:20:13.544Z",
          "updatedAt": "2026-07-13T17:20:13.544Z",
          "bundleId": 45173,
          "ratePlanId": 4053,
          "roomTypeProviderId": 13863,
          "boardPrice": 8,
          "displayPrice": 8,
          "extraGuestPrice": 0,
          "roomTypeProvider": {
            "id": 13863,
            "createdAt": "2026-07-10T15:37:09.423Z",
            "updatedAt": "2026-07-10T15:37:11.011Z",
            "name": "سوئیت یک‌خوابه رویال",
            "roomType": {
              "id": 13871,
              "createdAt": "2026-07-10T15:37:09.412Z",
              "updatedAt": "2026-07-10T15:37:09.412Z",
              "deletedAt": null,
              "idMongo": "6a5111a53ea571f9ef098dc8",
              "name": "سوئیت یک‌خوابه رویال",
              "description": "سوئیت بزرگ‌تر با فضای نشیمن",
              "capacity": 2,
              "extraCapacity": 2,
              "hotelId": 2900,
              "isActive": true,
              "count": 4,
              "maxChildrenWithoutBed": 2
            },
            "isActive": true,
            "defaultCount": 3
          },
          "priceRates": [],
          "childrenPrices": []
        },
        {
          "id": 293646,
          "createdAt": "2026-07-13T17:20:13.544Z",
          "updatedAt": "2026-07-13T17:20:13.544Z",
          "bundleId": 45173,
          "ratePlanId": 4053,
          "roomTypeProviderId": 13864,
          "boardPrice": 4,
          "displayPrice": 4,
          "extraGuestPrice": 0,
          "roomTypeProvider": {
            "id": 13864,
            "createdAt": "2026-07-10T15:37:51.633Z",
            "updatedAt": "2026-07-10T15:37:53.234Z",
            "name": "سوئیت دوخوابه VIP",
            "roomType": {
              "id": 13872,
              "createdAt": "2026-07-10T15:37:51.627Z",
              "updatedAt": "2026-07-10T15:37:51.627Z",
              "deletedAt": null,
              "idMongo": "6a5111cfe2cb1fc7060f243d",
              "name": "سوئیت دوخوابه VIP",
              "description": "مناسب خانواده‌های بزرگ و مهمانان ویژه",
              "capacity": 2,
              "extraCapacity": 2,
              "hotelId": 2900,
              "isActive": true,
              "count": 4,
              "maxChildrenWithoutBed": 2
            },
            "isActive": true,
            "defaultCount": 3
          },
          "priceRates": [],
          "childrenPrices": []
        },
        {
          "id": 293647,
          "createdAt": "2026-07-13T17:20:13.544Z",
          "updatedAt": "2026-07-13T17:20:13.544Z",
          "bundleId": 45173,
          "ratePlanId": 4053,
          "roomTypeProviderId": 13865,
          "boardPrice": 9,
          "displayPrice": 9,
          "extraGuestPrice": 0,
          "roomTypeProvider": {
            "id": 13865,
            "createdAt": "2026-07-10T15:38:25.647Z",
            "updatedAt": "2026-07-10T15:38:27.225Z",
            "name": "اتاق کانکت خانوادگی",
            "roomType": {
              "id": 13873,
              "createdAt": "2026-07-10T15:38:25.641Z",
              "updatedAt": "2026-07-10T15:38:25.641Z",
              "deletedAt": null,
              "idMongo": "6a5111f195d619efd60df4fa",
              "name": "اتاق کانکت خانوادگی",
              "description": "دو اتاق متصل، مناسب خانواده‌ها",
              "capacity": 4,
              "extraCapacity": 2,
              "hotelId": 2900,
              "isActive": true,
              "count": 3,
              "maxChildrenWithoutBed": 2
            },
            "isActive": true,
            "defaultCount": 2
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
