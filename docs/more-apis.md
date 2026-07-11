# Lamasoo API

## Create Room

```bash
curl 'https://whale.lamasoo.com/api/room-type' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: fa' \
  -H 'authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyT3JnYW5pemF0aW9uSWQiOjIwODMwLCJpYXQiOjE3ODM2OTUxMDMsImV4cCI6MTc4Mzc4MTUwM30.XIlPeXg08M983joZPIV_Vqbhw-OTm9qUGnBSVvziU2lUi7IrWumzlb4odxq9lZYMggdvBnY0hjLfg19vU21QiGruhtQvb99Yqb7g-XiTwdUxAxhR5jsZoH2SWyOOHz_RMMKIEPs9SHaqC_fd9-5AyDP_qXdJDJ2UT7tm8OzCKt1EaDmsPeeOJ86pyYsvfluG_MQUUPZC1l3FHyJKGA2LxhtjzsBw7hjd8rK0_tlD5Dt4lmk8nXoGjUDry6-jCjm3vJBOZ7VDGZCY3fTMSE_OzMK6s79ypx3qz5pByKh5rg69CEGWuycgLpqF26ITaa23ET_TX1tgsj2t1XfTwRaDcQ2FIpcQMk_F13nFsReb8NzYGjF4I9aR4QPXlPnciZ2qOMAmjeAkbW1QXOh75KyDy52i1RZB-c57FLN9q3Q0DdIZLRuXPb4JOh42PAdOsxMIB6HSZVALBKbVm1OCRajsyrq2RbL9M4k6A7YQd1JaHi1aYEZ7hjsFzAsZD8wv1OOMB6Yum-qUSOwE6Ki8-m60bMcnuZ6Yhb1kmrknJo2YrkGUT3GYvh07aNZH30T6AD3flH46WwwXyUUYCK9Dfe11HKm1q3ckVnkpJ7jsZNf3lQFuGp-YJX7QfAG2E5yJIJU62fUI5tNsDvhJD5j9liuz7D6CiZt5dbB4-414yqJW5v4' \
  -H 'content-type: application/json' \
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
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36' \
  --data-raw '{"name":"اتاق دوتخته دبل استاندارد","description":"دارای تخت دبل، مناسب زوج‌ها","capacity":1,"extraCapacity":1,"count":12,"maxChildrenWithoutBed":1}'
```

## update online room count

```bash
curl 'https://whale.lamasoo.com/api/room-type-provider/13860/default-count' \
  -X 'PUT' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: fa' \
  -H 'authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyT3JnYW5pemF0aW9uSWQiOjIwODMwLCJpYXQiOjE3ODM2OTUxMDMsImV4cCI6MTc4Mzc4MTUwM30.XIlPeXg08M983joZPIV_Vqbhw-OTm9qUGnBSVvziU2lUi7IrWumzlb4odxq9lZYMggdvBnY0hjLfg19vU21QiGruhtQvb99Yqb7g-XiTwdUxAxhR5jsZoH2SWyOOHz_RMMKIEPs9SHaqC_fd9-5AyDP_qXdJDJ2UT7tm8OzCKt1EaDmsPeeOJ86pyYsvfluG_MQUUPZC1l3FHyJKGA2LxhtjzsBw7hjd8rK0_tlD5Dt4lmk8nXoGjUDry6-jCjm3vJBOZ7VDGZCY3fTMSE_OzMK6s79ypx3qz5pByKh5rg69CEGWuycgLpqF26ITaa23ET_TX1tgsj2t1XfTwRaDcQ2FIpcQMk_F13nFsReb8NzYGjF4I9aR4QPXlPnciZ2qOMAmjeAkbW1QXOh75KyDy52i1RZB-c57FLN9q3Q0DdIZLRuXPb4JOh42PAdOsxMIB6HSZVALBKbVm1OCRajsyrq2RbL9M4k6A7YQd1JaHi1aYEZ7hjsFzAsZD8wv1OOMB6Yum-qUSOwE6Ki8-m60bMcnuZ6Yhb1kmrknJo2YrkGUT3GYvh07aNZH30T6AD3flH46WwwXyUUYCK9Dfe11HKm1q3ckVnkpJ7jsZNf3lQFuGp-YJX7QfAG2E5yJIJU62fUI5tNsDvhJD5j9liuz7D6CiZt5dbB4-414yqJW5v4' \
  -H 'content-type: application/json' \
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
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36' \
  --data-raw '{"defaultCount":8}'
```

## Create Rate plan

```bash
curl 'https://whale.lamasoo.com/api/rate-plan' \
 -H 'accept: application/json, text/plain, _/_' \
 -H 'accept-language: fa' \
 -H 'authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyT3JnYW5pemF0aW9uSWQiOjIwODMwLCJpYXQiOjE3ODM2OTUxMDMsImV4cCI6MTc4Mzc4MTUwM30.XIlPeXg08M983joZPIV_Vqbhw-OTm9qUGnBSVvziU2lUi7IrWumzlb4odxq9lZYMggdvBnY0hjLfg19vU21QiGruhtQvb99Yqb7g-XiTwdUxAxhR5jsZoH2SWyOOHz_RMMKIEPs9SHaqC_fd9-5AyDP_qXdJDJ2UT7tm8OzCKt1EaDmsPeeOJ86pyYsvfluG_MQUUPZC1l3FHyJKGA2LxhtjzsBw7hjd8rK0_tlD5Dt4lmk8nXoGjUDry6-jCjm3vJBOZ7VDGZCY3fTMSE_OzMK6s79ypx3qz5pByKh5rg69CEGWuycgLpqF26ITaa23ET_TX1tgsj2t1XfTwRaDcQ2FIpcQMk_F13nFsReb8NzYGjF4I9aR4QPXlPnciZ2qOMAmjeAkbW1QXOh75KyDy52i1RZB-c57FLN9q3Q0DdIZLRuXPb4JOh42PAdOsxMIB6HSZVALBKbVm1OCRajsyrq2RbL9M4k6A7YQd1JaHi1aYEZ7hjsFzAsZD8wv1OOMB6Yum-qUSOwE6Ki8-m60bMcnuZ6Yhb1kmrknJo2YrkGUT3GYvh07aNZH30T6AD3flH46WwwXyUUYCK9Dfe11HKm1q3ckVnkpJ7jsZNf3lQFuGp-YJX7QfAG2E5yJIJU62fUI5tNsDvhJD5j9liuz7D6CiZt5dbB4-414yqJW5v4' \
 -H 'content-type: application/json' \
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
 -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36' \
 --data-raw '{"mealType":"RO","name":"test","description":"","currency":"IRR"}'
```

## Delete Rate plan

```bash
curl 'https://whale.lamasoo.com/api/rate-plan/4058' \
  -X 'DELETE' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: fa' \
  -H 'authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyT3JnYW5pemF0aW9uSWQiOjIwODMwLCJpYXQiOjE3ODM2OTUxMDMsImV4cCI6MTc4Mzc4MTUwM30.XIlPeXg08M983joZPIV_Vqbhw-OTm9qUGnBSVvziU2lUi7IrWumzlb4odxq9lZYMggdvBnY0hjLfg19vU21QiGruhtQvb99Yqb7g-XiTwdUxAxhR5jsZoH2SWyOOHz_RMMKIEPs9SHaqC_fd9-5AyDP_qXdJDJ2UT7tm8OzCKt1EaDmsPeeOJ86pyYsvfluG_MQUUPZC1l3FHyJKGA2LxhtjzsBw7hjd8rK0_tlD5Dt4lmk8nXoGjUDry6-jCjm3vJBOZ7VDGZCY3fTMSE_OzMK6s79ypx3qz5pByKh5rg69CEGWuycgLpqF26ITaa23ET_TX1tgsj2t1XfTwRaDcQ2FIpcQMk_F13nFsReb8NzYGjF4I9aR4QPXlPnciZ2qOMAmjeAkbW1QXOh75KyDy52i1RZB-c57FLN9q3Q0DdIZLRuXPb4JOh42PAdOsxMIB6HSZVALBKbVm1OCRajsyrq2RbL9M4k6A7YQd1JaHi1aYEZ7hjsFzAsZD8wv1OOMB6Yum-qUSOwE6Ki8-m60bMcnuZ6Yhb1kmrknJo2YrkGUT3GYvh07aNZH30T6AD3flH46WwwXyUUYCK9Dfe11HKm1q3ckVnkpJ7jsZNf3lQFuGp-YJX7QfAG2E5yJIJU62fUI5tNsDvhJD5j9liuz7D6CiZt5dbB4-414yqJW5v4' \
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
