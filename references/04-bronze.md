# Quy ước thiết kế tầng Bronze

> Dùng chung mọi nguồn. Template bảng: [`../02-bronze/_template/bang.md`](../02-bronze/_template/bang.md). Quy trình: [`03-quy-trinh-thiet-ke.md`](03-quy-trinh-thiet-ke.md).

## 1. Triết lý

- Bản sao **1-1** bảng nguồn trong phạm vi: cùng cột, cùng giá trị nghiệp vụ.
- Chỉ quy đổi kiểu → **Oracle AI Database 26ai**, thêm 6 cột `BRONZE_*`, áp dụng ACL/PII theo catalog — **không** mã hoá cột trên Bronze; **không** nạp bí mật xác thực.
- Chất lượng nghiệp vụ **không** sửa trên Bronze (QTDL: sửa tại nguồn).
- Mỗi quyết định thiết kế (kiểu nạp, rotate, partition…) ghi *Căn cứ* + *Trạng thái* (`Đề xuất` · `Đã chốt`).

## 2. Cấu trúc thư mục đầu ra

```text
02-bronze/
└── {DATA_SOURCE}/          VD: NETLINE · TIMS · MRO · CLM
    └── {NHOM}/             mã nhóm chức năng (khớp 01-tong-quan)
        └── {BẢNG_BRONZE}.md
```

Tên bảng Bronze: `{DATA_SOURCE}_{DB}_{SCHEMA}_{TABLE}` (CHỮ HOA).

### 1.2. Quy ước đặt tên

| Đối tượng | Quy tắc | Ví dụ |
| --------- | ------- | ----- |
| Mã nguồn `{DATA_SOURCE}` | CHỮ HOA, không dấu, ≤ 10 ký tự — cố định từ lần tạo bảng Bronze đầu | `NETLINE` · `TIMS` · `MRO` · `CLM` |
| File tổng quan nguồn | Một file / hệ thống | `01-tong-quan/{HE-THONG}-tong-quan.md` |
| File bảng Bronze | Một file / bảng | `02-bronze/{DATA_SOURCE}/{NHOM}/{BẢNG_BRONZE}.md` |
| Bảng Bronze | `{DATA_SOURCE}_{DB}_{SCHEMA}_{TABLE}` CHỮ HOA | `NETLINE_SCHEDOPS_SCHEDOPS_LEG` |
| Cột Bronze | Tên nguồn CHỮ HOA; trùng từ khoá Oracle / `BRONZE_*` → thêm `_` | `NUMBER` → `NUMBER_` |
| Cột kỹ thuật | Tiền tố `BRONZE_` — luôn thêm 6 cột cuối file 03 | `BRONZE_INGEST_TS` … |

### 1.3. Cách điền

1. Điền **file 05.1**: INF → tóm tắt / domain → DB · schema · ERD · nhóm · thuật ngữ → **inventory** (mọi bảng cần khảo sát) → vấn đề mở. Bổ sung `DOM-CUSTOM` trên file này (mục 3) nếu hệ thống có enum riêng.
2. Với **mỗi dòng inventory** (cần khảo sát): copy file 05.3, đổi tên `{schema}.{ten-bang}`, điền Identity + từ điển cột + CDC/SCD + cấu hình nạp. **Cuối bảng bắt buộc 6 cột `BRONZE_*`.**
3. Tra mã / quy tắc ở **mục 3** file hướng dẫn này — không lặp hướng dẫn dài trong file 05.3.
4. Không ghi mật khẩu / secret. Không copy dữ liệu thật. Ô chưa biết → `Chưa rõ`. Không áp dụng → `N/A`. Protection không khác mức bảng → `theo bảng`.

### 1.4. Quy ước giá trị ô (file 01 inventory · file 03)

| Giá trị | Ý nghĩa |
| ------- | ------- |
| Loại | `table` · `view` |
| Loại nghiệp vụ | `master` · `transaction` · `snapshot` · `history` · `audit` · `other` |
| Kiểu nạp | `full` · `incremental` · `cdc` · `Theo mặc định` |
| Rotate | `Không` · `N ngày` · `Theo mặc định` |
| Trạng thái xác nhận | `Chưa xác nhận` · `Đã xác nhận` · `Cần làm rõ` |
| Trạng thái thiết kế Bronze | `Đề xuất` · `Đã chốt` |
| `N/A` · `Chưa rõ` · `theo bảng` | Không áp dụng · chưa hỏi được · Protection theo mức bảng |

### 1.5. CDC và SCD (khi điền file 03)

**CDC** (DBA): cách nhận biết thay đổi từng bảng — log CDC · watermark · trigger/audit · full.  
**SCD** (SME): cần lịch sử thuộc tính thế nào — SCD1 ghi đè · SCD2 giữ phiên bản · snapshot.  
Đánh mã vai trò cột (`CDC-WM` · `CDC-SD` · `SCD2`…) trên bảng điền file 03; danh mục ở mục 3.7.

| Cách nhận biết thay đổi | Bắt hard delete? | Lưu ý |
| ----------------------- | ---------------- | ----- |
| CDC từ log DB | Có | Cần quyền đọc log (phiếu 02); bảng có khóa nhận diện dòng |
| Cột watermark | Không | Hỏi cập nhật Insert+Update, do DB hay app |
| Trigger / bảng audit | Có (nếu bắt delete) | Hỏi tên bảng audit |
| Full | Có (qua so khớp) | Bảng nhỏ / master |

### 1.6. Bronze — quy tắc mức bảng (tóm tắt)

| Quy tắc | Nội dung |
| ------- | -------- |
| Bản sao 1-1 | Mỗi bảng nguồn trong phạm vi → một bảng Bronze, cùng cột, cùng giá trị |
| Kiểu nạp `full` / `incremental` / `cdc` | Full = chép lại mỗi lô · Incremental = watermark · CDC = log |
| Rotate | Chỉ history / transaction lớn; master = Không |
| Chuỗi → Kiểu dữ liệu Bronze | `ceil(n × 1,2)` — VD 50→60 · 1→2. Đích Oracle AI Database 26ai |
| Boolean / JSON / UUID | `BOOLEAN` · `JSON` · binary UUID → `RAW(16)` |
| PII trên Bronze | Plaintext + ACL; không mã hoá cột; bí mật xác thực không nạp |

---


## 3. Danh mục dùng khi điền phiếu 05.3

*Tra cứu khi điền file 03. File 03 không lặp nội dung này.*

### 3.1. Cột trên bảng điền file 03

| Nhóm | Cột | Gồm |
| ---- | --- | ---- |
| Định danh + Bronze | Tên cột · Cột Bronze · Kiểu dữ liệu nguồn · Kiểu dữ liệu Bronze | Ánh xạ nguồn → Bronze |
| Completeness | Mô tả · Mặc định · Dữ liệu mẫu · Bắt buộc nghiệp vụ · Công thức tính |  |
| 1. Quality | 1.2 … 1.11 | Format · Length · Range · Domain · Allow Null · Unique · RI · Consistency · Accuracy · Timeliness |
| CDC/SCD | CDC/SCD | Mã mục 3.7 |
| 2. Protection | 2.1 … 2.6 | MSK · ENC · AC · Classification · ANON · PSEU |
| Khác | Khác nguồn · Xác nhận · Ghi chú |  |
| Governance | Chỉ Identity file 03 | Retention · Lifecycle · Owner · Steward · Usage |

### 3.2. Loại PII (cột 2.4)

| # | Loại PII | Ví dụ cột |
| - | -------- | --------- |
| 1 | Thông tin định danh cá nhân | Họ tên, ngày sinh, giới tính, quốc tịch |
| 2 | Giấy tờ tùy thân và giấy tờ du lịch | Hộ chiếu, CCCD, visa, MRZ |
| 3 | Thông tin liên hệ | Email, điện thoại, địa chỉ |
| 4 | Thông tin đặt chỗ | PNR, booking reference |
| 5 | Thông tin vé và giao dịch | Số vé, giá vé, fare basis |
| 6 | Thông tin hành trình | Ngày bay, điểm đi/đến |
| 7 | Thông tin làm thủ tục và lên máy bay | Check-in, boarding, ghế |
| 8 | Thông tin hành lý | Thẻ hành lý, trọng lượng |
| 9 | Thông tin khách hàng thân thiết | FFP, hạng, dặm |
| 10 | Thông tin thanh toán và tài chính | Số thẻ, chủ thẻ |
| 11 | Thông tin dịch vụ đặc biệt (SSR) | SSR y tế, xe lăn… |
| 12 | Thông tin sinh trắc học | Khuôn mặt, vân tay |
| 13 | Thông tin liên lạc và sở thích | Ngôn ngữ, sở thích |
| 14 | Thông tin vị trí | Cư trú, tọa độ |
| 15 | Thông tin cá nhân nhân viên / tổ bay | Mã NV, hộ chiếu tổ bay |

### 3.3. Domain `DOM-*` (cột 1.5)

| Mã | Domain | Ví dụ cột |
| -- | ------ | --------- |
| `DOM-AIRPORT` | Sân bay IATA/ICAO | `DEP`, `ARR` |
| `DOM-AIRLINE` | Hãng HK | `CARRIER` |
| `DOM-FLT-NO` | Số hiệu chuyến | `FLT_NO` |
| `DOM-FLT-STATUS` | Trạng thái chuyến | `STATUS` |
| `DOM-AC-TYPE` | Loại tàu bay | `AC_TYPE` |
| `DOM-AC-REG` | Đăng ký tàu | `AC_REG` |
| `DOM-CABIN` | Cabin | `CABIN` |
| `DOM-FARE` | Fare / RBD | `FARE_BASIS` |
| `DOM-PNR` | PNR | `PNR` |
| `DOM-TICKET` | Vé | `TKT_NO` |
| `DOM-SSR` | SSR | `SSR_CODE` |
| `DOM-FFP` | FFP | `FFP_NO` |
| `DOM-PAX-DOC` | Giấy tờ HK | `DOC_TYPE` |
| `DOM-COUNTRY` | Quốc gia ISO | `NATIONALITY` |
| `DOM-CURRENCY` | Tiền tệ ISO | `CURRENCY` |
| `DOM-CITY` | Thành phố | `CITY` |
| `DOM-STAFF` | Nhân viên / tổ bay | `STAFF_NO` |
| `DOM-CREW-ROLE` | Vai trò tổ bay | `CREW_ROLE` |
| `DOM-DELAY` | Mã chậm chuyến | `DELAY_CODE` |
| `DOM-PART` | Part MRO | `PARTNO` |
| `DOM-WO-STATUS` | WO status MRO | `WO_STATUS` |
| `DOM-CUSTOM` | Enum riêng — liệt kê ở Ghi chú |  |
| `N/A` | Không domain |  |

### 3.4. Masking `MSK-*` · Encryption `ENC-*`

| Mã | Mức | Mã | Mức |
| -- | --- | -- | --- |
| `MSK-L0` | Không che | `ENC-L0` | Không mã hoá cột |
| `MSK-L1` | Che nhẹ | `ENC-L1` | In-transit |
| `MSK-L2` | Che mạnh | `ENC-L2` | At-rest |
| `MSK-L3` | Che toàn bộ | `ENC-L3` | Cột |
| `MSK-L4` | Synthetic | `ENC-L4` | Vault / PCI |
| `N/A` | Không áp dụng | `N/A` | Không áp dụng |

### 3.5. Access `AC-*` (nhiều mã cách `;`)

| Mã | Vai trò | Mã | Vai trò |
| -- | ------- | -- | ------- |
| `AC-DO` | Data Owner | `AC-TECH` | MRO |
| `AC-DS` | Data Steward | `AC-HR` | HR / roster |
| `AC-CUST` | Custodian | `AC-FIN` | Tài chính |
| `AC-SO` | System Owner | `AC-FFP` | FFP |
| `AC-CONS` | Consumer | `AC-SAFETY` | An toàn |
| `AC-OPS` | Khai thác | `AC-ATTT` | ATTT |
| `AC-COMM` | Thương mại | `AC-DPO` | DPO |
| `AC-SVC` | Dịch vụ HK | `AC-AI` | AI Owner |
| `AC-DENY-BI` | Cấm BI self-service | `theo bảng` | Theo mức bảng |

### 3.6. Anonymization `ANON-*` · Pseudonymization `PSEU-*`

| Mã | Cách | Mã | Cách |
| -- | ---- | -- | ---- |
| `ANON-DROP` | Loại bỏ cột | `PSEU-TOKEN` | Token |
| `ANON-GEN` | Generalize | `PSEU-HASH` | Hash |
| `ANON-SUP` | Suppression | `PSEU-HASH-SALT` | Hash + salt |
| `ANON-NOISE` | Noise | `PSEU-ENCRYPT-ID` | Encrypt ID |
| `ANON-SWAP` | Swap | `PSEU-FORMAT` | Format-preserving |
| `ANON-AGG` | Aggregate | `N/A` | Không |
| `N/A` | Không |  |  |

### 3.7. CDC / SCD — vai trò cột

| Mã | Vai trò |
| -- | ------- |
| `CDC-WM` | Watermark |
| `CDC-SD` | Soft delete |
| `CDC-KEY` | Khóa CDC (khác PK/BK) |
| `SCD-FROM` · `SCD-TO` | Hiệu lực từ / đến |
| `SCD-VER` · `SCD-CUR` | Phiên bản · cờ hiện hành |
| `SCD-BIZ-DT` | Ngày hiệu lực NV |
| `SCD2` | Thuộc tính cần lịch sử |
| `N/A` | Không |

### 3.8. Sáu cột kỹ thuật Bronze (bắt buộc cuối file 03)

| Cột Bronze | Kiểu dữ liệu Bronze | Ghi chú khi điền |
| ---------- | ------------------- | ---------------- |
| `BRONZE_INGEST_TS` | `TIMESTAMP(6)` (UTC) | Tên cột nguồn = `—` · Khác nguồn = `Cột kỹ thuật` · Allow Null = N |
| `BRONZE_SOURCE_SYSTEM` | `VARCHAR2(30 CHAR)` | Mã `{DATA_SOURCE}` |
| `BRONZE_SOURCE_OBJECT` | `VARCHAR2(400 CHAR)` | `{DB}.{schema}.{bảng}` |
| `BRONZE_BATCH_ID` | `VARCHAR2(64 CHAR)` |  |
| `BRONZE_OP` | `CHAR(1)` | `I` / `U` |
| `BRONZE_SOURCE_TS` | `TIMESTAMP(6)` | Allow Null = Y nếu không CDC |

### 3.9. Quy đổi kiểu nguồn → Bronze (Oracle AI Database 26ai)

*Đích = **Oracle AI Database 26ai** (tương thích 23ai/26ai). `COMPATIBLE` ≥ `23.0.0`. Character set đề xuất `AL32UTF8`. `MAX_STRING_SIZE=EXTENDED` → `VARCHAR2` / `NVARCHAR2` / `RAW` tới 32.767 byte; `STANDARD` → 4.000 / 2.000 byte. Điền cột *Kiểu dữ liệu Bronze* trên file 03 theo bảng dưới; rủi ro ghi *Khác nguồn*.*

**Quy tắc length chuỗi:** mọi kiểu chuỗi có giới hạn độ dài trên nguồn → length Bronze = `ceil(n × 1,2)`. Sau nhân 1,2 nếu vượt trần `VARCHAR2` theo `MAX_STRING_SIZE` → `CLOB`. Text / `CLOB` nguồn: không nhân 1,2.

| Nguồn (length `n`) | `n × 1,2` | Length Bronze |
| ------------------ | --------- | ------------- |
| 50 | 60 | 60 |
| 10 | 12 | 12 |
| 3 | 3,6 | **4** |
| 1 | 1,2 | **2** |

| Nhóm kiểu | PostgreSQL | SQL Server | MySQL / MariaDB | Oracle nguồn | Kiểu dữ liệu Bronze (26ai) | Lưu ý |
| --------- | ---------- | ---------- | --------------- | ------------ | -------------------------- | ----- |
| Số nguyên | `smallint` · `integer` · `bigint` | `tinyint` · `smallint` · `int` · `bigint` | `tinyint`…`bigint` (kể cả `UNSIGNED`) | `NUMBER(p)` | `NUMBER(p)` theo độ lớn: `tinyint`→`NUMBER(3)` · `int`→`NUMBER(10)` · `bigint`→`NUMBER(19)` | `BIGINT UNSIGNED` → `NUMBER(20)`; precision tối đa 38 |
| Số thập phân | `numeric(p,s)` · `money` | `decimal(p,s)` · `numeric` · `money` | `decimal(p,s)` | `NUMBER(p,s)` | `NUMBER(p,s)` | Không khai precision → `NUMBER`; > 38 chữ số → vấn đề mở |
| Số thực | `real` · `double precision` | `real` · `float` | `float` · `double` | `BINARY_FLOAT` · `BINARY_DOUBLE` | `BINARY_DOUBLE` (ưu tiên) · `BINARY_FLOAT` nếu nguồn single-precision | Không đổi sang `NUMBER` (tránh làm tròn khác nguồn) |
| Logic / boolean | `boolean` | `bit` | `tinyint(1)` · `boolean` | — | **`BOOLEAN`** | Native 23ai/26ai. `bit` / `tinyint(1)`: 0→`FALSE`, ≠0→`TRUE` |
| Chuỗi ngắn | `varchar(n)` · `char(n)` | `varchar(n)` · `nvarchar(n)` | `varchar(n)` · `char(n)` | `VARCHAR2` · `CHAR` | `VARCHAR2(ceil(n × 1,2) CHAR)` | VD `varchar(50)`→`VARCHAR2(60 CHAR)` · `CHAR(1)`→`VARCHAR2(2 CHAR)`. `NVARCHAR2` chỉ khi nguồn Unicode riêng và charset DB ≠ `AL32UTF8`. Oracle lưu `''` thành **NULL** |
| Chuỗi dài / text | `text` | `varchar(max)` · `nvarchar(max)` · `text` | `text` · `mediumtext` · `longtext` | `CLOB` · `LONG` | `CLOB` | Không nhân 1,2. Nguồn `LONG` → `CLOB` (không dùng `LONG` trên Bronze) |
| Ngày | `date` | `date` | `date` | `DATE` | `DATE` | MySQL `0000-00-00` → NULL + vấn đề mở |
| Timestamp không TZ | `timestamp(p)` | `datetime` · `datetime2(p)` | `datetime(p)` · `timestamp` | `TIMESTAMP(p)` | `TIMESTAMP(p)` | Không đổi múi giờ ở Bronze; ghi múi giờ nguồn ở *Ghi chú* / *Khác nguồn* |
| Timestamp có TZ | `timestamptz` | `datetimeoffset` | — | `TIMESTAMP WITH TIME ZONE` | `TIMESTAMP(p) WITH TIME ZONE` | Giữ offset |
| Nhị phân | `bytea` | `varbinary` · `image` | `binary` · `blob` | `RAW` · `BLOB` | `RAW(ceil(n × 1,2))` nếu `n` nhỏ · `BLOB` nếu lớn / unbounded | Trần `RAW`: 2.000 (`STANDARD`) / 32.767 (`EXTENDED`) |
| UUID | `uuid` | `uniqueidentifier` | `char(36)` · `binary(16)` | `RAW(16)` | Binary 16 byte → **`RAW(16)`** · chuỗi 36 → `VARCHAR2(44 CHAR)` | 26ai có `UUID()` trả `RAW(16)` — **không** có kiểu cột `UUID` riêng |
| JSON | `json` · `jsonb` | — | `json` | `JSON` | **`JSON`** | Native JSON (OSON) 26ai — thay `CLOB` + `IS JSON`. Không flatten |
| XML | `xml` | `xml` | — | `XMLTYPE` | `XMLTYPE` | Giữ nguyên bản |
| Vector / embedding | — | — | — | `VECTOR` | **`VECTOR`** | Native AI Vector Search 26ai — chỉ khi nguồn là embedding |
| Spatial | `geometry` · PostGIS | `geography` · `geometry` | `geometry` | `SDO_GEOMETRY` | `SDO_GEOMETRY` | Không parse được → `CLOB` text + *Khác nguồn* |
| Kiểu riêng (array, enum, set, object…) | `array` · `enum` | `hierarchyid` · … | `enum` · `set` | object type | `VARCHAR2(ceil(n × 1,2) CHAR)` / `CLOB` · hoặc `JSON` nếu đã là JSON | Enum → chuỗi (áp dụng 1,2). Ghi từng cột ở *Khác nguồn* |
| Tự tăng / rowversion | `serial` · `identity` | `identity` · `rowversion` | `auto_increment` | `identity` | Giữ giá trị: `NUMBER` · `rowversion` → `RAW(8)` | **Không** tạo `IDENTITY` / sequence trên Bronze |

**Giới hạn Oracle 26ai:** tối đa 1.000 cột / bảng · tên định danh tới 128 byte · `NUMBER` ≤ 38 chữ số · `''` → NULL trên chuỗi.

---
