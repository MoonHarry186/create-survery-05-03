---
name: create-survery-05-03
description: Tạo mới workbook Survey 05 Bronze từ DDL và nguồn mô tả theo template META, COL, CDC và LOAD; giữ nguyên nguồn, ghi rõ căn cứ và trạng thái thiết kế.
metadata:
  short-description: Tạo workbook Survey 05 Bronze từ DDL
---

# Tạo workbook Survey 05 Bronze từ DDL

Skill này dùng khi người dùng yêu cầu tạo mới một hoặc nhiều workbook theo template `assets/survey-05-phan-tich-du-lieu-03-danh-sach-field-template.xlsx` cho từng bảng hoặc view. Kết quả là metadata của bảng nguồn và ánh xạ sang bảng Bronze theo reference [`references/04-bronze.md`](references/04-bronze.md).

Đây là workflow tạo mới. Không dùng workbook đã có dữ liệu làm nguồn để sửa, không sao chép dữ liệu từ output cũ và không ghi đè template, DDL, mẫu dữ liệu hoặc tài liệu nguồn.

## Cấu trúc skill

```text
create-survery-05-03/
├── SKILL.md
├── scripts/
│   └── create_survey_workbooks.mjs
├── assets/
│   └── survey-05-phan-tich-du-lieu-03-danh-sach-field-template.xlsx
├── sources/
│   ├── DDL-REVERA-revera-owner.sql
│   ├── DDL-REVERA-apex-owner-APEX.sql
│   └── DDL-2filethieu-- IIPS_OWNER.TTPIC_BILLING_AUDIT_T.sql
├── references/
│   ├── 04-bronze.md
│   ├── logic-pii.md
│   ├── semantic-field-description.md
│   └── Quy tắc bảo vệ Airline PII - Masking & Encryption.md
└── outputs/
    ├── batch-report.md
    ├── file-review-checkpoint.txt
    └── inspect/
```

`references/04-bronze.md` là reference bắt buộc và là nguồn chuẩn cho tên bảng Bronze, sáu cột kỹ thuật, catalog quality/protection, CDC/SCD, quy tắc `ceil(n × 1,2)` và quy đổi kiểu sang Oracle AI Database 26ai. Các reference khác chỉ được dùng khi có trong phạm vi input hoặc được người dùng chỉ định; khi mâu thuẫn phải giữ riêng bằng chứng và ghi OQ, không tự chọn.

## Template mới phải được tuân thủ

Template hiện tại có đúng bốn sheet:

| Sheet | Vai trò |
|---|---|
| `00-META` | Identity và governance ở mức bảng |
| `01-COL` | Từ điển cột nguồn, ánh xạ Bronze, quality và protection |
| `02-CDC` | Chi tiết CDC/SCD |
| `03-LOAD` | Cấu hình nạp Bronze, căn cứ và trạng thái quyết định |

Không dùng các tên sheet cũ như `01-GUIDE`, `02-ID`, `03-COLUMNS`, `04-CDC-SCD`, `05-LOAI-PII`. Không thêm sheet mới và không lấy contract cũ 16 cột làm contract hiện tại.

Sheet `01-COL` dùng vùng `A:AD`, header ở dòng 5 và dữ liệu bắt đầu từ dòng 6:

| Cột | Header |
|---|---|
| A | STT |
| B | Tên cột |
| C | Cột Bronze |
| D | Kiểu dữ liệu nguồn |
| E | Kiểu dữ liệu Bronze |
| F | Mô tả |
| G | Mặc định |
| H | Dữ liệu mẫu |
| I | Bắt buộc nghiệp vụ |
| J | Công thức tính |
| K | 1.2 Format |
| L | 1.3 Length |
| M | 1.4 Range |
| N | 1.5 Domain |
| O | 1.6 Allow Null |
| P | 1.7 Unique |
| Q | 1.8 RI |
| R | 1.9 Consistency |
| S | 1.10 Accuracy |
| T | 1.11 Timeliness |
| U | CDC/SCD |
| V | 2.1 Masking |
| W | 2.2 Encryption |
| X | 2.3 Access |
| Y | 2.4 Classification |
| Z | 2.5 Anonymization |
| AA | 2.6 Pseudonymization |
| AB | Khác nguồn |
| AC | Xác nhận |
| AD | Ghi chú |

Template có sẵn sáu dòng kỹ thuật `BRONZE_*` ở cuối vùng mẫu. Các dòng này luôn phải nằm sau toàn bộ cột nguồn, không được tính là cột nguồn và không được bỏ đi.

## Input và phạm vi

Input tối thiểu:

1. Template bundled tại `assets/survey-05-phan-tich-du-lieu-03-danh-sach-field-template.xlsx`.
2. Reference `references/04-bronze.md`.
3. Một hoặc nhiều DDL có block `CREATE TABLE` hoặc `CREATE VIEW`.
4. Danh sách object cần tạo. Chỉ dùng `--all` khi người dùng yêu cầu toàn bộ DDL; không tự xử lý toàn bộ file vì file có nhiều object.

Input bổ sung có thể gồm data dictionary, comment DDL, tài liệu domain, mẫu dữ liệu đã che, tài liệu PII/ACL, xác nhận DBA/SME và metadata `{DATA_SOURCE}`, `{DB}`, `{NHOM}`. Nếu thiếu metadata không thể xác minh, ghi `Chưa rõ` và OQ; không tự điền tên nguồn, DB, nhóm, owner, steward hoặc business key.

Mã `{DATA_SOURCE}` phải viết hoa, không dấu, dài tối đa 10 ký tự và cố định trong phạm vi nguồn. Tên bảng Bronze phải là:

```text
{DATA_SOURCE}_{DB}_{SCHEMA}_{TABLE}
```

viết hoa toàn bộ. Nếu chưa xác định được một thành phần, không tự chọn giá trị thay thế; giữ object chưa xác định ở trạng thái `error` hoặc `conflict` và ghi OQ.

Script hỗ trợ là `scripts/create_survey_workbooks.mjs`. Trước khi chạy phải kiểm tra script đang đọc đúng bốn sheet và header thực tế của template; không dùng các hằng số của template cũ. Runtime phải có `@oai/artifact-tool`; nếu cần, đặt `OAI_ARTIFACT_TOOL_PATH`. Có thể truyền `--template`, nhiều `--ddl`, nhiều `--object`, `--sample-data` và `--output-dir`.

Ví dụ phạm vi rõ ràng:

```bash
node scripts/create_survey_workbooks.mjs \
  --ddl sources/DDL-REVERA-revera-owner.sql \
  --object REVERA_OWNER.AOS_MASTER \
  --sample-data ./samples/AOS_MASTER.json \
  --output-dir outputs
```

Mẫu JSON phải là mảng object hoặc object có `{ "schema": "...", "table": "...", "rows": [...] }`. Chỉ dùng mẫu đã che; không đưa dữ liệu production, secret hoặc PII thật vào workbook, ghi chú hay report.

## 0. File review bắt buộc

Trước khi phân tích, trích xuất DDL hoặc tạo workbook, phải lập phạm vi input theo thứ tự ổn định và đọc từng file đầy đủ. Phạm vi phải bao gồm template, `references/04-bronze.md`, DDL, data dictionary, sample, tài liệu PII/domain và các reference khác thực sự được dùng; loại trừ `outputs/`, `.git`, `node_modules`, `.DS_Store` và file sinh trong quá trình chạy.

Với mỗi file:

1. ghi tên, loại file, trạng thái đọc và phạm vi nội dung;
2. dùng bộ đọc phù hợp: OOXML/spreadsheet cho `.xlsx`, parser cấu trúc cho CSV/JSON, đọc toàn bộ Markdown/SQL;
3. chỉ ghi nhận bằng chứng, chưa kết luận PK/FK, nullable, PII, quality, datatype Bronze hoặc business rule;
4. không chọn một file làm nguồn chính và bỏ qua file khác;
5. file không đọc được phải ghi lỗi, không âm thầm bỏ qua.

Sau file cuối cùng, tạo `outputs/file-review-checkpoint.txt`:

```text
FILE REVIEW CHECKPOINT

Total input files: <number>
Files processed: <number>
Successfully read: <number>
Unreadable files: <number>
Skipped files: 0

All accessible files have been reviewed: YES/NO
```

Chỉ tiếp tục khi `All accessible files have been reviewed: YES`. Checkpoint phải được đưa vào `batch-report.md`.

## 1. Quy trình tạo workbook

Xử lý tuần tự theo `{schema}` rồi tên object tăng dần. Với mỗi object, hoàn tất theo thứ tự: xác định block DDL và bằng chứng, tạo bản sao template, điền bốn sheet, lưu, mở lại kiểm tra, ghi report một dòng rồi giải phóng workbook. Lỗi một object không được làm mất report hoặc dừng object độc lập khác.

Workbook output đặt tên:

```text
survey-05-phan-tich-du-lieu-03-{BẢNG_BRONZE}.xlsx
```

Nếu output đã tồn tại thì không ghi đè, ghi `skipped` và chuyển object kế tiếp.

Khi authoring bằng Artifact Tool:

- đọc và render template trước khi ghi;
- trước lệnh authoring đầu tiên chạy `mark_artifact_operation_started.mjs` với operation `create` một lần;
- tạo bản sao từ template, giữ nguyên sheet, merge, style, width/height, freeze panes, gridlines, tab color, page setup và nội dung không thuộc phạm vi;
- gọi `workbook.recalculate()` đúng một lần sau khi ghi;
- không tạo workbook mới từ đầu thay cho việc copy template.

### 1.1. `00-META`

Điền các trường có bằng chứng: hệ thống, DB, schema, tên bảng/view nguồn, bảng Bronze, ngày thiết kế, người lập, loại object, loại nghiệp vụ, nhóm chức năng, file tổng quan, tên DWH/staging, ý nghĩa bảng, bản ghi đại diện, PK, business key, unique/index nghiệp vụ, owner, steward, classification, retention và usage.

- Giữ đúng tên object nguồn trong trường nguồn.
- Bảng Bronze dùng `{DATA_SOURCE}_{DB}_{SCHEMA}_{TABLE}` viết hoa.
- `table`/`view`, `master`/`transaction`/`snapshot`/`history`/`audit`/`other` chỉ ghi khi có bằng chứng.
- Chưa biết dùng `Chưa rõ`; không áp dụng dùng `N/A`; không ghi mật khẩu hoặc secret.

### 1.2. `01-COL`

Tạo đúng một dòng cho mỗi cột nguồn, đúng thứ tự DDL, sau đó đặt đúng sáu dòng kỹ thuật ở cuối. Bảng nguồn Bronze là bản sao 1-1 về cột và giá trị nghiệp vụ; không tự thêm cột nghiệp vụ hoặc sửa chất lượng dữ liệu tại Bronze.

- `A STT`: đánh số cột nguồn; sáu dòng kỹ thuật dùng giá trị template `—`.
- `B Tên cột`: giữ tên cột nguồn theo DDL và không dùng tên từ tài liệu khác để ghi đè.
- `C Cột Bronze`: tên nguồn viết hoa; nếu trùng keyword Oracle hoặc `BRONZE_*` thì thêm `_` theo reference.
- `D Kiểu dữ liệu nguồn`: ghi nguyên bản từ DDL hoặc source schema, gồm precision, scale, length và qualifier.
- `E Kiểu dữ liệu Bronze`: quy đổi theo `references/04-bronze.md`; không ghi kiểu đích vào cột D.
- `F Mô tả`: ưu tiên mô tả trực tiếp từ data dictionary, comment DDL và tài liệu domain. Nếu chưa có bằng chứng đủ rõ, ghi `Chưa rõ`, không dịch literal tên cột thành business rule.
- `G Mặc định`: ghi nguyên biểu thức default; không có hoặc chưa xác minh ghi `Chưa rõ`.
- `H Dữ liệu mẫu`: tối đa 1–3 giá trị đã che; không có mẫu ghi `Chưa rõ`.
- `I Bắt buộc nghiệp vụ`: chỉ ghi khi SME/tài liệu nghiệp vụ xác nhận; không suy ra từ NOT NULL.
- `J Công thức tính`: chỉ ghi công thức đã xác nhận; không tự tạo từ tên hoặc kiểu.
- `K:T Quality`: dùng catalog trong reference; mỗi mục ghi giá trị có căn cứ, `N/A` hoặc `Chưa rõ`, không tự khẳng định quality từ một vài mẫu.
- `U CDC/SCD`: dùng mã `CDC-WM`, `CDC-SD`, `CDC-KEY`, `SCD-FROM`, `SCD-TO`, `SCD-VER`, `SCD-CUR`, `SCD-BIZ-DT`, `SCD2` hoặc `N/A` theo bằng chứng.
- `V:AA Protection`: dùng mã `MSK-*`, `ENC-*`, `AC-*`, `ANON-*`, `PSEU-*` trong reference. Trên Bronze, PII giữ plaintext và bảo vệ bằng ACL; không mã hóa cột Bronze. Khi không áp dụng ghi `N/A`.
- `AB Khác nguồn`: ghi chênh lệch tên/kiểu/format, mapping và giới hạn kỹ thuật có bằng chứng; không chép secret hoặc mẫu đầy đủ.
- `AC Xác nhận`: dùng `Chưa xác nhận`, `Đã xác nhận` hoặc `Cần làm rõ` đúng catalog.
- `AD Ghi chú`: ghi OQ, giới hạn, payload JSON/XML/CLOB/BLOB, timezone, mapping hoặc quyết định cần theo dõi; không lặp description và không đưa provenance thay cho cột `AB`.

Sáu dòng kỹ thuật phải giữ các giá trị contract sau:

| Cột Bronze | Kiểu Bronze | Allow Null | Ghi chú |
|---|---|---|---|
| `BRONZE_INGEST_TS` | `TIMESTAMP(6)` UTC | `N` | Cột kỹ thuật, không có cột nguồn |
| `BRONZE_SOURCE_SYSTEM` | `VARCHAR2(30 CHAR)` | `N` | Mã `{DATA_SOURCE}` |
| `BRONZE_SOURCE_OBJECT` | `VARCHAR2(400 CHAR)` | `N` | `{DB}.{schema}.{table}` |
| `BRONZE_BATCH_ID` | `VARCHAR2(64 CHAR)` | `N` | Mã batch nạp |
| `BRONZE_OP` | `CHAR(1)` | `N` | `I`/`U`; không tự thêm semantics khác |
| `BRONZE_SOURCE_TS` | `TIMESTAMP(6)` | `Y` nếu không CDC | Timestamp từ nguồn nếu có |

Với dòng kỹ thuật, `B` và `D` là `—`, `C` và `E` dùng đúng contract, `AB` là `Cột kỹ thuật`; không gán PK/FK, PII, sample hoặc business formula từ suy đoán.

### 1.3. Quy đổi kiểu dữ liệu Bronze

Thực hiện đúng `references/04-bronze.md`, không dùng quy tắc cũ giới hạn chuỗi về `STANDARD` thay cho Bronze:

1. Đích là Oracle AI Database 26ai, tương thích `COMPATIBLE >= 23.0.0`; `AL32UTF8` là character set đề xuất nếu context cho phép.
2. Mọi kiểu chuỗi có length hữu hạn áp dụng đúng một lần `ceil(n × 1,2)`. Ví dụ `50→60`, `10→12`, `3→4`, `1→2`.
3. Nếu length sau tăng vượt trần `VARCHAR2` theo `MAX_STRING_SIZE`, dùng `CLOB` và ghi căn cứ/rủi ro ở `AB` hoặc report. Không tự cắt về 4000, không bỏ workbook và không đổi âm thầm sang kiểu khác.
4. Text/CLOB nguồn không nhân 1,2. `NUMBER`, `DATE`, `TIMESTAMP` và precision/scale giữ nguyên theo bảng quy đổi.
5. Theo reference: boolean dùng `BOOLEAN`, JSON dùng `JSON`, UUID nhị phân dùng `RAW(16)`, XML dùng `XMLTYPE`, vector dùng `VECTOR`, spatial dùng `SDO_GEOMETRY`; chỉ áp dụng khi kiểu nguồn đã xác định.
6. `RAW` nhỏ có thể áp dụng length rule; RAW lớn/unbounded dùng `BLOB` theo reference. `LONG` nguồn dùng `CLOB`.
7. Không vượt `NUMBER` 38 chữ số, 1.000 cột/bảng hoặc identifier 128 byte. Không tự sửa nguồn; vượt giới hạn phải là OQ/conflict.
8. Kiểu nguồn, kết quả tính, context limit và lý do quy đổi phải đối chiếu được qua `D`, `E`, `AB`, `AD` hoặc report; không đưa chuỗi provenance dài vào `F Mô tả`.

### 1.4. `02-CDC`

Điền thao tác Insert/Update/Delete, cách phát hiện thay đổi, watermark, hard delete, backfill/purge, khung giờ và số update khi có bằng chứng DBA. Phần SCD ghi overwrite, append-only, cột hiệu lực/phiên bản, history riêng, SCD1/SCD2/snapshot và khoảng lịch sử khi có xác nhận SME. Nếu chưa biết ghi `Chưa rõ`; không suy ra CDC từ tên cột thời gian đơn lẻ.

### 1.5. `03-LOAD`

Điền `Giá trị`, `Căn cứ`, `Trạng thái` cho kiểu nạp, khóa nhận diện dòng, phát hiện xoá, tần suất, partition và rotate.

- Kiểu nạp chỉ dùng `full`, `incremental`, `cdc` hoặc `Theo mặc định` khi có căn cứ.
- Khóa nhận diện dòng phải dựa trên PK/BK đã xác minh; không dùng tên cột có hậu tố `_ID` làm khóa.
- Rotate chỉ đề xuất cho history/transaction lớn khi có căn cứ; master mặc định `Không` chỉ khi loại nghiệp vụ đã xác định.
- Mọi quyết định phải có `Căn cứ` và `Trạng thái` `Đề xuất`, `Đã chốt` hoặc `Mở` theo reference. Không coi đề xuất là xác nhận DBA/SME.

## 2. Mở rộng dòng và giữ layout

Nếu số cột nguồn lớn hơn vùng năm dòng mẫu, phải chèn/copy dòng nguồn trước sáu dòng kỹ thuật, sau đó đặt sáu dòng kỹ thuật ngay sau `sourceLastRow`. Áp dụng style, number format, border, validation nếu template có, chiều cao và wrap text theo dòng mẫu gần nhất. Không để merge `A1:AD1`, `A2:AD2` hoặc `A4:AD4` che dữ liệu. Kiểm tra tối thiểu dòng nguồn cuối, dòng kỹ thuật đầu và dòng sau vùng mở rộng.

Không thay đổi nội dung, style, merge, sheet order, column width, freeze panes, gridlines, tab color hoặc page setup ngoài việc thêm dòng cần thiết và điền dữ liệu trong bốn sheet.

## 3. Validation và report

Sau khi điền:

- mở lại output và xác nhận đúng bốn sheet, đúng header thực tế và đúng một object;
- xác nhận số dòng cột nguồn bằng số cột DDL, cộng đúng sáu dòng `BRONZE_*`;
- kiểm tra vùng đầu, giữa, cuối của `01-COL`, sáu dòng kỹ thuật, merge/style và dữ liệu `00-META`, `02-CDC`, `03-LOAD`;
- render template trước và workbook sau khi điền; kiểm tra không cắt chữ, tràn ô hoặc mất layout;
- quét lỗi công thức `#REF!`, `#DIV/0!`, `#VALUE!`, `#N/A`, `#NAME?`, `#NUM!`, `#NULL!`, `#SPILL!`, `#CALC!`;
- xác nhận không có dữ liệu production, secret hoặc PII thật;
- chuyển các file `*.xlsx.inspect.ndjson` vào `outputs/inspect/`, không để ở cấp output chính.

Tạo `outputs/batch-report.md` và ghi đúng một dòng sau khi kiểm tra xong từng object, tối thiểu có:

```text
Source DDL | Data source | DB | Schema | Object name | Bronze table | Output file | Status | Source columns | Bronze technical columns | Conflicts | OQs | Errors
```

`Status` chỉ dùng `created`, `skipped`, `conflict`, `error`. Workbook có OQ hoặc datatype conflict nhưng đã export được dùng `created`, ghi chi tiết trong `Conflicts`/`OQs`. Cuối report ghi tổng số object đã quét, tạo, bỏ qua, conflict, lỗi và đường dẫn checkpoint/output.

## 4. Tiêu chí bàn giao

- Workbook được copy từ đúng template mới và có đúng `00-META`, `01-COL`, `02-CDC`, `03-LOAD`.
- `01-COL` giữ một bản sao 1-1 các cột nguồn và có đúng sáu cột kỹ thuật ở cuối.
- `D` giữ kiểu nguồn; `E` dùng kiểu Bronze theo `references/04-bronze.md` với `ceil(n × 1,2)` đúng một lần.
- Tên bảng Bronze và tên cột Bronze tuân thủ quy ước nguồn; không tự tạo PK/FK, business rule, quality, PII hoặc CDC/SCD.
- PII trên Bronze không bị mã hóa cột; ACL và catalog protection được ghi bằng mã có căn cứ.
- Mọi quyết định load/rotate/partition có `Căn cứ` và `Trạng thái`; thiếu bằng chứng ghi `Chưa rõ`/`N/A` và OQ.
- Không có output ghi đè nguồn; output chính chỉ có workbook, `batch-report.md`, `file-review-checkpoint.txt` và `inspect/`.

## 5. Nguyên tắc không được vi phạm

- Không tự xử lý object ngoài phạm vi người dùng yêu cầu.
- Không đọc workbook output cũ để suy ra schema, datatype, sample hoặc business meaning.
- Không biến index thành PK/FK; không suy luận khóa, PII, domain, quality hoặc CDC từ tên cột đơn lẻ.
- Không sửa dữ liệu nghiệp vụ tại Bronze; chất lượng nghiệp vụ được xử lý tại nguồn.
- Không nhân length nhiều lần; chỉ lấy length gốc từ DDL/source schema của lần chạy hiện tại.
- Không mã hóa cột PII trên Bronze, không nạp secret và không đưa dữ liệu thật vào output.
- Khi nguồn mâu thuẫn hoặc kiểu không thể xác minh, giữ bằng chứng riêng, tạo workbook nếu có thể, ghi `conflict`/OQ và không tự chọn.
- `04-bronze.md` là reference chuẩn cho contract Bronze; nếu reference không có trong phạm vi hoặc không đọc được, phải dừng trước khi tạo output và ghi lỗi.
