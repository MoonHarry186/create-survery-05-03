# Quy tắc bảo vệ Airline PII – Masking & Encryption

## 1. Mục đích

Quy định cách **phân loại PII theo 15 loại nghiệp vụ hàng không**, và cách chọn **đúng một** cơ chế bảo vệ trên mỗi trường: **Masking** hoặc **Encryption**.

Không áp dụng đồng thời hai cơ chế trên cùng một trường.

```text
Một trường PII
      │
      ├── Encryption  →  bảo vệ lúc lưu trữ; không đọc được nếu không có key
      └── Masking     →  bảo vệ lúc hiển thị / log / xuất dữ liệu; che một phần hoặc làm thô
```

Khi ghi phiếu khảo sát, mỗi trường PII chỉ điền một giá trị:

```text
Bảo vệ: Masking
```

hoặc

```text
Bảo vệ: Encryption
```

kèm **cách làm** cụ thể (mẫu che, thuật toán, key).

---

## 2. Hai cơ chế — làm như thế nào

### 2.1. Masking — che khi đọc, không sửa giá trị gốc

Masking **không** thay giá trị đang lưu trong database / lake. Giá trị gốc vẫn giữ nguyên (plaintext hoặc đã được bảo vệ bằng mã hóa tầng đĩa/database, không tính là Encryption theo cột).

Masking áp dụng khi:

- hiện trên màn hình
- ghi log
- xuất file
- chia sẻ cho analytics / đối tác / vai trò không cần giá trị đầy đủ

**Ba cách làm:**

| Cách | Khi nào dùng | Làm thế nào |
|---|---|---|
| **Che một phần** | Cần nhận ra loại dữ liệu, không cần đủ ký tự | Giữ vài ký tự đầu và/hoặc cuối; phần giữa thay bằng `*` |
| **Ẩn toàn bộ** | Vai trò không được xem field đó | Thay bằng `********` hoặc `[MASKED]` |
| **Làm thô** | Chỉ cần thống kê, không cần giá trị gốc | Giảm độ chi tiết: ngày → tháng, địa chỉ → tỉnh/thành, số tiền → khoảng |

Mẫu che chuẩn:

| Kiểu dữ liệu | Cách che | Ví dụ |
|---|---|---|
| Họ và tên | Giữ họ; tên/đệm chỉ giữ chữ cái đầu | `Nguyễn Văn An` → `Nguyễn V*** A*` |
| Email | Giữ 1 ký tự đầu phần local; giữ nguyên domain | `abc@gmail.com` → `a**@gmail.com` |
| Số điện thoại | Giữ 3 số đầu và 3 số cuối | `0912345678` → `091****678` |
| Địa chỉ | Che số nhà và tên đường; giữ tỉnh/thành | `12 Nguyễn Huệ, Q.1, HCM` → `*** , Q.1, HCM` |
| Mã PNR / booking | Giữ 3 ký tự đầu | `ABC123` → `ABC***` |
| Số vé | Giữ 3 số cuối | `7381234567890` → `***********890` |
| Số thẻ FFP / hội viên | Giữ 3 số đầu và 2 số cuối | `123456789` → `123****89` |
| Số thẻ hành lý | Giữ 4 số cuối | `7384123456` → `******3456` |
| Số ghế | Che hàng ghế, giữ loại ghế nếu cần thống kê | `12A` → `**A` |
| Ngày sinh / ngày bay | Chỉ giữ năm, hoặc năm-tháng | `1990-05-13` → `1990-05` |
| Thành phố / mã bưu chính | Giữ thành phố; che 3 số cuối mã bưu chính | `700000` → `700***` |
| Số tiền / điểm | Làm tròn hoặc gom khoảng | `1.250.000` → `1.000.000–2.000.000` |

Quy tắc thực hiện:

1. Chọn vai trò được xem **đầy đủ** (ví dụ hệ thống DCS, chăm sóc khách được phân quyền).
2. Mọi vai trò khác chỉ nhận giá trị đã che theo mẫu trên.
3. Log, file xuất, báo cáo, môi trường non-prod **luôn** dùng giá trị đã che.
4. Không ghi đè cột gốc bằng chuỗi đã che.

```text
Cột gốc (lưu)     : 0912345678
Màn hình đại lý   : 091****678
Log / file xuất   : 091****678
Analyst           : không nhận số điện thoại; chỉ nhận tỉnh/thành nếu cần
```

---

### 2.2. Encryption — mã hóa lúc ghi, chỉ giải mã khi có quyền và key

Encryption biến giá trị thành ciphertext **trước khi lưu**. Không có key thì không đọc được nội dung, kể cả khi truy cập được file/bảng.

Dùng Encryption khi giá trị đầy đủ **không được phép tồn tại plaintext** trên lake/database, log, hoặc bản sao.

**Cách làm:**

1. Mã hóa **theo cột** (field-level), không chỉ dựa vào mã hóa cả đĩa.
2. Thuật toán: **AES-256-GCM**.
3. Key do **KMS** quản lý; tách key khỏi dữ liệu; xoay key theo chính sách.
4. Ứng dụng ghi: plaintext → `Encrypt(AES-256-GCM, key)` → lưu ciphertext.
5. Ứng dụng đọc: chỉ service được ủy quyền mới `Decrypt`; không có quyền thì không trả field đó.
6. Không ghi plaintext song song với ciphertext.
7. Không đưa plaintext vào log, metrics, dead-letter, môi trường test.

```text
P12345678
    ↓  AES-256-GCM + key KMS
3A9F...ciphertext...
    ↓  chỉ service có quyền + key
P12345678
```

Với số thẻ thanh toán (Card Number): không lưu PAN đủ. Dùng **tokenization** (PCI DSS) hoặc chỉ lưu 4 số cuối + token; ciphertext/token do hệ thanh toán giữ.

Với ảnh/sinh trắc: mã hóa blob; không generate thumbnail plaintext; màn hình không hiện ảnh gốc cho vai trò không được phép — trả placeholder, không “che một phần” ảnh.

**Không** Masking thêm trên trường đã chọn Encryption: người có quyền thấy đủ giá trị sau decrypt; người không có quyền không thấy field.

---

## 3. Nguyên tắc chọn đúng một cơ chế

Trên mỗi trường, chọn **Encryption** hoặc **Masking**, không chọn cả hai.

```text
Trường có phải PII (15 loại)?
        │
       NO  →  Không áp dụng
        │
       YES
        │
        ▼
Giá trị đầy đủ có được phép nằm plaintext trên lake/DB không?
        │
       NO   →  ENCRYPTION
        │     Giấy tờ tùy thân, thanh toán (số thẻ), sinh trắc,
        │     SSR y tế/khuyết tật/trẻ em, tọa độ/nơi cư trú cụ thể,
        │     hộ chiếu/GPLNV của nhân viên
        │
       YES  →  MASKING
              Họ tên, liên hệ, PNR, số vé, ghế, hành lý, FFP,
              hành trình, sở thích, trạng thái, mã nhân viên
```

Diễn giải:

| Chọn | Điều kiện | Hệ quả |
|---|---|---|
| **Encryption** | Lộ giá trị đầy đủ là rủi ro cao **và** không được lưu plaintext | Cột lưu ciphertext. Join/tìm theo giá trị gốc phải qua service có key (hoặc không cho join trực tiếp). |
| **Masking** | Vẫn cần lưu/dùng giá trị gốc để vận hành (tìm PNR, ghép bảng, hiện cho đại lý) | Cột lưu plaintext. Che khi hiển thị / log / xuất. |

Nếu trường là khóa ghép dữ liệu (PNR, số vé, bag tag): chọn **Masking**, không mã hóa cột — để lake còn join được. Che trên màn hình và file xuất.

Nếu trường là bí mật (hộ chiếu, PAN, vân tay): chọn **Encryption**, không dùng masking — che một phần hộ chiếu vẫn còn rủi ro, và không đủ để bảo vệ lúc lưu.

---

## 4. Mức nhạy cảm

Dùng để giải thích vì sao chọn Encryption hay Masking; **không** phải cơ chế thứ ba.

| Mức | Chọn | Lý do |
|---|---|---|
| Biometric | Encryption | Dữ liệu sinh trắc không được lưu/xem plaintext |
| Sensitive PII | Encryption | Y tế, khuyết tật, trẻ em |
| High-risk giấy tờ / thẻ / tọa độ | Encryption | Lộ là chiếm đoạt danh tính hoặc tài chính |
| Direct / Indirect / Contextual còn lại | Masking | Cần vận hành và hiển thị có kiểm soát |

Khi một trường khớp nhiều loại, chọn mức cao hơn (Biometric → Sensitive → giấy tờ/thẻ → Masking).

---

# 5. Danh mục 15 loại PII — cơ chế và cách làm

Với mỗi loại: liệt kê field, chọn **một** cơ chế, mô tả cách thực hiện.

## 1. Personal Identification — Thông tin định danh cá nhân

**Cơ chế: Masking**

- **Full Name** — Họ và tên hành khách
- **First Name** — Tên của hành khách
- **Last Name** — Họ của hành khách
- **Date of Birth** — Ngày tháng năm sinh của hành khách
- **Gender** — Giới tính của hành khách
- **Nationality** — Quốc tịch của hành khách
- **Place of Birth** — Nơi sinh của hành khách

Cách làm:

| Field | Cách Masking |
|---|---|
| Full Name / First Name / Last Name | Giữ họ; tên và đệm chỉ giữ chữ cái đầu. `Nguyễn Văn An` → `Nguyễn V*** A*` |
| Date of Birth | Làm thô còn năm-tháng. `1990-05-13` → `1990-05`. Báo cáo tuổi dùng nhóm tuổi (`30–39`), không dùng ngày sinh đủ |
| Gender | Giữ mã (`M`/`F`) cho thống kê. Khi xuất danh sách cá nhân kèm họ tên thì ẩn cột này (`[MASKED]`) |
| Nationality | Giữ mã quốc tịch cho thống kê. Khi xuất danh sách cá nhân kèm họ tên thì ẩn |
| Place of Birth | Làm thô còn quốc gia; che tỉnh/huyện/xã |

Lưu đủ giá trị gốc để DCS/PNR vận hành. Che trên UI chăm sóc khách không đủ quyền, log, file xuất, non-prod.

---

## 2. Government / Travel Documents — Giấy tờ tùy thân và giấy tờ du lịch

**Cơ chế: Encryption**

- **Passport Number** — Số hộ chiếu của hành khách
- **National ID / CCCD** — Số căn cước công dân hoặc giấy tờ định danh
- **Visa Number** — Số thị thực của hành khách
- **Travel Document Number** — Số giấy tờ du lịch
- **MRZ** — Vùng dữ liệu đọc bằng máy trên hộ chiếu hoặc giấy tờ du lịch

Cách làm:

1. Trước khi ghi lake/DB: mã hóa AES-256-GCM từng cột; key KMS riêng cho nhóm giấy tờ.
2. MRZ mã hóa cả khối (không tách dòng để “che một phần”).
3. Service DCS/check-in được cấp quyền decrypt khi đối chiếu giấy tờ.
4. Analytics, log, BI, môi trường test: **không** nhận plaintext; không nhận ciphertext để đoán.
5. Không hiện 4 ký tự cuối hộ chiếu trên báo cáo mở — trường này không dùng Masking.

```text
Lưu     : ciphertext
Đọc có quyền : P12345678
Đọc không quyền : (không trả field)
```

---

## 3. Contact Information — Thông tin liên hệ

**Cơ chế: Masking**

- **Email** — Địa chỉ email của hành khách
- **Phone Number** — Số điện thoại của hành khách
- **Address** — Địa chỉ liên hệ hoặc cư trú của hành khách
- **City** — Thành phố liên quan đến địa chỉ của hành khách
- **Postal Code** — Mã bưu chính liên quan đến địa chỉ của hành khách

Cách làm:

| Field | Cách Masking |
|---|---|
| Email | `a**@gmail.com` — giữ 1 ký tự local + domain |
| Phone Number | `091****678` — giữ 3 đầu + 3 cuối |
| Address | Che số nhà và đường; giữ phường/quận/tỉnh nếu cần giao hàng/thống kê |
| City | Giữ nguyên cho thống kê; ẩn khi xuất file danh sách kèm họ tên + địa chỉ |
| Postal Code | `700***` — che 3 số cuối |

---

## 4. Booking / Reservation — Thông tin đặt chỗ

**Cơ chế: Masking**

- **PNR** — Mã hồ sơ đặt chỗ của hành khách
- **Booking Reference** — Mã tham chiếu của đặt chỗ
- **Reservation ID** — Mã định danh của giao dịch đặt chỗ
- **Booking Date** — Ngày tạo đặt chỗ
- **Booking Status** — Trạng thái của đặt chỗ

Cách làm:

| Field | Cách Masking |
|---|---|
| PNR / Booking Reference / Reservation ID | Giữ 3 ký tự đầu: `ABC123` → `ABC***`. Cột gốc giữ đủ để join và tra cứu |
| Booking Date | Làm thô còn ngày hoặc tháng tùy báo cáo: `2026-09-13` → `2026-09` với analytics |
| Booking Status | Giữ mã trạng thái (`HK`, `HL`, …). Không xuất kèm PNR đầy đủ trên file mở |

PNR là khóa vận hành: **không mã hóa cột**, để ghép PNR–vé–DCS.

---

## 5. Ticket / Transaction — Thông tin vé và giao dịch

**Cơ chế: Masking**

- **Ticket Number** — Số vé của hành khách
- **Fare** — Giá vé hoặc mức giá áp dụng cho hành khách
- **Fare Basis** — Mã điều kiện hoặc loại giá vé
- **Ticket Status** — Trạng thái của vé
- **Payment Transaction ID** — Mã giao dịch thanh toán

Cách làm:

| Field | Cách Masking |
|---|---|
| Ticket Number | Giữ 3 số cuối: `***********890` |
| Payment Transaction ID | Giữ 4 ký tự cuối |
| Fare | Làm thô theo khoảng giá; không xuất số tiền đúng trên file kèm họ tên |
| Fare Basis / Ticket Status | Giữ mã; không ghép với họ tên trên báo cáo mở |

---

## 6. Travel / Itinerary — Thông tin hành trình

**Cơ chế: Masking**

- **Travel Date** — Ngày hành khách thực hiện chuyến bay
- **Origin / Destination** — Sân bay điểm đi và điểm đến của hành khách
- **Passenger Itinerary** — Hành trình bay của hành khách
- **Connection Information** — Thông tin các chặng bay nối chuyến
- **Travel History** — Lịch sử hành trình của hành khách

Cách làm:

| Field | Cách Masking |
|---|---|
| Travel Date | Analytics: `2026-09`. Vận hành: giữ ngày |
| Origin / Destination | Giữ mã sân bay cho thống kê chuyến bay. Khi xuất **hành trình của một người**, ẩn họ tên hoặc ẩn chặng |
| Passenger Itinerary / Connection / Travel History | Không xuất toàn bộ lịch sử gắn một hành khách. Làm thô: số chặng, tháng bay, không liệt kê đủ điểm đi–đến theo từng ngày |

Mã sân bay / lịch bay thuần khai thác (không gắn hành khách) **không** phải PII.

---

## 7. Check-in / Boarding — Thông tin làm thủ tục và lên máy bay

**Cơ chế: Masking**, trừ **Boarding Pass Barcode** dùng **Encryption**.

- **Check-in Status** — Trạng thái làm thủ tục của hành khách
- **Boarding Status** — Trạng thái lên máy bay của hành khách
- **Boarding Pass Number** — Số định danh thẻ lên máy bay
- **Boarding Pass Barcode** — Mã vạch hoặc mã QR trên thẻ lên máy bay
- **Seat Number** — Số ghế được phân bổ cho hành khách

Cách làm:

| Field | Cơ chế | Cách làm |
|---|---|---|
| Boarding Pass Barcode | **Encryption** | Mã hóa cột AES-256-GCM. Barcode/QR là chứng từ lên máy bay; không lưu plaintext, không đưa vào log |
| Boarding Pass Number | Masking | Giữ 4 ký tự cuối |
| Seat Number | Masking | `12A` → `**A` trên màn hình/log; vận hành DCS giữ đủ |
| Check-in Status / Boarding Status | Masking | Giữ mã trạng thái; không xuất kèm họ tên trên file mở |

---

## 8. Baggage — Thông tin hành lý

**Cơ chế: Masking**

- **Baggage Tag Number** — Số thẻ hành lý gắn với hành khách
- **Baggage Information** — Thông tin hành lý của hành khách
- **Baggage Weight** — Trọng lượng hành lý của hành khách
- **Baggage History** — Lịch sử xử lý và vận chuyển hành lý

Cách làm:

| Field | Cách Masking |
|---|---|
| Baggage Tag Number | Giữ 4 số cuối: `******3456`. Cột gốc giữ đủ để tra cứu bag |
| Baggage Information | Che số tag và tên chủ bag; giữ số kiện / loại bag cho thống kê |
| Baggage Weight | Làm thô theo khoảng (`0–10 kg`, `10–20 kg`) trên analytics |
| Baggage History | Không xuất timeline đủ gắn một hành khách; giữ sự kiện tổng hợp theo chuyến |

---

## 9. Loyalty / Frequent Flyer — Thông tin khách hàng thân thiết

**Cơ chế: Masking**

- **Frequent Flyer Number** — Số thẻ khách hàng thường xuyên
- **Loyalty ID** — Mã định danh tài khoản khách hàng thân thiết
- **Membership Number** — Số hiệu thẻ hội viên
- **Tier / Membership Status** — Hạng và trạng thái hội viên
- **Points / Miles Balance** — Số điểm hoặc số dặm tích lũy
- **Loyalty Transaction** — Giao dịch phát sinh trong chương trình khách hàng thân thiết
- **Travel History** — Lịch sử hành trình của hội viên

Cách làm:

| Field | Cách Masking |
|---|---|
| Frequent Flyer Number / Loyalty ID / Membership Number | `123****89` — giữ 3 đầu + 2 cuối |
| Loyalty Transaction | Che mã giao dịch, giữ 4 ký tự cuối |
| Travel History | Như loại 6: không xuất đủ lịch sử theo hội viên |
| Tier / Membership Status | Giữ hạng (`Gold`, `Titanium`) cho thống kê |
| Points / Miles Balance | Làm thô theo khoảng điểm |

---

## 10. Payment / Financial — Thông tin thanh toán và tài chính

Chọn theo field — vẫn **một cơ chế trên một trường**.

- **Card Number** — Số thẻ thanh toán
- **Card Holder Name** — Tên chủ thẻ
- **Billing Address** — Địa chỉ thanh toán
- **Payment Information** — Thông tin phương thức và giao dịch thanh toán
- **Payment Transaction** — Thông tin giao dịch thanh toán

| Field | Cơ chế | Cách làm |
|---|---|---|
| Card Number | **Encryption** (ưu tiên token) | Không lưu PAN đủ. Lưu token PCI + 4 số cuối. Nếu phải lưu: AES-256-GCM, key tách, phạm vi PCI |
| Payment Information | **Encryption** | Mã hóa khối thông tin phương thức (số tài khoản, token, CVV **không lưu**). CVV/CVC không được lưu sau khi giao dịch |
| Card Holder Name | **Masking** | Như họ tên: `NGUYEN V*** A*` |
| Billing Address | **Masking** | Như địa chỉ liên hệ |
| Payment Transaction | **Masking** | Che mã giao dịch, giữ 4 ký tự cuối |

---

## 11. Special Service Request (SSR) — Thông tin dịch vụ đặc biệt

**Cơ chế: Encryption** cho thông tin y tế / khuyết tật / trẻ em. **Masking** chỉ khi suất ăn là sở thích, không tiết lộ sức khỏe.

- **Medical Information** — Thông tin y tế hoặc sức khỏe của hành khách
- **Medical SSR** — Yêu cầu dịch vụ đặc biệt liên quan đến tình trạng y tế
- **Wheelchair Request** — Yêu cầu hỗ trợ xe lăn
- **Disability Information** — Thông tin liên quan đến tình trạng khuyết tật
- **Unaccompanied Minor** — Thông tin trẻ vị thành niên đi máy bay một mình
- **Infant Information** — Thông tin trẻ sơ sinh đi cùng hành khách
- **Special Meal** — Yêu cầu suất ăn đặc biệt của hành khách

| Field | Cơ chế | Cách làm |
|---|---|---|
| Medical Information, Medical SSR | **Encryption** | Mã hóa cột/ghi chú y tế. Chỉ module SSR/y tế decrypt. Log ghi `MEDA=[ENCRYPTED]`, không ghi nội dung |
| Wheelchair Request, Disability Information | **Encryption** | Mã hóa mã SSR và mô tả (`WCHR`, ghi chú). Thống kê chỉ dùng số lượng đã mã hóa/tách danh tính |
| Unaccompanied Minor, Infant Information | **Encryption** | Mã hóa tên trẻ, ngày sinh, thông tin người đón |
| Special Meal (y tế / dị ứng / tôn giáo) | **Encryption** | Như Medical SSR |
| Special Meal (chỉ sở thích, ví dụ vegetarian) | **Masking** | Giữ mã suất ăn cho catering; ẩn khi xuất danh sách hành khách |

Khi chưa tách được Special Meal y tế khỏi sở thích: chọn **Encryption**.

---

## 12. Biometric — Thông tin sinh trắc học

**Cơ chế: Encryption**

- **Face Image** — Hình ảnh khuôn mặt của hành khách
- **Face Template** — Mẫu dữ liệu sinh trắc học khuôn mặt
- **Fingerprint** — Dữ liệu dấu vân tay
- **Iris Data** — Dữ liệu sinh trắc học mống mắt
- **Biometric Identifier** — Mã hoặc định danh sinh trắc học

Cách làm:

1. Mã hóa blob/template bằng AES-256-GCM; key KMS riêng, truy cập rất hẹp.
2. Không lưu bản sao plaintext, không cache ảnh gốc trên client.
3. UI không quyền: hiện placeholder, **không** che mờ ảnh gốc (che mờ không phải Encryption và vẫn rò rỉ).
4. Thêm: hạn chế ai được gọi decrypt, ghi audit từng lần đọc, xóa theo thời hạn lưu, không dùng dữ liệu này cho analytics.

---

## 13. Communication & Preference — Thông tin liên lạc và sở thích

**Cơ chế: Masking**

- **Language Preference** — Ngôn ngữ ưu tiên của hành khách
- **Communication Preference** — Sở thích về phương thức liên lạc
- **Notification Preference** — Sở thích về phương thức nhận thông báo
- **Meal Preference** — Sở thích hoặc lựa chọn suất ăn
- **Seat Preference** — Sở thích về vị trí hoặc loại ghế

Cách làm:

| Field | Cách Masking |
|---|---|
| Language / Communication / Notification Preference | Giữ mã (`VI`, `EMAIL`) cho vận hành. Khi xuất hồ sơ cá nhân mở thì ẩn các lựa chọn gắn với người đó |
| Meal Preference | Như Special Meal sở thích: giữ mã suất ăn; nếu tiết lộ y tế/tôn giáo → chuyển loại 11 và **Encryption** |
| Seat Preference | Giữ loại ghế (`WINDOW`) cho thống kê; ẩn khi xuất kèm họ tên |

---

## 14. Location Information — Thông tin vị trí

Chọn theo field — một cơ chế trên một trường.

- **Residential Location** — Thông tin vị trí nơi cư trú của hành khách
- **Travel Location** — Thông tin vị trí liên quan đến hành trình
- **Airport / Location History** — Lịch sử sân bay hoặc vị trí của hành khách
- **Geolocation** — Dữ liệu vị trí địa lý của hành khách

| Field | Cơ chế | Cách làm |
|---|---|---|
| Residential Location (địa chỉ / tọa độ nhà) | **Encryption** | Mã hóa địa chỉ đầy đủ hoặc tọa độ cư trú. Analytics chỉ nhận tỉnh/thành do hệ thống xuất đã làm thô **sau** decrypt trong service được phép |
| Geolocation | **Encryption** | Mã hóa lat/long. Không log tọa độ. Nếu cần bản đồ: service decrypt rồi làm thô còn grid/tỉnh trước khi trả ra |
| Travel Location | **Masking** | Làm thô còn mã sân bay hoặc thành phố; không kèm timestamp đủ |
| Airport / Location History | **Masking** | Không xuất chuỗi sân bay theo thời gian gắn một người; thống kê theo chuyến / theo ngày |

Vị trí gate / stand thuần khai thác chuyến bay **không** phải PII.

---

## 15. Employee / Crew Personal Data — Thông tin cá nhân của nhân viên và tổ bay

Chọn theo field — một cơ chế trên một trường. Cùng cách làm với field hành khách tương đương.

- **Employee ID** — Mã định danh nhân viên
- **Employee Name** — Họ và tên nhân viên
- **Employee Contact** — Thông tin liên hệ của nhân viên
- **Passport / ID** — Hộ chiếu hoặc giấy tờ định danh của nhân viên
- **Crew ID** — Mã định danh thành viên tổ bay
- **License Number** — Số giấy phép/chứng chỉ chuyên môn
- **Emergency Contact** — Thông tin người liên hệ khẩn cấp

| Field | Cơ chế | Cách làm |
|---|---|---|
| Employee Name | **Masking** | Như Full Name |
| Employee Contact | **Masking** | Như Email / Phone |
| Emergency Contact | **Masking** | Che tên và số điện thoại người thân theo mẫu họ tên + điện thoại |
| Employee ID / Crew ID | **Masking** | Giữ 3 ký tự đầu: `E12345` → `E12***`. Giữ gốc để phân ca / roster |
| Passport / ID | **Encryption** | Như loại 2 |
| License Number | **Encryption** | AES-256-GCM; chỉ hệ thống bằng lái/huấn luyện decrypt |

Không hạ mức bảo vệ chỉ vì chủ thể là nhân viên nội bộ.

---

# 6. Bảng chọn nhanh

| # | Loại PII | Cơ chế | Ghi chú |
|---|---|---|---|
| 1 | Thông tin định danh cá nhân | Masking | Che họ tên; làm thô ngày sinh |
| 2 | Giấy tờ tùy thân và giấy tờ du lịch | Encryption | AES-256-GCM + KMS |
| 3 | Thông tin liên hệ | Masking | Email / điện thoại / địa chỉ theo mẫu |
| 4 | Thông tin đặt chỗ | Masking | PNR giữ 3 ký tự đầu khi hiện; lưu đủ để join |
| 5 | Thông tin vé và giao dịch | Masking | Số vé giữ 3 số cuối |
| 6 | Thông tin hành trình | Masking | Làm thô ngày; không xuất đủ lịch sử theo người |
| 7 | Làm thủ tục và lên máy bay | Masking | **Ngoại lệ:** Boarding Pass Barcode = Encryption |
| 8 | Thông tin hành lý | Masking | Tag giữ 4 số cuối |
| 9 | Khách hàng thân thiết | Masking | FFP giữ 3 đầu + 2 cuối |
| 10 | Thanh toán và tài chính | Encryption hoặc Masking | Số thẻ / thông tin thanh toán = Encryption; tên chủ thẻ / địa chỉ bill / mã giao dịch = Masking |
| 11 | Dịch vụ đặc biệt (SSR) | Encryption | Ngoại lệ: suất ăn chỉ là sở thích = Masking |
| 12 | Sinh trắc học | Encryption | Không che mờ ảnh thay cho mã hóa |
| 13 | Liên lạc và sở thích | Masking | Nếu suất ăn tiết lộ y tế → loại 11 Encryption |
| 14 | Thông tin vị trí | Encryption hoặc Masking | Nhà / GPS = Encryption; lịch sử sân bay = Masking |
| 15 | Nhân viên và tổ bay | Masking hoặc Encryption | Tên/liên hệ/mã NV = Masking; hộ chiếu/GPLNV = Encryption |

Phiếu khảo sát:

```text
Bảo vệ: Masking
Cách làm: Điện thoại giữ 3 số đầu và 3 số cuối. Ví dụ 091****678
```

```text
Bảo vệ: Encryption
Cách làm: AES-256-GCM theo cột; key KMS; không lưu plaintext; không log
```

---

# 7. Thứ tự quyết định

```text
                 Trường dữ liệu
                       │
                       ▼
              Có thuộc 15 loại PII?
                  │           │
                 YES          NO → Không áp dụng
                  │
                  ▼
     Giấy tờ / số thẻ / sinh trắc /
     SSR nhạy cảm / GPS / nơi cư trú /
     GPLNV / barcode thẻ lên máy bay?
                  │           │
                 YES          NO
                  │            │
                  ▼            ▼
            ENCRYPTION     MASKING
            (lúc ghi)      (lúc đọc / log / xuất)
```

Ngoại lệ đã liệt kê ở mục 5 (Barcode, Special Meal sở thích, Card Holder Name, …) thắng mặc định của cả loại.

---

# 8. Analytics / Data Lake

Không phải PII nào cũng đưa vào lake dạng dùng được để nhận diện người.

Thứ tự ưu tiên khi làm báo cáo:

```text
Không lấy field
    ↓
Làm thô / gom nhóm  (Masking)
    ↓
Che một phần        (Masking)
```

Không dùng Encryption để “che” cho analyst: analyst không có key thì field vô nghĩa; có key thì thấy đủ — trái mục đích. Dữ liệu Encryption **không** đưa vào dataset analytics, trừ bản đã làm thô do service được phép xuất.

Ví dụ: thay vì đưa họ tên + ngày bay + thành phố, chỉ đưa:

```text
City
TravelMonth
PassengerCount
```

---

# 9. Quy tắc mặc định

Khi chưa đánh giá xong use case:

```text
Loại 1, 3, 4, 5, 6, 8, 9, 13     → Masking
Loại 2, 11, 12                   → Encryption
Loại 7                           → Masking; Barcode → Encryption
Loại 10                          → Card Number / Payment Information → Encryption;
                                   field còn lại → Masking
Loại 14                          → Nhà / GPS → Encryption; lịch sử di chuyển → Masking
Loại 15                          → Hộ chiếu / GPLNV → Encryption; field còn lại → Masking
Non-PII                          → Không áp dụng
```

**Nguyên tắc cuối cùng:**

> Mỗi trường PII chỉ chọn một cơ chế. Chưa rõ thì chọn mức chặt hơn: giấy tờ, y tế, sinh trắc, thẻ, tọa độ → Encryption; còn lại → Masking theo mẫu, không xuất giá trị đủ.
